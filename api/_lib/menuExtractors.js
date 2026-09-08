/**
 * Multi-platform menu extractors for WorthBite URL import.
 * Returns dish names (+ optional list prices) from HTML or platform APIs.
 */

export const STRUCTURED_MIN_ITEMS = 5

const NOISE_NAME =
  /^(cart|subtotal|total|tax|tip|delivery|service fee|processing fee|menu|category|login|sign in)\b/i

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

function normalizeName(raw) {
  return decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim()
}

function pushItem(found, seen, nameRaw, priceRaw, descriptionRaw = '') {
  const name = normalizeName(nameRaw)
  if (!name || name.length > 80) return
  if (NOISE_NAME.test(name)) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  const listPrice = Number(priceRaw)
  const hasPrice = Number.isFinite(listPrice) && listPrice > 0
  // Allow name-only when price missing (some generic miners)
  if (hasPrice === false && priceRaw != null && priceRaw !== '') return
  seen.add(key)
  found.push({
    name,
    listPrice: hasPrice ? listPrice : undefined,
    description: decodeHtmlEntities(descriptionRaw),
  })
}

function normalizeEmbeddedJson(html) {
  let s = String(html || '')
  for (let i = 0; i < 4; i++) {
    if (/"menu_price"\s*:/.test(s) || /"kitchen_name"\s*:/.test(s)) break
    s = s.replace(/\\"/g, '"').replace(/\\u0026/gi, '&')
  }
  return s
}

/** Chowbus / Next.js POS pages with kitchen_name + menu_price. */
export function extractChowbus(html) {
  const raw = normalizeEmbeddedJson(html)
  const found = []
  const seen = new Set()
  const itemRe =
    /"name"\s*:\s*"([^"]{1,120})"\s*,\s*"foreign_name"\s*:\s*"([^"]*)"\s*,\s*"kitchen_name"\s*:\s*"([^"]*)"[\s\S]{0,400}?"menu_price"\s*:\s*"([0-9]+(?:\.[0-9]+)?)"(?:[\s\S]{0,400}?"description"\s*:\s*"([^"]*)")?/g
  let match
  while ((match = itemRe.exec(raw))) {
    pushItem(found, seen, match[1], match[4], match[5] || '')
  }
  return found
}

export function isHonorMenuHost(hostname = '') {
  return /(^|\.)honormenu\.com$/i.test(hostname) || /(^|\.)honormenus\.com$/i.test(hostname)
}

export function isDeliveryMarketplaceHost(hostname = '') {
  return (
    /(^|\.)doordash\.com$/i.test(hostname) ||
    /(^|\.)ubereats\.com$/i.test(hostname) ||
    /(^|\.)grubhub\.com$/i.test(hostname) ||
    /(^|\.)seamless\.com$/i.test(hostname)
  )
}

/**
 * HonorMenu stores prices in cents (Price1: 295 => $2.95).
 */
export function parseHonorMenuCategoryGroup(payload) {
  const found = []
  const seen = new Set()
  const list = Array.isArray(payload?.list) ? payload.list : []
  for (const group of list) {
    for (const cat of group?.categoryList || []) {
      for (const menu of cat?.menuList || []) {
        const name = menu?.L1 || menu?.L2 || ''
        let cents = Number(menu?.Price1 ?? menu?.Price)
        if (!Number.isFinite(cents) || cents <= 0) {
          pushItem(found, seen, name, undefined, menu?.Remark || '')
          continue
        }
        // Honor uses integer cents; also accept already-dollar floats.
        const dollars = cents >= 50 && Number.isInteger(cents) ? cents / 100 : cents
        pushItem(found, seen, name, dollars, menu?.Remark || '')
      }
    }
  }
  return found
}

export async function fetchHonorMenuItems(pageUrl, fetchImpl = fetch) {
  let origin
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return []
  }
  const endpoint = `${origin}/order/menu/categoryGroup`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: '',
    })
    if (!response.ok) return []
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      return []
    }
    if (Number(payload?.returnCode) !== 0) return []
    return parseHonorMenuCategoryGroup(payload)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

const NAME_KEYS = ['name', 'title', 'itemName', 'item_name', 'displayName', 'L1', 'productName']
const PRICE_KEYS = [
  'price',
  'menu_price',
  'menuPrice',
  'Price1',
  'Price',
  'amount',
  'unitPrice',
  'basePrice',
  'displayPrice',
]

function pickName(obj) {
  for (const k of NAME_KEYS) {
    if (obj[k] != null && String(obj[k]).trim()) return String(obj[k])
  }
  return ''
}

