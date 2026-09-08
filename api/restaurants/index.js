/**
 * GET /api/restaurants?q=&location=&limit= — Neon search + optional Geoapify suggestions
 * POST /api/restaurants — create manual restaurant
 */

import {
  checkRateLimit,
  ensureSchema,
  getSql,
  readJsonBody,
  sendJson,
} from '../_lib/db.js'
import { sanitizeRestaurantInput } from '../_lib/leaderboard.js'
import { mapRestaurant } from '../_lib/restaurants.js'
import {
  filterGeoapifyAlreadyInNeon,
  GEOAPIFY_MIN_TERM_LENGTH,
  isGeoapifyEnabled,
  parseRestaurantQuery,
  searchGeoapifyPlaces,
} from '../_lib/geoapify.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()

    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost')
      const rawQ = String(url.searchParams.get('q') || '').trim()
      const locationParam = String(url.searchParams.get('location') || '').trim()
      const { term, locationHint } = parseRestaurantQuery(rawQ, locationParam)
      const q = term.toLowerCase().replace(/\s+/g, ' ')
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20))
      const pattern = q ? `%${q}%` : '%'

      const rows = q
        ? await sql`
            SELECT
              r.id,
              r.name,
              r.city,
              r.state,
              r.google_place_id,
              r.external_provider,
              r.external_place_id,
              r.formatted_address,
              r.latitude,
              r.longitude,
              r.ayce_price_default,
              r.created_at,
              COALESCE(stats.entry_count, 0)::int AS entry_count,
              stats.top_beat
            FROM restaurants r
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*)::int AS entry_count,
                MAX(beat_buffet_by) AS top_beat
              FROM meal_sessions m
              WHERE m.restaurant_id = r.id
            ) stats ON TRUE
            WHERE
              r.name_norm LIKE ${pattern}
              OR r.city_norm LIKE ${pattern}
              OR r.name ILIKE ${pattern}
            ORDER BY
              CASE WHEN stats.entry_count > 0 THEN 0 ELSE 1 END,
              r.name ASC
            LIMIT ${limit}
          `
        : await sql`
            SELECT
              r.id,
              r.name,
              r.city,
              r.state,
              r.google_place_id,
              r.external_provider,
              r.external_place_id,
              r.formatted_address,
              r.latitude,
              r.longitude,
              r.ayce_price_default,
              r.created_at,
              COALESCE(stats.entry_count, 0)::int AS entry_count,
              stats.top_beat
            FROM restaurants r
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*)::int AS entry_count,
                MAX(beat_buffet_by) AS top_beat
              FROM meal_sessions m
              WHERE m.restaurant_id = r.id
            ) stats ON TRUE
            ORDER BY
              CASE WHEN stats.entry_count > 0 THEN 0 ELSE 1 END,
              r.name ASC
            LIMIT ${limit}
          `

      const restaurants = rows.map((row) =>
        mapRestaurant(row, {
          entryCount: Number(row.entry_count) || 0,
          topScore: row.top_beat != null ? Number(row.top_beat) : null,
        }),
      )

      let placeSuggestions = []
      let placesError = null
      const placesEnabled = isGeoapifyEnabled()
      const canSearchPlaces =
        placesEnabled &&
        term.length >= GEOAPIFY_MIN_TERM_LENGTH &&
        Boolean(locationHint) &&
        checkRateLimit(req)

      if (placesEnabled && term.length >= GEOAPIFY_MIN_TERM_LENGTH && !locationHint) {
        placesError = 'Enter a city or location to search places.'
      } else if (canSearchPlaces) {
        try {
          const hits = await searchGeoapifyPlaces({
            term,
            location: locationHint,
            limit: 8,
          })
          placeSuggestions = filterGeoapifyAlreadyInNeon(hits, restaurants)
        } catch (err) {
          placesError = err?.message || 'Place search failed.'
        }
      }

      sendJson(res, 200, {
        restaurants,
        placeSuggestions,
        placesEnabled,
        placesError,
      })
      return
    }

    if (req.method === 'POST') {
      if (!checkRateLimit(req)) {
        sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' })
        return
      }
      const body = await readJsonBody(req)
      const placeResult = sanitizeRestaurantInput(body)
      if (!placeResult.ok) {
        sendJson(res, 400, { error: placeResult.error })
        return
      }
      const place = placeResult.value
      let aycePriceDefault = null
      if (body.aycePriceDefault != null && body.aycePriceDefault !== '') {
        const n = Number(body.aycePriceDefault)
        if (!Number.isFinite(n) || n <= 0 || n > 5000) {
          sendJson(res, 400, { error: 'AYCE price must be a positive number.' })
          return
        }
        aycePriceDefault = Math.round(n * 100) / 100
      }

      const existing = await sql`
        SELECT
          id, name, city, state, google_place_id,
          external_provider, external_place_id, formatted_address,
          latitude, longitude, ayce_price_default, created_at
        FROM restaurants
        WHERE name_norm = ${place.nameNorm}
          AND city_norm = ${place.cityNorm}
          AND state_norm = ${place.stateNorm}
        LIMIT 1
      `
      if (existing.length) {
        sendJson(res, 200, { restaurant: mapRestaurant(existing[0]), created: false })
        return
      }

      const inserted = await sql`
        INSERT INTO restaurants (
          name, city, state, name_norm, city_norm, state_norm, ayce_price_default
        )
        VALUES (
          ${place.name},
          ${place.city},
          ${place.state},
          ${place.nameNorm},
          ${place.cityNorm},
          ${place.stateNorm},
          ${aycePriceDefault}
        )
        RETURNING
          id, name, city, state, google_place_id,
          external_provider, external_place_id, formatted_address,
          latitude, longitude, ayce_price_default, created_at
      `
      sendJson(res, 201, { restaurant: mapRestaurant(inserted[0]), created: true })
      return
    }

    sendJson(res, 405, { error: 'Use GET or POST.' })
  } catch (err) {
    const message = err?.message || 'Restaurant request failed.'
    const status = /DATABASE_URL|not configured/i.test(message) ? 503 : 502
    sendJson(res, status, { error: message })
  }
}
