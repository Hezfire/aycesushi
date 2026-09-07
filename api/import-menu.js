/**
 * Vercel serverless API: import sushi menu items from a restaurant URL,
 * pasted text, or photo/PDF upload.
 *
 * Flow:
 * 1) Fetch page HTML / PDF (URL), use pasted text, or accept uploaded media
 * 2) If Chowbus-style JSON is embedded, extract dish names then grocery-price them
 * 3) Otherwise ask Gemini (text or multimodal) for names + grocery $/piece estimates
 * 4) Return cleaned JSON to the browser
 *
 * Required env (set in Vercel project settings — never commit the real key):
 *   GEMINI_API_KEY
 * Optional:
 *   GEMINI_MODEL  (default: gemini-3.6-flash)
 */

const MAX_BODY_CHARS = 80_000
const MAX_UPLOAD_BODY_CHARS = Math.floor(3.8 * 1024 * 1024)
const MAX_FILE_BASE64_CHARS = Math.floor(3.5 * 1024 * 1024)
const MAX_FILE_BYTES = Math.floor(2.6 * 1024 * 1024)
const MAX_PAGE_CHARS = 40_000
const MAX_MENU_ITEMS = 80
const CHOWBUS_MIN_ITEMS = 8
const FETCH_TIMEOUT_MS = 12_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 8

const ALLOWED_MEDIA_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

/** Simple in-memory rate limit (resets when the serverless instance recycles). */
const rateBuckets = new Map()

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function checkRateLimit(ip) {
  const now = Date.now()
  const bucket = rateBuckets.get(ip) || { count: 0, start: now }
  if (now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    bucket.count = 0
    bucket.start = now
  }
  bucket.count += 1
  rateBuckets.set(ip, bucket)
  return bucket.count <= RATE_LIMIT_MAX
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeMimeType(value) {
  const raw = String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (raw === 'image/jpg') return 'image/jpeg'
  return raw
}

function isPdfUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return path.endsWith('.pdf')
  } catch {
    return /\.pdf(\?|#|$)/i.test(String(url || ''))
  }
}

function htmlToPlainText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Piece count from labels like "(8Pcs)", "8 pcs", "8 pieces".
 * Default 1 when no count is stated (sides, bowls, single nigiri prices).
 */
function piecesFromLabel(name, description = '') {
  const text = `${name || ''} ${description || ''}`
  const patterns = [/\((\d+)\s*pcs?\.?\)/i, /\b(\d+)\s*pcs?\b/i, /\b(\d+)\s*pieces?\b/i]
  for (const re of patterns) {
    const match = text.match(re)
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n >= 2 && n <= 24) return n
  }
  return 1
}

function toPricePerPiece(listPrice, name, description = '') {
  const price = Number(listPrice)
  if (!Number.isFinite(price) || price < 0) return 0
  const pieces = piecesFromLabel(name, description)
  return Math.round((price / pieces) * 100) / 100
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\\u0026/gi, '&')
    .trim()
}

/**
 * Chowbus / similar POS pages embed dishes in Next.js flight scripts as
 * heavily escaped JSON, e.g. \\\"name\\\":\\\"edamame\\\", \\\"menu_price\\\":\\\"4.99\\\".
 * Plain-text stripping removes those scripts, so we parse the raw HTML.
 */