function pickPrice(obj) {
  for (const k of PRICE_KEYS) {
    if (obj[k] == null || obj[k] === '') continue
    const n = Number(String(obj[k]).replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function walkJsonForMenuItems(node, found, seen, depth = 0) {
  if (depth > 12 || node == null) return
  if (Array.isArray(node)) {
    // Prefer arrays that look like menu rows
    let rowHits = 0
    for (const el of node) {
      if (el && typeof el === 'object' && !Array.isArray(el) && pickName(el)) rowHits += 1
    }
    if (rowHits >= 3) {
      for (const el of node) {
        if (!el || typeof el !== 'object') continue
        const name = pickName(el)
        const price = pickPrice(el)
        if (name) pushItem(found, seen, name, price ?? undefined, el.description || el.desc || '')
      }
    }
    for (const el of node) walkJsonForMenuItems(el, found, seen, depth + 1)
    return
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) walkJsonForMenuItems(v, found, seen, depth + 1)
  }
}

function extractJsonBlobsFromHtml(html) {
  const blobs = []
  const scriptRe =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = scriptRe.exec(html))) {
    blobs.push(m[1])
  }
  const nextRe = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi
  while ((m = nextRe.exec(html))) {
    blobs.push(m[1])
  }
  // Large inline JSON objects in scripts
  const assignRe =
    /(?:window\.__[A-Z0-9_]+__|__APOLLO_STATE__|__PRELOADED_STATE__)\s*=\s*(\{[\s\S]*?\});/gi
  while ((m = assignRe.exec(html))) {
    blobs.push(m[1])
  }
  return blobs
}

/** Generic SPA: __NEXT_DATA__ / application/json scripts / preloaded state. */
export function extractGenericJsonMenu(html) {
  const found = []
  const seen = new Set()
  for (const blob of extractJsonBlobsFromHtml(html)) {
    try {
      const parsed = JSON.parse(blob)
      walkJsonForMenuItems(parsed, found, seen)
    } catch {
      /* ignore */
    }
  }
  return found
}

/**
 * DoorDash / Uber Eats / Grubhub: same generic miner on whatever HTML we got.
 * (Often empty due to bot walls — caller should surface that.)
 */
export function extractDoorDashish(html) {
  return extractGenericJsonMenu(html)
}

export function looksLikeBotWall(html = '', text = '') {
  const hay = `${html}\n${text}`.toLowerCase()
  return (
    /cdn-cgi\/challenge|cf-browser-verification|attention required|access denied|bot detection|captcha|enable javascript to continue/i.test(
      hay,
    ) || /just a moment\.\.\./i.test(hay)
  )
}

export function isMostlyTemplatePlaceholders(text = '') {
  const s = String(text || '')
  if (!s.trim()) return true
  const placeholders = (s.match(/\{\{[^}]+\}\}/g) || []).length
  const letters = (s.match(/[a-zA-Z]{3,}/g) || []).length
  return placeholders >= 3 && letters < 15
}

/**
 * Sync extractors on HTML only (no network).
 */
export function extractStructuredMenuFromHtml({ url = '', html = '' } = {}) {
  let hostname = ''
  try {
    hostname = new URL(url || 'https://example.com').hostname
  } catch {
    hostname = ''
  }

  const chowbus = extractChowbus(html)
  if (chowbus.length >= STRUCTURED_MIN_ITEMS) {
    return { items: chowbus, platform: 'chowbus', confidence: 'high' }
  }

  if (isDeliveryMarketplaceHost(hostname)) {
    const market = extractDoorDashish(html)
    if (market.length >= STRUCTURED_MIN_ITEMS) {
      return { items: market, platform: 'marketplace', confidence: 'medium' }
    }
  }

  const generic = extractGenericJsonMenu(html)
  if (generic.length >= STRUCTURED_MIN_ITEMS) {
    return { items: generic, platform: 'generic-json', confidence: 'medium' }
  }

  // Partial Chowbus / generic still useful to merge into Gemini text
  const best = [chowbus, generic].sort((a, b) => b.length - a.length)[0] || []
  return {
    items: best,
    platform: best.length ? 'partial' : 'none',
    confidence: best.length ? 'low' : 'none',
  }
}

/**
 * Full extract including HonorMenu HTTP API when host matches.
 */
export async function extractStructuredMenu({ url = '', html = '', fetchImpl = fetch } = {}) {
  let hostname = ''
  try {
    hostname = new URL(url || 'https://example.com').hostname
  } catch {
    hostname = ''
  }

  if (isHonorMenuHost(hostname)) {
    const honor = await fetchHonorMenuItems(url, fetchImpl)
    if (honor.length >= STRUCTURED_MIN_ITEMS) {
      return { items: honor, platform: 'honormenu', confidence: 'high' }
    }
  }

  return extractStructuredMenuFromHtml({ url, html })
}
