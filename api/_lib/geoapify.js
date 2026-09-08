/**
 * Geoapify Places / Autocomplete helpers for restaurant discovery.
 * API key stays server-side (GEOAPIFY_API_KEY).
 */

import { normalizePlacePart } from './leaderboard.js'

export const GEOAPIFY_PROVIDER = 'geoapify'
export const GEOAPIFY_MIN_TERM_LENGTH = 3
export const GEOAPIFY_RESULT_LIMIT = 8

const searchCache = new Map()
const SEARCH_CACHE_TTL_MS = 5 * 60_000
const SEARCH_CACHE_MAX = 80

export function isGeoapifyEnabled() {
  return Boolean(String(process.env.GEOAPIFY_API_KEY || '').trim())
}

/**
 * Split a free-text query into term + optional location hint.
 * "Hanami, Austin" → { term: "Hanami", locationHint: "Austin" }
 */
export function parseRestaurantQuery(rawQuery = '', locationParam = '') {
  const location = String(locationParam || '')
    .trim()
    .replace(/\s+/g, ' ')
  let q = String(rawQuery || '')
    .trim()
    .replace(/\s+/g, ' ')

  let term = q
  let locationHint = location

  if (!locationHint && q.includes(',')) {
    const parts = q.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      term = parts[0]
      locationHint = parts.slice(1).join(', ')
    }
  }

  return { term, locationHint }
}

function cacheKey(term, location) {
  return `${term.toLowerCase()}|${location.toLowerCase()}`
}

function getCachedSearch(term, location) {
  const key = cacheKey(term, location)
  const hit = searchCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    searchCache.delete(key)
    return null
  }
  return hit.value
}

function setCachedSearch(term, location, value) {
  if (searchCache.size >= SEARCH_CACHE_MAX) {
    const oldest = searchCache.keys().next().value
    searchCache.delete(oldest)
  }
  searchCache.set(cacheKey(term, location), {
    value,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  })
}

/** @internal test helper */
export function clearGeoapifySearchCache() {
  searchCache.clear()
}

function propsFromFeature(feature) {
  if (!feature) return null
  if (feature.properties) return feature.properties
  return feature
}

function isFoodServiceCategory(category) {
  const c = String(category || '').toLowerCase()
  return (
    c.startsWith('catering') ||
    c.includes('restaurant') ||
    c.includes('sushi') ||
    c.includes('food_court') ||
    c.includes('fast_food')
  )
}

/**
 * Map a Geoapify autocomplete / geocode feature to a normalized place draft.
 */
export function mapGeoapifyPlace(feature) {
  const p = propsFromFeature(feature)
  if (!p) return null

  const placeId = String(p.place_id || p.placeId || '').trim()
  const name = String(p.name || p.address_line1 || '').trim()
  const city = String(p.city || p.town || p.village || p.municipality || p.county || '').trim()
  if (!placeId || !name || !city) return null

  const state = String(p.state_code || p.state || '').trim() || 'NA'
  const country = String(p.country_code || p.country || '').trim().toUpperCase() || null
  const lat = p.lat != null ? Number(p.lat) : null
  const lon = p.lon != null ? Number(p.lon) : p.lng != null ? Number(p.lng) : null
  const formatted =
    String(p.formatted || p.address_line2 || '').trim() ||
    [name, city, state].filter(Boolean).join(', ')

  const category = p.category || (Array.isArray(p.categories) ? p.categories[0] : null)
  const resultType = String(p.result_type || '').toLowerCase()

  return {
    externalPlaceId: placeId,
    externalProvider: GEOAPIFY_PROVIDER,
    name,
    formattedAddress: formatted,
    city,
    state,
    country,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    category: category || null,
    resultType: resultType || null,
    isFoodService:
      isFoodServiceCategory(category) ||
      resultType === 'amenity' ||
      (Array.isArray(p.categories) && p.categories.some(isFoodServiceCategory)),
  }
}

export function filterGeoapifyAlreadyInNeon(suggestions, neonRestaurants) {
  const externalIds = new Set(
    (neonRestaurants || [])
      .filter(
        (r) =>
          (r.externalProvider || r.external_provider) === GEOAPIFY_PROVIDER &&
          (r.externalPlaceId || r.external_place_id),
      )
      .map((r) => r.externalPlaceId || r.external_place_id),
  )
  const norms = new Set(
    (neonRestaurants || []).map(
      (r) =>
        `${normalizePlacePart(r.name)}|${normalizePlacePart(r.city)}|${normalizePlacePart(r.state)}`,
    ),
  )
  return (suggestions || []).filter((s) => {
    if (externalIds.has(s.externalPlaceId)) return false
    const key = `${normalizePlacePart(s.name)}|${normalizePlacePart(s.city)}|${normalizePlacePart(s.state)}`
    return !norms.has(key)
  })
}

function preferFoodService(a, b) {
  if (a.isFoodService !== b.isFoodService) return a.isFoodService ? -1 : 1
  return 0
}

/**
 * Search restaurants/places via Geoapify Address Autocomplete (amenity-biased).
 * Uses one credit per call; results cached briefly server-side.
 */
export async function searchGeoapifyPlaces({
  term,
  location,
  limit = GEOAPIFY_RESULT_LIMIT,
  fetchImpl = fetch,
} = {}) {
  const apiKey = String(process.env.GEOAPIFY_API_KEY || '').trim()
  if (!apiKey) return []

  const t = String(term || '').trim()
  const loc = String(location || '').trim()
  if (t.length < GEOAPIFY_MIN_TERM_LENGTH || !loc) return []

  const cached = getCachedSearch(t, loc)
  if (cached) return cached

  const text = `${t}, ${loc}`
  const params = new URLSearchParams({
    text,
    type: 'amenity',
    limit: String(Math.min(20, Math.max(1, limit))),
    format: 'json',
    apiKey,
  })

  const response = await fetchImpl(
    `https://api.geoapify.com/v1/geocode/autocomplete?${params}`,
    { headers: { Accept: 'application/json' } },
  )

  if (response.status === 429) {
    throw new Error('Geoapify rate limit reached. Try again later or add the restaurant manually.')
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Geoapify search failed (HTTP ${response.status}). ${body.slice(0, 120)}`.trim(),
    )
  }

  const data = await response.json()
  const results = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.features)
      ? data.features
      : []

  const mapped = results
    .map(mapGeoapifyPlace)
    .filter(Boolean)
    .sort(preferFoodService)
    .slice(0, Math.min(20, Math.max(1, limit)))

  setCachedSearch(t, loc, mapped)
  return mapped
}

export function restaurantDraftFromGeoapify(mapped) {
  return {
    name: mapped.name,
    city: mapped.city,
    state: mapped.state || 'NA',
    nameNorm: normalizePlacePart(mapped.name),
    cityNorm: normalizePlacePart(mapped.city),
    stateNorm: normalizePlacePart(mapped.state || 'NA'),
    externalProvider: GEOAPIFY_PROVIDER,
    externalPlaceId: mapped.externalPlaceId,
    formattedAddress: mapped.formattedAddress || null,
    latitude: mapped.latitude,
    longitude: mapped.longitude,
  }
}
