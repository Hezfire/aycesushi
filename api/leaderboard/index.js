/**
 * GET /api/leaderboard?restaurantId=&limit=25
 * Top leaderboard rows + summary stats for one restaurant.
 */

import { ensureSchema, getSql, sendJson } from '../_lib/db.js'
import { summarizeLeaderboard } from '../_lib/leaderboard.js'

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
    const url = new URL(req.url, 'http://localhost')
    const restaurantId = String(url.searchParams.get('restaurantId') || '').trim()
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 25))

    if (!restaurantId) {
      sendJson(res, 400, { error: 'restaurantId is required.' })
      return
    }

    const restaurants = await sql`
      SELECT id, name, city, state, google_place_id, ayce_price_default, created_at
      FROM restaurants
      WHERE id = ${restaurantId}::uuid
      LIMIT 1
    `
    if (!restaurants.length) {
      sendJson(res, 404, { error: 'Restaurant not found.' })
      return
    }

    const restaurant = restaurants[0]

    const entries = await sql`
      SELECT
        id,
        restaurant_id,
        client_meal_id,
        visitor_id,
        display_name,
        ayce_price_paid,
        total_menu_value_eaten,
        beat_buffet_by,
        pieces_eaten,
        completed_at,
        created_at
      FROM meal_sessions
      WHERE restaurant_id = ${restaurantId}::uuid
      ORDER BY beat_buffet_by DESC, total_menu_value_eaten DESC, completed_at ASC
      LIMIT ${limit}
    `

    const statsRows = await sql`
      SELECT
        COUNT(*)::int AS count,
        MAX(beat_buffet_by) AS top,
        AVG(beat_buffet_by) AS avg_beat,
        AVG(total_menu_value_eaten) AS avg_value
      FROM meal_sessions
      WHERE restaurant_id = ${restaurantId}::uuid
    `

    const statsRaw = statsRows[0] || {}
    const mappedEntries = entries.map(mapEntry)
    const summary =
      Number(statsRaw.count) > 0
        ? {
            top: Number(statsRaw.top),
            avgBeat: Math.round(Number(statsRaw.avg_beat) * 100) / 100,
            avgValue: Math.round(Number(statsRaw.avg_value) * 100) / 100,
            count: Number(statsRaw.count),
          }
        : summarizeLeaderboard([])

    sendJson(res, 200, {
      restaurant: mapRestaurant(restaurant),
      entries: mappedEntries,
      stats: summary,
    })
  } catch (err) {
    const message = err?.message || 'Could not load leaderboard.'
    const status = /DATABASE_URL|not configured/i.test(message) ? 503 : 502
    sendJson(res, status, { error: message })
  }
}

function mapRestaurant(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    googlePlaceId: row.google_place_id,
    aycePriceDefault: row.ayce_price_default != null ? Number(row.ayce_price_default) : null,
    createdAt: row.created_at,
  }
}

function mapEntry(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    clientMealId: row.client_meal_id,
    visitorId: row.visitor_id,
    displayName: row.display_name,
    aycePricePaid: Number(row.ayce_price_paid),
    totalMenuValueEaten: Number(row.total_menu_value_eaten),
    beatBuffetBy: Number(row.beat_buffet_by),
    piecesEaten: Number(row.pieces_eaten),
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}
