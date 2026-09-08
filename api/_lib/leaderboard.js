/**
 * Pure leaderboard helpers (validation, scoring, ranking) — easy to unit test.
 */

export function normalizePlacePart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function sanitizeDisplayName(raw) {
  const cleaned = String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return { ok: false, error: 'Enter a display name.' }
  if (cleaned.length > 30) return { ok: false, error: 'Display name must be 30 characters or fewer.' }
  return { ok: true, value: cleaned }
}

export function sanitizeRestaurantInput(restaurant = {}) {
  const name = String(restaurant.name || '').replace(/\s+/g, ' ').trim()
  const city = String(restaurant.city || '').replace(/\s+/g, ' ').trim()
  const state = String(restaurant.state || '').replace(/\s+/g, ' ').trim()
  if (!name || name.length > 80) return { ok: false, error: 'Enter a restaurant name.' }
  if (!city || city.length > 60) return { ok: false, error: 'Enter a city.' }
  if (!state || state.length > 40) return { ok: false, error: 'Enter a state.' }
  return {
    ok: true,
    value: {
      name,
      city,
      state,
      nameNorm: normalizePlacePart(name),
      cityNorm: normalizePlacePart(city),
      stateNorm: normalizePlacePart(state),
    },
  }
}

export function validateMealNumbers({ aycePricePaid, totalMenuValueEaten, piecesEaten }) {
  const paid = Number(aycePricePaid)
  const value = Number(totalMenuValueEaten)
  const pieces = Number(piecesEaten)

  if (!Number.isFinite(paid) || paid <= 0) {
    return { ok: false, error: 'AYCE price paid must be greater than zero.' }
  }
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, error: 'Total value eaten must be a valid non-negative number.' }
  }
  if (!Number.isFinite(pieces) || pieces < 0 || !Number.isInteger(pieces)) {
    return { ok: false, error: 'Pieces eaten must be a whole number ≥ 0.' }
  }
  if (paid > 5000 || value > 50000) {
    return { ok: false, error: 'Those meal numbers look unrealistic.' }
  }

  return {
    ok: true,
    value: {
      aycePricePaid: Math.round(paid * 100) / 100,
      totalMenuValueEaten: Math.round(value * 100) / 100,
      piecesEaten: pieces,
      beatBuffetBy: Math.round((value - paid) * 100) / 100,
    },
  }
}

export function calcBeatBuffetBy(totalMenuValueEaten, aycePricePaid) {
  return Math.round((Number(totalMenuValueEaten) - Number(aycePricePaid)) * 100) / 100
}

/** Sort for leaderboard: beat DESC, value DESC, completed_at ASC */
export function sortLeaderboardEntries(entries) {
  return [...entries].sort((a, b) => {
    const beatDiff = Number(b.beat_buffet_by) - Number(a.beat_buffet_by)
    if (beatDiff !== 0) return beatDiff
    const valueDiff = Number(b.total_menu_value_eaten) - Number(a.total_menu_value_eaten)
    if (valueDiff !== 0) return valueDiff
    return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
  })
}

export function rankOfEntry(sortedEntries, entryId) {
  const idx = sortedEntries.findIndex((e) => String(e.id) === String(entryId))
  return idx >= 0 ? idx + 1 : null
}

export function filterByRestaurant(entries, restaurantId) {
  return entries.filter((e) => String(e.restaurant_id) === String(restaurantId))
}

export function summarizeLeaderboard(entries) {
  if (!entries.length) {
    return { top: null, avgBeat: null, avgValue: null, count: 0 }
  }
  const sorted = sortLeaderboardEntries(entries)
  const top = Number(sorted[0].beat_buffet_by)
  const avgBeat =
    Math.round(
      (entries.reduce((s, e) => s + Number(e.beat_buffet_by), 0) / entries.length) * 100,
    ) / 100
  const avgValue =
    Math.round(
      (entries.reduce((s, e) => s + Number(e.total_menu_value_eaten), 0) / entries.length) * 100,
    ) / 100
  return { top, avgBeat, avgValue, count: entries.length }
}

export function formatBeat(amount) {
  const n = Number(amount) || 0
  const abs = Math.abs(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
  if (n > 0) return `+${abs}`
  if (n < 0) return `-${abs}`
  return abs
}

export function rankLabel(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}
