/**
 * Client helpers for restaurant search, create, menu, and recent records.
 */

export async function searchRestaurants(query, limit = 20, location = '') {
  const params = new URLSearchParams({
    q: String(query || ''),
    limit: String(limit),
  })
  if (location) params.set('location', String(location))
  const response = await fetch(`/api/restaurants?${params}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not search restaurants.')
  }
  return data
}

export async function createRestaurantFromGeoapify(payload) {
  const response = await fetch('/api/restaurants/from-geoapify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not import restaurant from places search.')
  }
  return data
}

export async function createRestaurant(payload) {
  const response = await fetch('/api/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not create restaurant.')
  }
  return data
}

export async function updateRestaurant(restaurantId, payload) {
  const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not update restaurant.')
  }
  return data
}

export async function fetchRestaurantMenu(restaurantId) {
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(restaurantId)}/menu`,
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not load menu.')
  }
  return data
}

export async function saveRestaurantMenu(restaurantId, items) {
  const response = await fetch(
    `/api/restaurants/${encodeURIComponent(restaurantId)}/menu`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    },
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not save menu.')
  }
  return data
}

export async function fetchRecentRecords(limit = 5) {
  const params = new URLSearchParams({ limit: String(limit) })
  const response = await fetch(`/api/leaderboard/recent?${params}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not load recent records.')
  }
  return data
}

export { fetchRestaurant } from './leaderboardApi'
