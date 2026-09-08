/**
 * Unit tests for leaderboard pure helpers.
 */

import { describe, expect, it } from 'vitest'
import {
  calcBeatBuffetBy,
  filterByRestaurant,
  formatBeat,
  rankLabel,
  rankOfEntry,
  sanitizeDisplayName,
  sanitizeRestaurantInput,
  sortLeaderboardEntries,
  summarizeLeaderboard,
  validateMealNumbers,
} from './leaderboard.js'

describe('calcBeatBuffetBy', () => {
  it('computes value minus paid, rounded to cents', () => {
    expect(calcBeatBuffetBy(42.5, 29.99)).toBe(12.51)
    expect(calcBeatBuffetBy(20, 30)).toBe(-10)
  })
})

describe('validateMealNumbers', () => {
  it('accepts finite positive paid and non-negative value', () => {
    const result = validateMealNumbers({
      aycePricePaid: 32.5,
      totalMenuValueEaten: 48.2,
      piecesEaten: 40,
    })
    expect(result.ok).toBe(true)
    expect(result.value.beatBuffetBy).toBe(15.7)
  })

  it('rejects paid ≤ 0', () => {
    expect(
      validateMealNumbers({ aycePricePaid: 0, totalMenuValueEaten: 10, piecesEaten: 1 }).ok,
    ).toBe(false)
  })

  it('rejects non-integer pieces', () => {
    expect(
      validateMealNumbers({ aycePricePaid: 20, totalMenuValueEaten: 10, piecesEaten: 1.5 }).ok,
    ).toBe(false)
  })
})

describe('sanitizeDisplayName', () => {
  it('trims and accepts 1–30 chars', () => {
    expect(sanitizeDisplayName('  SushiShark  ').value).toBe('SushiShark')
  })

  it('rejects empty or too long', () => {
    expect(sanitizeDisplayName('').ok).toBe(false)
    expect(sanitizeDisplayName('x'.repeat(31)).ok).toBe(false)
  })
})

describe('sanitizeRestaurantInput', () => {
  it('normalizes place parts for find-or-create', () => {
    const result = sanitizeRestaurantInput({
      name: '  Kimoto  Premium ',
      city: 'Houston',
      state: 'tx',
    })
    expect(result.ok).toBe(true)
    expect(result.value.nameNorm).toBe('kimoto premium')
    expect(result.value.stateNorm).toBe('tx')
  })
})

describe('sortLeaderboardEntries + rank', () => {
  const entries = [
    {
      id: 'a',
      restaurant_id: 'r1',
      beat_buffet_by: 10,
      total_menu_value_eaten: 40,
      completed_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'b',
      restaurant_id: 'r1',
      beat_buffet_by: 20,
      total_menu_value_eaten: 50,
      completed_at: '2026-01-03T00:00:00Z',
    },
    {
      id: 'c',
      restaurant_id: 'r1',
      beat_buffet_by: 20,
      total_menu_value_eaten: 60,
      completed_at: '2026-01-04T00:00:00Z',
    },
    {
      id: 'd',
      restaurant_id: 'r1',
      beat_buffet_by: 20,
      total_menu_value_eaten: 60,
      completed_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'e',
      restaurant_id: 'r2',
      beat_buffet_by: 99,
      total_menu_value_eaten: 100,
      completed_at: '2026-01-01T00:00:00Z',
    },
  ]

  it('sorts by beat DESC, value DESC, completed_at ASC', () => {
    const sorted = sortLeaderboardEntries(filterByRestaurant(entries, 'r1'))
    expect(sorted.map((e) => e.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('ranks by position in sorted list', () => {
    const sorted = sortLeaderboardEntries(filterByRestaurant(entries, 'r1'))
    expect(rankOfEntry(sorted, 'd')).toBe(1)
    expect(rankOfEntry(sorted, 'a')).toBe(4)
  })

  it('isolates restaurants', () => {
    expect(filterByRestaurant(entries, 'r2')).toHaveLength(1)
    expect(filterByRestaurant(entries, 'r2')[0].id).toBe('e')
  })
})

describe('summarizeLeaderboard', () => {
  it('returns empty summary for no entries', () => {
    expect(summarizeLeaderboard([])).toEqual({
      top: null,
      avgBeat: null,
      avgValue: null,
      count: 0,
    })
  })

  it('computes top and averages', () => {
    const summary = summarizeLeaderboard([
      { beat_buffet_by: 10, total_menu_value_eaten: 40, completed_at: '2026-01-01' },
      { beat_buffet_by: 20, total_menu_value_eaten: 50, completed_at: '2026-01-02' },
    ])
    expect(summary.top).toBe(20)
    expect(summary.avgBeat).toBe(15)
    expect(summary.avgValue).toBe(45)
    expect(summary.count).toBe(2)
  })
})

describe('formatBeat / rankLabel', () => {
  it('formats positive beat with +', () => {
    expect(formatBeat(12.5)).toMatch(/^\+\$/)
  })

  it('uses medals for top 3', () => {
    expect(rankLabel(1)).toBe('🥇')
    expect(rankLabel(2)).toBe('🥈')
    expect(rankLabel(3)).toBe('🥉')
    expect(rankLabel(4)).toBe('#4')
  })
})
