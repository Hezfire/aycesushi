/**
 * Vercel serverless API: import sushi menu items from a restaurant URL or pasted text.
 *
 * Flow:
 * 1) Fetch page HTML (URL) or use pasted text
 * 2) If Chowbus-style JSON is embedded, extract name + price directly (divide by pcs)
 * 3) Otherwise ask Gemini to extract items + typical à la carte $/piece estimates
 * 4) Return cleaned JSON to the browser
 *
 * Required env (set in Vercel project settings — never commit the real key):
 *   GEMINI_API_KEY
 * Optional:
 *   GEMINI_MODEL  (default: gemini-3.6-flash)
 */

const MAX_BODY_CHARS = 80_000
const MAX_PAGE_CHARS = 40_000
const MAX_MENU_ITEMS = 80
const CHOWBUS_MIN_ITEMS = 8
const FETCH_TIMEOUT_MS = 12_000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 8

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
  return items
    .map((item) => {
      const pcs = piecesFromLabel(item.name, item.description)
      const pcsNote = pcs > 1 ? ` (${pcs} pcs)` : ''
      return `${item.name}${pcsNote} $${Number(item.listPrice).toFixed(2)}${
        item.description ? ` — ${item.description}` : ''
      }`
    })
    .join('\n')
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
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
    })
    if (!response.ok) {
      throw new Error(`Could not load that page (HTTP ${response.status}).`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (
      contentType &&
      !/text\/html|text\/plain|application\/xhtml\+xml|application\/json/i.test(contentType)
    ) {
      throw new Error('That URL does not look like a menu web page.')
    }
    const html = await response.text()
    const structured = extractChowbusMenuItems(html)
    const text = htmlToPlainText(html).slice(0, MAX_PAGE_CHARS)
    if (structured.length < CHOWBUS_MIN_ITEMS && text.length < 40) {
      throw new Error(
        'The page had almost no readable text (often a JavaScript-only menu). Paste the menu text instead.',
      )
    }
    return { html, text, structured }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timed out loading that website. Try again or paste menu text.')
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
      'That page does not look like a priced restaurant menu. Paste the menu text (dish names and prices) instead.',
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

function buildPrompt(sourceLabel, menuText) {
  return `You extract sushi / Japanese restaurant menu items for an all-you-can-eat worth-it calculator.

Source: ${sourceLabel}

From the text below, return ONLY valid JSON (no markdown) with this shape:
{"isRestaurantMenu":true,"items":[{"name":"Salmon Nigiri","pricePerPiece":3.5}]}

Rules:
- isRestaurantMenu must be true ONLY if the text is clearly a restaurant menu / dish listing (item names people order). If it is an article, homepage, blog, wiki, marketing page, or anything else, set isRestaurantMenu to false and items to [].
- NEVER invent dishes that are not explicitly named in the text. Do not use general sushi knowledge to fill gaps.
- When isRestaurantMenu is true: include sushi, sashimi, nigiri, rolls, and common sides (edamame, miso, etc.) useful for AYCE tracking.
- Skip drinks, desserts, and non-food noise when possible.
- name: short customer-facing item name, taken from the text.
- pricePerPiece: U.S. USD value PER PIECE (not per whole roll).
  - If the name or description says 8 pcs / (8Pcs) / 8 pieces (or any count 2–24), DIVIDE the listed roll/plate price by that count. Example: Houston Roll (8Pcs) $15.99 → pricePerPiece 2.00.
  - Never treat an 8-piece roll's full price as a single-piece price.
  - If no price is listed for an item that IS in the text, estimate a reasonable typical market à la carte per-piece price.
- Cap at ${MAX_MENU_ITEMS} items. Prefer popular/common items if the menu is huge.
- pricePerPiece must be a number >= 0 with at most 2 decimal places.

Menu text:
${menuText}`
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

async function callGemini(menuText, sourceLabel) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Menu import is not configured yet. The site owner needs to set GEMINI_API_KEY on the server.',
    )
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(sourceLabel, menuText) }] }],
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
      'That page does not look like a restaurant menu. Paste the menu text instead.',
    )
  }

  const cleaned = normalizeItems(parsed)
  const grounded = groundItemsInSource(cleaned, menuText)

  // If most returned names were not in the source, the model invented a menu.
  if (cleaned.length > 0 && grounded.length < Math.max(1, Math.ceil(cleaned.length * 0.5))) {
    throw new Error(
      'Could not match dishes to that page. Paste the menu text (dish names and prices) instead.',
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
      if (rawBody.length > MAX_BODY_CHARS) {
        sendJson(res, 413, { error: 'Request too large. Shorten the pasted menu text.' })
        return
      }
      body = rawBody ? JSON.parse(rawBody) : {}
    } else if (typeof body === 'string') {
      if (body.length > MAX_BODY_CHARS) {
        sendJson(res, 413, { error: 'Request too large. Shorten the pasted menu text.' })
        return
      }
      body = body ? JSON.parse(body) : {}
    }

    if (JSON.stringify(body).length > MAX_BODY_CHARS) {
      sendJson(res, 413, { error: 'Request too large. Shorten the pasted menu text.' })
      return
    }

    const url = typeof body.url === 'string' ? body.url.trim() : ''
    const pasted = typeof body.text === 'string' ? body.text.trim() : ''

    if (!url && !pasted) {
      sendJson(res, 400, { error: 'Provide a menu URL or pasted menu text.' })
      return
    }

    let menuText = ''
    let sourceLabel = 'pasted menu text'
    let requirePrices = false
    let structuredItems = []

    if (url) {
      if (!isValidHttpUrl(url)) {
        sendJson(res, 400, { error: 'URL must start with http:// or https://' })
        return
      }
      sourceLabel = url
      const page = await fetchPage(url)
      structuredItems = page.structured
      menuText = page.text
      requirePrices = !pasted && structuredItems.length < CHOWBUS_MIN_ITEMS
      if (pasted) {
        menuText = `${menuText}\n\nAdditional pasted text:\n${pasted}`.slice(0, MAX_PAGE_CHARS)
      }
    } else {
      menuText = pasted.slice(0, MAX_PAGE_CHARS)
    }

    // Chowbus (and similar) menus: use structured prices directly — skip Gemini.
    if (structuredItems.length >= CHOWBUS_MIN_ITEMS) {
      const items = structuredItems.slice(0, Math.max(MAX_MENU_ITEMS, 120)).map((item) => ({
        name: item.name,
        pricePerPiece: item.pricePerPiece,
      }))
      sendJson(res, 200, { items })
      return
    }

    if (structuredItems.length > 0) {
      menuText = `${formatStructuredMenuText(structuredItems)}\n\n${menuText}`.slice(
        0,
        MAX_PAGE_CHARS,
      )
    }

    assertUsableMenuSource(menuText, { requirePrices })

    const items = await callGemini(menuText, sourceLabel)
    if (!items.length) {
      sendJson(res, 422, {
        error: 'No sushi-like items found. Try another page or paste the menu text.',
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
          : /does not look like|Could not match dishes|No sushi-like/i.test(message)
            ? 422
            : 502
    sendJson(res, status, { error: message })
  }
}
