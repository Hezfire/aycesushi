/**
 * GET /api/leaderboard/recent?limit=5 — recent high scores across restaurants.
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
    const url = new URL(req.url, 'http://localhost')
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 5))

    const rows = await sql`
      SELECT
        m.id,
        m.beat_buffet_by,
        m.completed_at,
        r.id AS restaurant_id,
        r.name AS restaurant_name,
        r.city,
        r.state
      FROM meal_sessions m
      JOIN restaurants r ON r.id = m.restaurant_id
      WHERE m.beat_buffet_by > 0
      ORDER BY m.completed_at DESC
      LIMIT ${limit}
    `

    sendJson(res, 200, {
      entries: rows.map((row) => ({
        id: row.id,
        beatBuffetBy: Number(row.beat_buffet_by),
        completedAt: row.completed_at,
        restaurantId: row.restaurant_id,
        restaurantName: row.restaurant_name,
        city: row.city,
        state: row.state,
      })),
    })
  } catch (err) {
    const message = err?.message || 'Could not load recent records.'
    const status = /DATABASE_URL|not configured/i.test(message) ? 503 : 502
    sendJson(res, status, { error: message })
  }
}
