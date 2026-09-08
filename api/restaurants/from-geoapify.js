/**
 * POST /api/restaurants/from-geoapify
 * Find-or-create a WorthBite restaurant from a Geoapify place snapshot.
 */

import {
  checkRateLimit,
  ensureSchema,
  getSql,
  readJsonBody,
  sendJson,
} from '../_lib/db.js'
import { mapRestaurant } from '../_lib/restaurants.js'
import {
  GEOAPIFY_PROVIDER,
  mapGeoapifyPlace,
  restaurantDraftFromGeoapify,
} from '../_lib/geoapify.js'

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
    sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' })
    return
  }

  try {
    await ensureSchema()
    const sql = getSql()
    const body = await readJsonBody(req)

    const mapped = mapGeoapifyPlace({
      place_id: body.externalPlaceId || body.placeId,
      name: body.name,
      city: body.city,
      state: body.state,
      state_code: body.state,
      country: body.country,
      country_code: body.country,
      formatted: body.formattedAddress,
      lat: body.latitude,
      lon: body.longitude,
      category: body.category,
      result_type: body.resultType || 'amenity',
    })

    if (!mapped?.externalPlaceId) {
      sendJson(res, 400, { error: 'externalPlaceId is required.' })
      return
    }
    if (!mapped.name || !mapped.city) {
      sendJson(res, 400, { error: 'name and city are required.' })
      return
    }

    const byExternal = await sql`
      SELECT
        id, name, city, state, google_place_id,
        external_provider, external_place_id, formatted_address,
        latitude, longitude, ayce_price_default, created_at
      FROM restaurants
      WHERE external_provider = ${GEOAPIFY_PROVIDER}
        AND external_place_id = ${mapped.externalPlaceId}
      LIMIT 1
    `
    if (byExternal.length) {
      sendJson(res, 200, { restaurant: mapRestaurant(byExternal[0]), created: false })
      return
    }

    const draft = restaurantDraftFromGeoapify(mapped)

    const byNorm = await sql`
      SELECT
        id, name, city, state, google_place_id,
        external_provider, external_place_id, formatted_address,
        latitude, longitude, ayce_price_default, created_at
      FROM restaurants
      WHERE name_norm = ${draft.nameNorm}
        AND city_norm = ${draft.cityNorm}
        AND state_norm = ${draft.stateNorm}
      LIMIT 1
    `
    if (byNorm.length) {
      const updated = await sql`
        UPDATE restaurants
        SET
          external_provider = COALESCE(external_provider, ${draft.externalProvider}),
          external_place_id = COALESCE(external_place_id, ${draft.externalPlaceId}),
          formatted_address = COALESCE(formatted_address, ${draft.formattedAddress}),
          latitude = COALESCE(latitude, ${draft.latitude}),
          longitude = COALESCE(longitude, ${draft.longitude})
        WHERE id = ${byNorm[0].id}
        RETURNING
          id, name, city, state, google_place_id,
          external_provider, external_place_id, formatted_address,
          latitude, longitude, ayce_price_default, created_at
      `
      sendJson(res, 200, { restaurant: mapRestaurant(updated[0]), created: false })
      return
    }

    const inserted = await sql`
      INSERT INTO restaurants (
        name, city, state, name_norm, city_norm, state_norm,
        external_provider, external_place_id, formatted_address, latitude, longitude
      )
      VALUES (
        ${draft.name},
        ${draft.city},
        ${draft.state},
        ${draft.nameNorm},
        ${draft.cityNorm},
        ${draft.stateNorm},
        ${draft.externalProvider},
        ${draft.externalPlaceId},
        ${draft.formattedAddress},
        ${draft.latitude},
        ${draft.longitude}
      )
      RETURNING
        id, name, city, state, google_place_id,
        external_provider, external_place_id, formatted_address,
        latitude, longitude, ayce_price_default, created_at
    `
    sendJson(res, 201, { restaurant: mapRestaurant(inserted[0]), created: true })
  } catch (err) {
    const message = err?.message || 'Could not import Geoapify restaurant.'
    const status = /DATABASE_URL|not configured/i.test(message)
      ? 503
      : /rate limit/i.test(message)
        ? 429
        : /unique|duplicate/i.test(message)
          ? 409
          : 502
    sendJson(res, status, { error: message })
  }
}
