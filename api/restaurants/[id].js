/**
 * GET /api/restaurants/:id
 * Restaurant detail + top 3 leaderboard preview.
 */

import { ensureSchema, getSql, sendJson } from '../_lib/db.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Use GET.' })
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()

    // Vercel dynamic: /api/restaurants/:id — parse from URL
    const url = new URL(req.url, 'http://localhost')
    const parts = url.pathname.split('/').filter(Boolean)
    // ["api", "restaurants", ":id"] or ["restaurants", ":id"] depending on runtime
    const id = decodeURIComponent(parts[parts.length - 1] || '').trim()

    if (!id || id === 'restaurants') {
      sendJson(res, 400, { error: 'Restaurant id is required.' })
      return
    }

    const restaurants = await sql`
      SELECT id, name, city, state, google_place_id, ayce_price_default, created_at
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
      SELECT COUNT(*)::int AS count
      FROM meal_sessions
      WHERE restaurant_id = ${id}::uuid
    `

    sendJson(res, 200, {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        city: restaurant.city,
        state: restaurant.state,
        googlePlaceId: restaurant.google_place_id,
        aycePriceDefault:
          restaurant.ayce_price_default != null ? Number(restaurant.ayce_price_default) : null,
        createdAt: restaurant.created_at,
      },
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
      entryCount: countRows[0]?.count || 0,
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
