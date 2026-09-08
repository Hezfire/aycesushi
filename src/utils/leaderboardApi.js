/**
 * Client helpers for leaderboard / restaurant APIs.
 */

export async function submitLeaderboardScore(payload) {
  const response = await fetch('/api/leaderboard/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not submit to the leaderboard.')
  }
  return data
}

export async function fetchLeaderboard(restaurantId, limit = 25) {
  const params = new URLSearchParams({
    restaurantId: String(restaurantId),
    limit: String(limit),
  })
  const response = await fetch(`/api/leaderboard?${params}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not load the leaderboard.')
  }
  return data
}

export async function fetchRestaurant(restaurantId) {
  const response = await fetch(`/api/restaurants/${encodeURIComponent(restaurantId)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Could not load restaurant.')
  }
  return data
}
