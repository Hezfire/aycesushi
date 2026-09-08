/**
 * Handler-level tests for POST /api/leaderboard/submit (mocked SQL).
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

import handler from './submit.js'

function mockRes() {
  return { statusCode: 0, body: null, setHeader() {}, end() {} }
}

function mockReq(body) {
  return {
    method: 'POST',
    body,
    headers: {},
  }
}

describe('POST /api/leaderboard/submit', () => {
  beforeEach(() => {
    sqlMock.mockReset()
    ensureSchemaMock.mockClear()
    checkRateLimitMock.mockReturnValue(true)
  })

  it('rejects invalid paid amount before writing', async () => {
    const res = mockRes()
    await handler(
      mockReq({
        clientMealId: 'meal-1',
        visitorId: 'vis-1',
        displayName: 'Shark',
        restaurantId: '11111111-1111-1111-1111-111111111111',
        aycePricePaid: 0,
        totalMenuValueEaten: 40,
        piecesEaten: 20,
      }),
      res,
    )
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toMatch(/greater than zero/i)
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate client_meal_id', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'existing-entry' }])
    const res = mockRes()
    await handler(
      mockReq({
        clientMealId: 'meal-dup',
        visitorId: 'vis-1',
        displayName: 'Shark',
        restaurantId: '11111111-1111-1111-1111-111111111111',
        aycePricePaid: 30,
        totalMenuValueEaten: 45,
        piecesEaten: 25,
      }),
      res,
    )
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toMatch(/already added/i)
    expect(sqlMock).toHaveBeenCalledTimes(1)
  })
})
