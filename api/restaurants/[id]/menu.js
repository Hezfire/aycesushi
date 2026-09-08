/**
 * GET /api/restaurants/:id/menu
 * PUT /api/restaurants/:id/menu — replace restaurant menu items
 */

import {
  checkRateLimit,
  ensureSchema,
  getSql,
  readJsonBody,
  sendJson,
} from '../../_lib/db.js'
import { mapMenuItem } from '../../_lib/restaurants.js'

function parseRestaurantId(req) {
  const url = new URL(req.url, 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  // api/restaurants/:id/menu
  const restaurantsIdx = parts.findIndex((p) => p === 'restaurants')
  if (restaurantsIdx >= 0 && parts[restaurantsIdx + 1]) {
    return decodeURIComponent(parts[restaurantsIdx + 1]).trim()
  }
  return ''
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()
    const id = parseRestaurantId(req)
    if (!id) {
      sendJson(res, 400, { error: 'Restaurant id is required.' })
      return
    }

    const restaurants = await sql`
      SELECT id FROM restaurants WHERE id = ${id}::uuid LIMIT 1
    `
    if (!restaurants.length) {
      sendJson(res, 404, { error: 'Restaurant not found.' })
      return
    }

    if (req.method === 'GET') {
      const items = await sql`
        SELECT id, restaurant_id, name, category, estimated_value, pricing_unit, source, created_at
        FROM menu_items
        WHERE restaurant_id = ${id}::uuid
        ORDER BY category ASC, name ASC
      `
      sendJson(res, 200, {
        restaurantId: id,
        items: items.map(mapMenuItem),
      })
      return
    }

    if (req.method === 'PUT') {
      if (!checkRateLimit(req)) {
        sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' })
        return
      }
      const body = await readJsonBody(req)
      const rawItems = Array.isArray(body.items) ? body.items : []
      if (!rawItems.length) {
        sendJson(res, 400, { error: 'Provide at least one menu item.' })
        return
      }
      if (rawItems.length > 400) {
        sendJson(res, 400, { error: 'Menu is too large.' })
        return
      }

      const cleaned = []
      for (const item of rawItems) {
        const name = String(item.name || '').replace(/\s+/g, ' ').trim()
        const value = Number(item.estimatedValue ?? item.pricePerPiece)
        if (!name || name.length > 120) continue
        if (!Number.isFinite(value) || value < 0 || value > 500) continue
        cleaned.push({
          name,
          category: String(item.category || 'Other').slice(0, 40) || 'Other',
          estimatedValue: Math.round(value * 100) / 100,
          pricingUnit: String(item.pricingUnit || 'piece').slice(0, 20) || 'piece',
          source: String(item.source || 'import').slice(0, 20) || 'import',
        })
      }
      if (!cleaned.length) {
        sendJson(res, 400, { error: 'No valid menu items to save.' })
        return
      }

      await sql`DELETE FROM menu_items WHERE restaurant_id = ${id}::uuid`
      for (const item of cleaned) {
        await sql`
          INSERT INTO menu_items (
            restaurant_id, name, category, estimated_value, pricing_unit, source
          )
          VALUES (
            ${id}::uuid,
            ${item.name},
            ${item.category},
            ${item.estimatedValue},
            ${item.pricingUnit},
            ${item.source}
          )
        `
      }

      const items = await sql`
        SELECT id, restaurant_id, name, category, estimated_value, pricing_unit, source, created_at
        FROM menu_items
        WHERE restaurant_id = ${id}::uuid
        ORDER BY category ASC, name ASC
      `
      sendJson(res, 200, {
        restaurantId: id,
        items: items.map(mapMenuItem),
      })
      return
    }

    sendJson(res, 405, { error: 'Use GET or PUT.' })
  } catch (err) {
    const message = err?.message || 'Menu request failed.'
    const status = /DATABASE_URL|not configured/i.test(message)
      ? 503
      : /invalid input syntax for type uuid/i.test(message)
        ? 404
        : 502
    sendJson(res, status, { error: message })
  }
}
