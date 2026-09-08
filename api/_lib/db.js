/**
 * Neon Postgres helper for WorthBite leaderboard APIs.
 */

import { neon } from '@neondatabase/serverless'

let sqlClient = null
let schemaReady = false

export function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) {
    throw new Error(
      'Leaderboard database is not configured. Set DATABASE_URL (Neon) on the server.',
    )
  }
  if (!sqlClient) sqlClient = neon(url)
  return sqlClient
}

export async function ensureSchema() {
  if (schemaReady) return
  const sql = getSql()
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`
  await sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      google_place_id TEXT UNIQUE,
      external_provider TEXT,
      external_place_id TEXT,
      formatted_address TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      ayce_price_default NUMERIC(10, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name_norm TEXT NOT NULL,
      city_norm TEXT NOT NULL,
      state_norm TEXT NOT NULL
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS restaurants_norm_unique
      ON restaurants (name_norm, city_norm, state_norm)
  `
  await sql`
    CREATE TABLE IF NOT EXISTS meal_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      client_meal_id TEXT NOT NULL UNIQUE,
      visitor_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      ayce_price_paid NUMERIC(10, 2) NOT NULL,
      total_menu_value_eaten NUMERIC(10, 2) NOT NULL,
      beat_buffet_by NUMERIC(10, 2) NOT NULL,
      pieces_eaten INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS meal_sessions_leaderboard_idx
      ON meal_sessions (
        restaurant_id,
        beat_buffet_by DESC,
        total_menu_value_eaten DESC,
        completed_at ASC
      )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      estimated_value NUMERIC(10, 2) NOT NULL,
      pricing_unit TEXT NOT NULL DEFAULT 'piece',
      source TEXT NOT NULL DEFAULT 'estimate',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_name_unique
      ON menu_items (restaurant_id, lower(name))
  `
  // Existing DBs: add Geoapify / external place columns safely
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS external_provider TEXT`
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS external_place_id TEXT`
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS formatted_address TEXT`
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS restaurants_external_place_unique
      ON restaurants (external_provider, external_place_id)
      WHERE external_provider IS NOT NULL AND external_place_id IS NOT NULL
  `
  schemaReady = true
}

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req) {
  if (req.body != null) {
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {}
    }
    return req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

const rateBuckets = new Map()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20

export function checkRateLimit(req) {
  const forwarded = req.headers?.['x-forwarded-for']
  const ip =
    (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) ||
    req.socket?.remoteAddress ||
    'unknown'
  const now = Date.now()
  const bucket = rateBuckets.get(ip) || { count: 0, start: now }
  if (now - bucket.start > RATE_WINDOW_MS) {
    bucket.count = 0
    bucket.start = now
  }
  bucket.count += 1
  rateBuckets.set(ip, bucket)
  return bucket.count <= RATE_MAX
}
