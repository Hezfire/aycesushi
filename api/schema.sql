-- WorthBite leaderboard + restaurant menus (Neon Postgres)
-- Applied automatically on first API request via api/_lib/db.js

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  google_place_id TEXT UNIQUE,
  ayce_price_default NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name_norm TEXT NOT NULL,
  city_norm TEXT NOT NULL,
  state_norm TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_norm_unique
  ON restaurants (name_norm, city_norm, state_norm);

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
);

CREATE INDEX IF NOT EXISTS meal_sessions_leaderboard_idx
  ON meal_sessions (restaurant_id, beat_buffet_by DESC, total_menu_value_eaten DESC, completed_at ASC);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  estimated_value NUMERIC(10, 2) NOT NULL,
  pricing_unit TEXT NOT NULL DEFAULT 'piece',
  source TEXT NOT NULL DEFAULT 'estimate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_name_unique
  ON menu_items (restaurant_id, lower(name));
