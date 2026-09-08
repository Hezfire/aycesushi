/**
 * Unit tests for meal score / sticky / finish helpers.
 */

import { describe, expect, it } from 'vitest'
import {
  buildLeaderboardShareUrl,
  canFinishMeal,
  canSubmitLeaderboard,
  getDistanceToRecord,
  getStickyScoreLines,
  groupItemsByCategory,
} from './mealScore.js'

describe('getStickyScoreLines', () => {
  it('shows distance to break even when behind', () => {
    const lines = getStickyScoreLines({
      eatenValue: 20,
      pricePaid: 30,
      totalPieces: 12,
      difference: -10,
    })
    expect(lines.beatMode).toBe(false)
    expect(lines.primary).toMatch(/to break even/)
    expect(lines.progressPct).toBe(67)
  })

  it('shows over buffet when ahead', () => {
    const lines = getStickyScoreLines({
      eatenValue: 40,
      pricePaid: 30,
      totalPieces: 18,
      difference: 10,
    })
    expect(lines.beatMode).toBe(true)
    expect(lines.primary).toMatch(/over buffet/)
  })
})

describe('getDistanceToRecord', () => {
  it('reports gap to #1', () => {
    expect(getDistanceToRecord(10, 28.3)?.kind).toBe('behind')
    expect(getDistanceToRecord(30, 28.3)?.kind).toBe('lead')
  })
})

describe('groupItemsByCategory', () => {
  it('groups and orders categories', () => {
    const groups = groupItemsByCategory([
      { id: '1', name: 'A', category: 'Rolls' },
      { id: '2', name: 'B', category: 'Nigiri' },
      { id: '3', name: 'C', category: 'Mystery' },
    ])
    expect(groups.map((g) => g.category)).toEqual(['Nigiri', 'Rolls', 'Other'])
  })
})

describe('finish / submit gates', () => {
  it('requires price and pieces to finish', () => {
    expect(canFinishMeal({ pricePaid: 0, totalPieces: 5 })).toBe(false)
    expect(canFinishMeal({ pricePaid: 32, totalPieces: 5 })).toBe(true)
  })

  it('requires completed meal to submit', () => {
    expect(
      canSubmitLeaderboard({
        completed: false,
        leaderboardSubmitted: false,
        pricePaid: 30,
        totalPieces: 10,
      }),
    ).toBe(false)
    expect(
      canSubmitLeaderboard({
        completed: true,
        leaderboardSubmitted: false,
        pricePaid: 30,
        totalPieces: 10,
      }),
    ).toBe(true)
  })
})

describe('buildLeaderboardShareUrl', () => {
  it('builds restaurant leaderboard path', () => {
    expect(buildLeaderboardShareUrl('https://aycesushi.vercel.app', 'abc')).toBe(
      'https://aycesushi.vercel.app/restaurants/abc/leaderboard',
    )
  })
})