function normalizeEmbeddedJson(html) {
  let s = String(html || '')
  for (let i = 0; i < 4; i++) {
    if (/"menu_price"\s*:/.test(s)) break
    s = s.replace(/\\"/g, '"').replace(/\\u0026/gi, '&')
  }
  return s
}

function extractChowbusMenuItems(html) {
  const raw = normalizeEmbeddedJson(html)
  const found = []
  const seen = new Set()

  function consider(nameRaw, priceRaw, descriptionRaw = '') {
    const name = decodeHtmlEntities(nameRaw).replace(/\s+/g, ' ')
    if (!name || name.length > 80) return
    const key = name.toLowerCase()
    if (seen.has(key)) return
    const listPrice = Number(priceRaw)
    if (!Number.isFinite(listPrice) || listPrice <= 0) return
    if (/^(cart|subtotal|total|tax|tip|delivery|service fee)\b/i.test(name)) return
    seen.add(key)
    const description = decodeHtmlEntities(descriptionRaw)
    found.push({
      name,
      listPrice,
      description,
      pricePerPiece: toPricePerPiece(listPrice, name, description),
    })
  }

  // Real dishes include kitchen_name; category rows do not (avoids pairing
  // category titles with the next item's menu_price).
  const itemRe =
    /"name"\s*:\s*"([^"]{1,120})"\s*,\s*"foreign_name"\s*:\s*"([^"]*)"\s*,\s*"kitchen_name"\s*:\s*"([^"]*)"[\s\S]{0,400}?"menu_price"\s*:\s*"([0-9]+(?:\.[0-9]+)?)"(?:[\s\S]{0,400}?"description"\s*:\s*"([^"]*)")?/g
  let match
  while ((match = itemRe.exec(raw))) {
    consider(match[1], match[4], match[5] || '')
  }

  return found
}

function formatStructuredMenuText(items) {
  // Names (+ piece counts) only — never pass restaurant menu prices into Gemini.
  return items
    .map((item) => {
      const pcs = piecesFromLabel(item.name, item.description)
      return pcs > 1
        ? `${item.name} (${pcs} pieces per order at the restaurant)`
        : item.name
    })
    .join('\n')
}

/**
 * Offline grocery / supermarket per-piece estimates when Gemini is unavailable.
 * Tuned to HEB / Kroger / Costco-pack style prepared sushi, not restaurant à la carte.
 */
function groceryEstimateFromName(name, description = '') {
  const text = `${name || ''} ${description || ''}`.toLowerCase()

  let perPiece = 1.2
  if (/sashimi/.test(text)) perPiece = 1.55
  else if (/nigiri/.test(text)) perPiece = 1.25
  else if (/dragon|rainbow|tempura|spider|volcano|crunchy|special roll|caterpillar/.test(text))
    perPiece = 1.0
  else if (/california|cucumber roll|avocado roll|tuna roll|salmon roll|spicy tuna|spicy salmon|philadelphia|maki|\broll\b/.test(text))
    perPiece = 0.65
  else if (/yakitori|skewer|kushi|robata|kushiyaki/.test(text)) perPiece = 1.5
  else if (/edamame/.test(text)) perPiece = 2.5
  else if (/miso/.test(text)) perPiece = 1.5
  else if (/salad|soup/.test(text)) perPiece = 2.0
  else if (/sushi/.test(text)) perPiece = 1.15

  return Math.round(perPiece * 100) / 100
}

function applyGroceryFallbackPrices(items) {
  return items.map((item) => ({
    name: item.name,
    pricePerPiece: groceryEstimateFromName(item.name, item.description),
  }))
}

function mergeGroceryPrices(namedItems, pricedItems) {
  const byName = new Map(
    (pricedItems || []).map((item) => [String(item.name || '').toLowerCase(), item.pricePerPiece]),
  )
  return namedItems.map((item) => {
    const key = String(item.name || '').toLowerCase()
    const fromModel = byName.get(key)
    const price =
      Number.isFinite(fromModel) && fromModel > 0
        ? Math.round(Number(fromModel) * 100) / 100
        : groceryEstimateFromName(item.name, item.description)
    return { name: item.name, pricePerPiece: price }
  })
}

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64')
}

