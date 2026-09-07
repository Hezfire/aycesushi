/**
 * Vercel serverless API: import sushi menu items from a restaurant URL or pasted text.
 *
 * Flow:
 * 1) Fetch page HTML (URL) or use pasted text
 * 2) Ask Gemini (free tier) to extract items + typical à la carte $/piece estimates
 * 3) Return cleaned JSON to the browser
 *
 * Required env (set in Vercel project settings — never commit the real key):
 *   GEMINI_API_KEY
 * Optional:
 *   GEMINI_MODEL  (default: gemini-2.5-flash)
 */

const MAX_BODY_CHARS = 80_000
const MAX_PAGE_CHARS = 40_000
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

async function fetchPageText(url) {
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
    const raw = await response.text()
    const text = htmlToPlainText(raw).slice(0, MAX_PAGE_CHARS)
    if (text.length < 40) {
      throw new Error(
        'The page had almost no readable text (often a JavaScript-only menu). Paste the menu text instead.',
      )
    }
    return text
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timed out loading that website. Try again or paste menu text.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function buildPrompt(sourceLabel, menuText) {
  return `You extract sushi / Japanese restaurant menu items for an all-you-can-eat worth-it calculator.

Source: ${sourceLabel}

From the menu text below, return ONLY valid JSON (no markdown) with this shape:
{"items":[{"name":"Salmon Nigiri","pricePerPiece":3.5}]}

Rules:
- Include sushi, sashimi, nigiri, rolls, and common sides (edamame, miso, etc.) useful for AYCE tracking.
- Skip drinks, desserts, and non-food noise when possible.
- name: short customer-facing item name.
- pricePerPiece: estimated typical U.S. à la carte USD value PER PIECE (not per roll platter).
  - If the menu shows a whole-roll price (e.g. $12 for 8 pieces), divide to get per-piece.
  - If no price is listed, estimate a reasonable typical market à la carte per-piece price.
- Cap at 40 items. Prefer popular/common items if the menu is huge.
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
    if (cleaned.length >= 40) break
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

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(sourceLabel, menuText) }] }],
      generationConfig: {
        temperature: 0.2,
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
  return normalizeItems(parsed)
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

    if (url) {
      if (!isValidHttpUrl(url)) {
        sendJson(res, 400, { error: 'URL must start with http:// or https://' })
        return
      }
      sourceLabel = url
      menuText = await fetchPageText(url)
      if (pasted) {
        menuText = `${menuText}\n\nAdditional pasted text:\n${pasted}`.slice(0, MAX_PAGE_CHARS)
      }
    } else {
      menuText = pasted.slice(0, MAX_PAGE_CHARS)
    }

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
          : 502
    sendJson(res, status, { error: message })
  }
}
