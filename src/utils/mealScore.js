/**
 * Pure helpers for sticky score copy and break-even UI.
 */

import { formatMoney } from './money'
import { formatBeat } from './leaderboardFormat'

export function getStickyScoreLines({ eatenValue, pricePaid, totalPieces, difference }) {
  const paid = Number(pricePaid) || 0
  const value = Number(eatenValue) || 0
  const diff = difference != null ? Number(difference) : value - paid
  const pieces = Number(totalPieces) || 0

  if (paid <= 0) {
    return {
      primary: `${formatMoney(value)} eaten`,
      secondary: 'Set AYCE price',
      piecesLabel: `${pieces} piece${pieces === 1 ? '' : 's'}`,
      beatMode: false,
      progressPct: 0,
    }
  }

  if (diff < -0.005) {
    return {
      primary: `${formatMoney(value)} eaten · ${formatMoney(Math.abs(diff))} to break even`,
      secondary: `${pieces} piece${pieces === 1 ? '' : 's'}`,
      piecesLabel: `${pieces} piece${pieces === 1 ? '' : 's'}`,
      beatMode: false,
      progressPct: Math.min(100, Math.round((value / paid) * 100)),
    }
  }

  return {
    primary: `${formatBeat(diff)} over buffet`,
    secondary: `${pieces} piece${pieces === 1 ? '' : 's'}`,
    piecesLabel: `${pieces} piece${pieces === 1 ? '' : 's'}`,
    beatMode: true,
    progressPct: 100,
  }
}

export function getDistanceToRecord(beatBuffetBy, topBeat) {
  if (topBeat == null || !Number.isFinite(Number(topBeat))) return null
  const beat = Number(beatBuffetBy) || 0
  const top = Number(topBeat)
  const gap = top - beat
  if (gap > 0.005) {
    return { kind: 'behind', label: `${formatMoney(gap)} away from #1` }
  }
  return { kind: 'lead', label: 'New #1 at this restaurant' }
}

export function groupItemsByCategory(items, categoryOrder) {
  const order = categoryOrder || ['Nigiri', 'Sashimi', 'Rolls', 'Appetizers', 'Other']
  const buckets = new Map(order.map((c) => [c, []]))
  for (const item of items) {
    const cat = order.includes(item.category) ? item.category : 'Other'
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(item)
  }
  return order
    .filter((c) => buckets.get(c)?.length)
    .map((category) => ({ category, items: buckets.get(category) }))
}

export function buildLeaderboardShareUrl(origin, restaurantId) {
  const base = String(origin || '').replace(/\/$/, '')
  return `${base}/restaurants/${encodeURIComponent(restaurantId)}/leaderboard`
}

export function canFinishMeal({ pricePaid, totalPieces }) {
  return Number(pricePaid) > 0 && Number(totalPieces) > 0
}

export function canSubmitLeaderboard({ completed, leaderboardSubmitted, pricePaid, totalPieces }) {
  return Boolean(completed) && !leaderboardSubmitted && canFinishMeal({ pricePaid, totalPieces })
}