async function fetchPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'WorthBiteMenuBot/1.0 (+https://vercel.app; AYCE sushi worth-it calculator)',
        Accept:
          'text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,image/*;q=0.8,*/*;q=0.7',
      },
    })
    if (!response.ok) {
      throw new Error(`Could not load that page (HTTP ${response.status}).`)
    }
    const contentType = normalizeMimeType(response.headers.get('content-type') || '')
    const treatAsPdf = contentType === 'application/pdf' || isPdfUrl(url)

    if (treatAsPdf) {
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length > MAX_FILE_BYTES) {
        throw new Error('That PDF is too large. Try uploading a smaller file or photo.')
      }
      if (bytes.length < 20) {
        throw new Error('That PDF looked empty. Try another link or upload the file.')
      }
      return {
        kind: 'pdf',
        text: '',
        structured: [],
        media: { mimeType: 'application/pdf', base64: bufferToBase64(bytes) },
      }
    }

    if (
      contentType &&
      !/text\/html|text\/plain|application\/xhtml\+xml|application\/json/i.test(contentType)
    ) {
      throw new Error('That URL does not look like a menu web page or PDF.')
    }

    const html = await response.text()
    const structured = extractChowbusMenuItems(html)
    const text = htmlToPlainText(html).slice(0, MAX_PAGE_CHARS)
    if (structured.length < CHOWBUS_MIN_ITEMS && text.length < 40) {
      throw new Error(
        'The page had almost no readable text (often a JavaScript-only menu). Upload a photo/PDF or paste the menu text instead.',
      )
    }
    return { kind: 'html', html, text, structured, media: null }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timed out loading that website. Try again, upload a photo/PDF, or paste menu text.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function countPriceSignals(text) {
  const dollar = (String(text).match(/\$\s*\d/g) || []).length
  const decimals = (String(text).match(/\b\d+\.\d{2}\b/g) || []).length
  return dollar + decimals
}

/**
 * URL pages without price-like text are usually marketing/wiki/SPA shells.
 * Pasted text can be dish names only, so prices are not required there.
 */
function assertUsableMenuSource(text, { requirePrices }) {
  if (requirePrices && countPriceSignals(text) < 2) {
    throw new Error(
      'That page does not look like a priced restaurant menu. Upload a photo/PDF or paste the menu text instead.',
    )
  }
}

const NAME_STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'roll',
  'rolls',
  'piece',
  'pieces',
  'special',
  'sushi',
])

function itemGroundedInSource(name, sourceLower) {
  const n = String(name || '')
    .toLowerCase()
    .trim()
  if (!n) return false
  if (sourceLower.includes(n)) return true

  const words = n
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !NAME_STOP_WORDS.has(w))
  if (words.length === 0) {
    return sourceLower.includes(n.slice(0, Math.min(10, n.length)))
  }
  const hits = words.filter((w) => sourceLower.includes(w)).length
  return hits >= Math.ceil(words.length * 0.7)
}

function groundItemsInSource(items, menuText) {
  const sourceLower = String(menuText || '').toLowerCase()
  return items.filter((item) => itemGroundedInSource(item.name, sourceLower))
}

function buildPrompt(sourceLabel, { hasMedia = false, menuText = '' } = {}) {
  const sourceBlock = hasMedia
    ? `The restaurant menu is attached as an image or PDF. Extract dishes that are clearly listed there.`
    : `Menu / dish list:\n${menuText}`

  return `You help an AYCE worth-it calculator. Extract dish names from a restaurant menu, then price each dish at GROCERY / SUPERMARKET prepared-sushi value (HEB, Kroger, Costco pack style)—NOT the restaurant’s à la carte price.

Source: ${sourceLabel}

Return ONLY valid JSON (no markdown) with this shape:
{"isRestaurantMenu":true,"items":[{"name":"Salmon Nigiri","pricePerPiece":1.25}]}

Rules:
- isRestaurantMenu must be true ONLY if this is clearly a restaurant menu / dish listing (or a list of dish names to price). If it is an article, homepage, blog, wiki, marketing page, or anything else, set isRestaurantMenu to false and items to [].
- NEVER invent dishes that are not explicitly named. Do not invent a full sushi menu from general knowledge.
- When isRestaurantMenu is true: include sushi, sashimi, nigiri, rolls, common sides (edamame, miso, etc.), AND robata, yakitori, kushiyaki, skewers, and similar grilled/kitchen items useful for AYCE tracking.
- Skip drinks, desserts, and non-food noise when possible.
- name: short customer-facing item name from the menu.
- pricePerPiece: typical U.S. GROCERY-STORE prepared sushi USD value PER PIECE (what you’d pay at HEB/Kroger-style sushi, not a sit-down restaurant).
  - Ignore restaurant dollar amounts printed on the menu when setting pricePerPiece.
  - Ballpark guides: nigiri/sashimi ~$1.00–$1.75/pc; common rolls ~$0.50–$0.90/pc; fancy rolls ~$0.80–$1.25/pc; sides lower grocery analogs.
  - If the name says 8 pcs / (8Pcs) / 8 pieces, pricePerPiece is still the grocery value of ONE piece (not the whole roll).
  - For skewers, use a grocery meat-skewer analog per skewer.
- Cap at ${MAX_MENU_ITEMS} items. Prefer popular/common items if the menu is huge.
- pricePerPiece must be a number >= 0 with at most 2 decimal places.

${sourceBlock}`
}

