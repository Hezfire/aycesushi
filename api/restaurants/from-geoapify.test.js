/**
 * Handler tests for POST /api/restaurants/from-geoapify (mocked SQL).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sqlMock, ensureSchemaMock, checkRateLimitMock } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  ensureSchemaMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => true),
}))

vi.mock('../_lib/db.js', () => ({
  getSql: () => sqlMock,
  ensureSchema: ensureSchemaMock,
  checkRateLimit: checkRateLimitMock,
  readJsonBody: async (req) => req.body,
  sendJson: (res, status, body) => {
    res.statusCode = status
    res.body = body
  },
}))

import handler from './from-geoapify.js'

function mockRes() {
  return { statusCode: 0, body: null, setHeader() {}, end() {} }
}

describe('POST /api/restaurants/from-geoapify', () => {
  beforeEach(() => {
    sqlMock.mockReset()
    checkRateLimitMock.mockReturnValue(true)
  })

  it('returns existing restaurant by external_place_id without insert', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 'r1',
        name: 'Hanami',
        city: 'Austin',
        state: 'TX',
        google_place_id: null,
        external_provider: 'geoapify',
        external_place_id: 'place-1',
        formatted_address: 'Hanami, Austin, TX',
        latitude: 30.2,
        longitude: -97.7,
        ayce_price_default: null,
        created_at: '2026-01-01',
      },
    ])
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        body: {
          externalPlaceId: 'place-1',
          name: 'Hanami',
          city: 'Austin',
          state: 'TX',
        },
        headers: {},
      },
      res,
    )
    expect(res.statusCode).toBe(200)
    expect(res.body.created).toBe(false)
    expect(res.body.restaurant.id).toBe('r1')
    expect(sqlMock).toHaveBeenCalledTimes(1)
  })

  it('inserts when snapshot provided and no match', async () => {
    sqlMock
      .mockResolvedValueOnce([]) // by external id
      .mockResolvedValueOnce([]) // by norm
      .mockResolvedValueOnce([
        {
          id: 'r2',
          name: 'New Sushi',
          city: 'Austin',
          state: 'TX',
          google_place_id: null,
          external_provider: 'geoapify',
          external_place_id: 'place-2',
          formatted_address: 'New Sushi, Austin, TX',
          latitude: 30.1,
          longitude: -97.8,
          ayce_price_default: null,
          created_at: '2026-01-01',
        },
      ])
    const res = mockRes()
    await handler(
      {
        method: 'POST',
        body: {
          externalPlaceId: 'place-2',
          name: 'New Sushi',
          city: 'Austin',
          state: 'TX',
          formattedAddress: 'New Sushi, Austin, TX',
          latitude: 30.1,
          longitude: -97.8,
          country: 'US',
        },
        headers: {},
      },
      res,
    )
    expect(res.statusCode).toBe(201)
    expect(res.body.created).toBe(true)
    expect(res.body.restaurant.externalPlaceId).toBe('place-2')
    expect(res.body.restaurant.externalProvider).toBe('geoapify')
  })
})
