/**
 * Unit tests for Geoapify search helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearGeoapifySearchCache,
  filterGeoapifyAlreadyInNeon,
  mapGeoapifyPlace,
  parseRestaurantQuery,
  restaurantDraftFromGeoapify,
  searchGeoapifyPlaces,
} from './geoapify.js'

describe('parseRestaurantQuery', () => {
  it('uses location param when provided', () => {
    expect(parseRestaurantQuery('Hanami', 'Austin, TX')).toEqual({
      term: 'Hanami',
      locationHint: 'Austin, TX',
    })
  })

  it('splits Name, City from query', () => {
    expect(parseRestaurantQuery('Hanami, Austin')).toEqual({
      term: 'Hanami',
      locationHint: 'Austin',
    })
  })
})

describe('mapGeoapifyPlace', () => {
  it('maps an autocomplete result', () => {
    const mapped = mapGeoapifyPlace({
      place_id: 'place-abc',
      name: 'Hanami Sushi',
      city: 'Austin',
      state_code: 'TX',
      country_code: 'us',
      formatted: 'Hanami Sushi, Austin, TX, United States of America',
      lat: 30.26,
      lon: -97.74,
      category: 'catering.restaurant',
      result_type: 'amenity',
    })
    expect(mapped).toMatchObject({
      externalPlaceId: 'place-abc',
      externalProvider: 'geoapify',
      name: 'Hanami Sushi',
      city: 'Austin',
      state: 'TX',
      country: 'US',
      latitude: 30.26,
      longitude: -97.74,
      isFoodService: true,
    })
  })
})

describe('filterGeoapifyAlreadyInNeon', () => {
  it('drops suggestions already saved by external id or name/city/state', () => {
    const neon = [
      {
        externalProvider: 'geoapify',
        externalPlaceId: 'a1',
        name: 'Other',
        city: 'Austin',
        state: 'TX',
      },
    ]
    const places = [
      { externalPlaceId: 'a1', name: 'Dup', city: 'Austin', state: 'TX' },
      { externalPlaceId: 'b2', name: 'New Spot', city: 'Austin', state: 'TX' },
      { externalPlaceId: 'c3', name: 'Other', city: 'Austin', state: 'TX' },
    ]
    const filtered = filterGeoapifyAlreadyInNeon(places, neon)
    expect(filtered.map((p) => p.externalPlaceId)).toEqual(['b2'])
  })
})

describe('restaurantDraftFromGeoapify', () => {
  it('builds normalized draft fields', () => {
    const draft = restaurantDraftFromGeoapify({
      externalPlaceId: 'x',
      name: '  Hanami  ',
      city: 'Austin',
      state: 'tx',
      formattedAddress: 'Hanami, Austin, TX',
      latitude: 1,
      longitude: 2,
    })
    expect(draft.nameNorm).toBe('hanami')
    expect(draft.stateNorm).toBe('tx')
    expect(draft.externalProvider).toBe('geoapify')
    expect(draft.externalPlaceId).toBe('x')
  })
})

describe('searchGeoapifyPlaces', () => {
  beforeEach(() => {
    clearGeoapifySearchCache()
    delete process.env.GEOAPIFY_API_KEY
  })

  it('calls autocomplete with apiKey and caches results', async () => {
    process.env.GEOAPIFY_API_KEY = 'test-key'
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            place_id: 'y1',
            name: 'Kimoto',
            city: 'Houston',
            state_code: 'TX',
            country_code: 'us',
            formatted: 'Kimoto, Houston, TX',
            lat: 29.7,
            lon: -95.3,
            category: 'catering.restaurant',
            result_type: 'amenity',
          },
        ],
      }),
    }))
    const hits = await searchGeoapifyPlaces({
      term: 'Kimoto',
      location: 'Houston, TX',
      fetchImpl,
    })
    expect(hits).toHaveLength(1)
    expect(hits[0].name).toBe('Kimoto')
    expect(fetchImpl.mock.calls[0][0]).toMatch(
      /api\.geoapify\.com\/v1\/geocode\/autocomplete/,
    )
    expect(fetchImpl.mock.calls[0][0]).toMatch(/apiKey=test-key/)

    await searchGeoapifyPlaces({
      term: 'Kimoto',
      location: 'Houston, TX',
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('skips short terms', async () => {
    process.env.GEOAPIFY_API_KEY = 'test-key'
    const fetchImpl = vi.fn()
    const hits = await searchGeoapifyPlaces({
      term: 'Ha',
      location: 'Austin',
      fetchImpl,
    })
    expect(hits).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