function extractJsonObject(raw) {
  const text = String(raw || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI returned an unexpected format. Please try again.')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

function normalizeItems(payload) {
  const list = Array.isArray(payload?.items) ? payload.items : []
  const cleaned = []
  const seen = new Set()

  for (const item of list) {
    const name = String(item?.name || '').trim().replace(/\s+/g, ' ')
    if (!name || name.length > 80) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    let price = Number(item?.pricePerPiece)
    if (!Number.isFinite(price) || price < 0) price = 0
    price = Math.round(price * 100) / 100

    cleaned.push({ name, pricePerPiece: price })
    if (cleaned.length >= MAX_MENU_ITEMS) break
  }

  return cleaned
}

function sanitizeUploadBase64(value) {
  let data = String(value || '').trim()
  const dataUrl = data.match(/^data:([^;]+);base64,(.+)$/i)
  if (dataUrl) {
    return { mimeFromDataUrl: normalizeMimeType(dataUrl[1]), base64: dataUrl[2].replace(/\s+/g, '') }
  }
  return { mimeFromDataUrl: '', base64: data.replace(/\s+/g, '') }
}

async function callGemini({ menuText = '', sourceLabel, media = null, skipGrounding = false }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Menu import is not configured yet. The site owner needs to set GEMINI_API_KEY on the server.',
    )
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const parts = [{ text: buildPrompt(sourceLabel, { hasMedia: Boolean(media), menuText }) }]
  if (media?.base64 && media?.mimeType) {
    parts.push({
      inline_data: {
        mime_type: media.mimeType,
        data: media.base64,
      },
    })
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const apiMessage = data?.error?.message || ''
    if (response.status === 429) {
      throw new Error(
        'The free AI quota is temporarily used up. Please try again later.',
      )
    }
    if (/API key|PERMISSION|401|403/i.test(apiMessage) || response.status === 401 || response.status === 403) {
      throw new Error('The AI API key is missing or invalid. Check GEMINI_API_KEY on the server.')
    }
    throw new Error(apiMessage || 'AI menu extraction failed. Please try again.')
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  const parsed = extractJsonObject(text)

  if (parsed?.isRestaurantMenu === false) {
    throw new Error(
      'That does not look like a restaurant menu. Try another photo/PDF, URL, or paste the menu text.',
    )
  }

  const cleaned = normalizeItems(parsed)
  if (skipGrounding || media) {
    return cleaned
  }

  const grounded = groundItemsInSource(cleaned, menuText)

  // If most returned names were not in the source, the model invented a menu.
  if (cleaned.length > 0 && grounded.length < Math.max(1, Math.ceil(cleaned.length * 0.5))) {
    throw new Error(
      'Could not match dishes to that page. Upload a photo/PDF or paste the menu text instead.',
    )
  }

  return grounded
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST with a JSON body.' })
    return
  }

  const ip = getClientIp(req)
  if (!checkRateLimit(ip)) {
    sendJson(res, 429, {
      error: 'Too many import requests. Please wait a minute and try again.',
    })
    return
  }

  try {
    let body = req.body
    if (body == null) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const rawBody = Buffer.concat(chunks).toString('utf8')
      if (rawBody.length > MAX_UPLOAD_BODY_CHARS) {
        sendJson(res, 413, { error: 'Request too large. Try a smaller photo or PDF.' })
        return
      }
      body = rawBody ? JSON.parse(rawBody) : {}
    } else if (typeof body === 'string') {
      if (body.length > MAX_UPLOAD_BODY_CHARS) {
        sendJson(res, 413, { error: 'Request too large. Try a smaller photo or PDF.' })
        return
      }
      body = body ? JSON.parse(body) : {}
    }

    const serialized = JSON.stringify(body)
    if (serialized.length > MAX_UPLOAD_BODY_CHARS) {
      sendJson(res, 413, { error: 'Request too large. Try a smaller photo or PDF.' })
      return
    }

    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const pasted = typeof body.text === 'string' ? body.text.trim() : ''
    const upload = sanitizeUploadBase64(body.fileBase64)
    let uploadMime = normalizeMimeType(body.mimeType || upload.mimeFromDataUrl)

    if (!url && !pasted && !upload.base64) {
      sendJson(res, 400, {
        error: 'Provide a menu URL, photo/PDF upload, or pasted menu text.',
      })
      return
    }

    let media = null
    if (upload.base64) {
      if (upload.base64.length > MAX_FILE_BASE64_CHARS) {
        sendJson(res, 413, { error: 'That file is too large. Try a smaller photo or PDF.' })
        return
      }
      if (!ALLOWED_MEDIA_TYPES.has(uploadMime)) {
        sendJson(res, 400, {
          error: 'Upload a JPEG/PNG/WebP photo or a PDF menu.',
        })
        return
      }
      media = { mimeType: uploadMime === 'image/jpg' ? 'image/jpeg' : uploadMime, base64: upload.base64 }
    }

    let menuText = ''
    let sourceLabel = media ? 'uploaded menu file' : 'pasted menu text'
    let requirePrices = false
    let structuredItems = []

    if (url) {
      if (!isValidHttpUrl(url)) {
        sendJson(res, 400, { error: 'URL must start with http:// or https://' })
        return
      }
      sourceLabel = url
      const page = await fetchPage(url)
      if (page.kind === 'pdf' && page.media) {
        // Prefer URL PDF when present; uploaded file can still be included as extra context via pasted path only.
        media = page.media
      } else {
        structuredItems = page.structured
        menuText = page.text
        requirePrices = !pasted && !media && structuredItems.length < CHOWBUS_MIN_ITEMS
        if (pasted) {
          menuText = `${menuText}\n\nAdditional pasted text:\n${pasted}`.slice(0, MAX_PAGE_CHARS)
        }
      }
    } else if (pasted) {
      menuText = pasted.slice(0, MAX_PAGE_CHARS)
    }

    // Chowbus: keep dish names from the restaurant JSON, but price at grocery baseline.
    if (structuredItems.length >= CHOWBUS_MIN_ITEMS) {
      const named = structuredItems.slice(0, Math.max(MAX_MENU_ITEMS, 120))
      const nameListText = formatStructuredMenuText(named)
      let items
      try {
        const priced = await callGemini({
          menuText: nameListText,
          sourceLabel: `${sourceLabel} (grocery reprice)`,
          skipGrounding: true,
        })
        items = mergeGroceryPrices(named, priced)
      } catch {
        items = applyGroceryFallbackPrices(named)
      }
      if (!items.length) {
        sendJson(res, 422, {
          error: 'No menu items found. Try another page, photo/PDF, or paste the menu text.',
        })
        return
      }
      sendJson(res, 200, { items })
      return
    }

    if (structuredItems.length > 0) {
      menuText = `${formatStructuredMenuText(structuredItems)}\n\n${menuText}`.slice(
        0,
        MAX_PAGE_CHARS,
      )
    }

    if (!media) {
      assertUsableMenuSource(menuText, { requirePrices })
    }

    const items = await callGemini({
      menuText,
      sourceLabel,
      media,
      skipGrounding: Boolean(media),
    })
    if (!items.length) {
      sendJson(res, 422, {
        error: 'No menu items found. Try another page, photo/PDF, or paste the menu text.',
      })
      return
    }

    sendJson(res, 200, { items })
  } catch (err) {
    const message = err?.message || 'Import failed.'
    const status = /quota|Too many|rate/i.test(message)
      ? 429
      : /not configured|API key/i.test(message)
        ? 503
        : /Invalid JSON/i.test(message)
          ? 400
          : /too large/i.test(message)
            ? 413
            : /does not look like|Could not match dishes|No menu items|No sushi-like/i.test(message)
              ? 422
              : 502
    sendJson(res, status, { error: message })
  }
}
