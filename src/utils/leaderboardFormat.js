/**
 * Shared formatting for leaderboard ranks and beat-buffet amounts.
 */

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

export function formatShortDate(value) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return ''
  }
}
