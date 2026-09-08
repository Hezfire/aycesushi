/**
 * POST /api/leaderboard/submit
 * Submit a completed meal to a restaurant leaderboard.
 */

import {
  checkRateLimit,
  ensureSchema,
  getSql,
  readJsonBody,
  sendJson,
} from '../_lib/db.js'
import {
  sanitizeDisplayName,
  sanitizeRestaurantInput,
  validateMealNumbers,
} from '../_lib/leaderboard.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' })
    return
  }

  if (!checkRateLimit(req)) {
    sendJson(res, 429, { error: 'Too many submissions. Please wait a minute.' })
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()
    const body = await readJsonBody(req)

    const clientMealId = String(body.clientMealId || '').trim()
    const visitorId = String(body.visitorId || '').trim()
    if (!clientMealId || clientMealId.length > 80) {
      sendJson(res, 400, { error: 'Missing meal id. Finish a meal in the app first.' })
      return
    }
    if (!visitorId || visitorId.length > 80) {
      sendJson(res, 400, { error: 'Missing visitor id.' })
      return
    }

    const nameResult = sanitizeDisplayName(body.displayName)
    if (!nameResult.ok) {
      sendJson(res, 400, { error: nameResult.error })
      return
    }

    const placeResult = sanitizeRestaurantInput(body.restaurant)
    if (!placeResult.ok) {
      sendJson(res, 400, { error: placeResult.error })
      return
    }

    const mealResult = validateMealNumbers({
      aycePricePaid: body.aycePricePaid,
      totalMenuValueEaten: body.totalMenuValueEaten,
      piecesEaten: body.piecesEaten,
    })
    if (!mealResult.ok) {
      sendJson(res, 400, { error: mealResult.error })
      return
    }

    const existing = await sql`
      SELECT id FROM meal_sessions WHERE client_meal_id = ${clientMealId} LIMIT 1
    `
    if (existing.length) {
      sendJson(res, 409, { error: 'This meal was already added to the leaderboard.' })
      return
    }

    const place = placeResult.value
    let restaurantRows = await sql`
      SELECT id, name, city, state, google_place_id, ayce_price_default, created_at
      FROM restaurants
      WHERE name_norm = ${place.nameNorm}
        AND city_norm = ${place.cityNorm}
        AND state_norm = ${place.stateNorm}
      LIMIT 1
    `

    if (!restaurantRows.length) {
      restaurantRows = await sql`
        INSERT INTO restaurants (name, city, state, name_norm, city_norm, state_norm)
        VALUES (
          ${place.name},
          ${place.city},
          ${place.state},
          ${place.nameNorm},
          ${place.cityNorm},
          ${place.stateNorm}
        )
        RETURNING id, name, city, state, google_place_id, ayce_price_default, created_at
      `
    }

    const restaurant = restaurantRows[0]
    const meal = mealResult.value

    const inserted = await sql`
      INSERT INTO meal_sessions (
        restaurant_id,
        client_meal_id,
        visitor_id,
        display_name,
        ayce_price_paid,
        total_menu_value_eaten,
        beat_buffet_by,
        pieces_eaten
      )
      VALUES (
        ${restaurant.id},
        ${clientMealId},
        ${visitorId},
        ${nameResult.value},
        ${meal.aycePricePaid},
        ${meal.totalMenuValueEaten},
        ${meal.beatBuffetBy},
        ${meal.piecesEaten}
      )
      RETURNING
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
    `

    const entry = inserted[0]

    const rankRows = await sql`
      SELECT 1 + COUNT(*)::int AS rank
      FROM meal_sessions
      WHERE restaurant_id = ${restaurant.id}
        AND (
          beat_buffet_by > ${entry.beat_buffet_by}
          OR (
            beat_buffet_by = ${entry.beat_buffet_by}
            AND total_menu_value_eaten > ${entry.total_menu_value_eaten}
          )
          OR (
            beat_buffet_by = ${entry.beat_buffet_by}
            AND total_menu_value_eaten = ${entry.total_menu_value_eaten}
            AND completed_at < ${entry.completed_at}
          )
        )
    `

    sendJson(res, 200, {
      entry: mapEntry(entry),
      rank: rankRows[0]?.rank || 1,
      restaurant: mapRestaurant(restaurant),
    })
  } catch (err) {
    const message = err?.message || 'Submit failed.'
    const status = /DATABASE_URL|not configured/i.test(message)
      ? 503
      : /JSON/i.test(message)
        ? 400
        : 502
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
