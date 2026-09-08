/**
 * GET /api/restaurants/:id — restaurant detail + top 3
 * PATCH /api/restaurants/:id — update ayce_price_default
 */

import {
  checkRateLimit,
  ensureSchema,
  getSql,
  readJsonBody,
  sendJson,
} from '../_lib/db.js'
import { mapRestaurant } from '../_lib/restaurants.js'

function parseId(req) {
  const url = new URL(req.url, 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  const id = decodeURIComponent(parts[parts.length - 1] || '').trim()
  if (!id || id === 'restaurants') return ''
  return id
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()
    const id = parseId(req)

    if (!id) {
      sendJson(res, 400, { error: 'Restaurant id is required.' })
      return
    }

    if (req.method === 'PATCH') {
      if (!checkRateLimit(req)) {
        sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' })
        return
      }
      const body = await readJsonBody(req)
      const n = Number(body.aycePriceDefault)
      if (!Number.isFinite(n) || n <= 0 || n > 5000) {
        sendJson(res, 400, { error: 'AYCE price must be a positive number.' })
        return
      }
      const price = Math.round(n * 100) / 100
      const updated = await sql`
        UPDATE restaurants
        SET ayce_price_default = ${price}
        WHERE id = ${id}::uuid
        RETURNING
          id, name, city, state, google_place_id,
          external_provider, external_place_id, formatted_address,
          latitude, longitude, ayce_price_default, created_at
      `
      if (!updated.length) {
        sendJson(res, 404, { error: 'Restaurant not found.' })
        return
      }
      sendJson(res, 200, { restaurant: mapRestaurant(updated[0]) })
      return
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Use GET or PATCH.' })
      return
    }

    const restaurants = await sql`
      SELECT
        id, name, city, state, google_place_id,
        external_provider, external_place_id, formatted_address,
        latitude, longitude, ayce_price_default, created_at
      FROM restaurants
      WHERE id = ${id}::uuid
      LIMIT 1
    `
    if (!restaurants.length) {
      sendJson(res, 404, { error: 'Restaurant not found.' })
      return
    }

    const restaurant = restaurants[0]
    const top = await sql`
      SELECT
        id,
        restaurant_id,
        visitor_id,
        display_name,
        ayce_price_paid,
        total_menu_value_eaten,
        beat_buffet_by,
        pieces_eaten,
        completed_at
      FROM meal_sessions
      WHERE restaurant_id = ${id}::uuid
      ORDER BY beat_buffet_by DESC, total_menu_value_eaten DESC, completed_at ASC
      LIMIT 3
    `

    const countRows = await sql`
      SELECT COUNT(*)::int AS count, MAX(beat_buffet_by) AS top_beat
      FROM meal_sessions
      WHERE restaurant_id = ${id}::uuid
    `

    const entryCount = countRows[0]?.count || 0
    const topScore = countRows[0]?.top_beat != null ? Number(countRows[0].top_beat) : null

    sendJson(res, 200, {
      restaurant: mapRestaurant(restaurant, { entryCount, topScore }),
      topEntries: top.map((row, index) => ({
        id: row.id,
        restaurantId: row.restaurant_id,
        visitorId: row.visitor_id,
        displayName: row.display_name,
        aycePricePaid: Number(row.ayce_price_paid),
        totalMenuValueEaten: Number(row.total_menu_value_eaten),
        beatBuffetBy: Number(row.beat_buffet_by),
        piecesEaten: Number(row.pieces_eaten),
        completedAt: row.completed_at,
        rank: index + 1,
      })),
      entryCount,
      topScore,
    })
  } catch (err) {
    const message = err?.message || 'Could not load restaurant.'
    const status = /DATABASE_URL|not configured/i.test(message)
      ? 503
      : /invalid input syntax for type uuid/i.test(message)
        ? 404
        : 502
    sendJson(res, status, { error: message })
  }
}
