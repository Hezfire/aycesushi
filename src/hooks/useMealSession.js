/**
 * useMealSession — meal state persisted in localStorage (restaurant-bound game loop).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_MENU_ITEMS, inferCategory } from '../data/defaultMenu'
import { calcEatenValue, calcWorthIt } from '../utils/worthIt'
import { canFinishMeal } from '../utils/mealScore'
import { getVisitorId } from '../utils/visitorId'

const STORAGE_KEY = 'ayce-sushi-worth-it-v4'

function newClientMealId() {
  return `meal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeItem(item, index = 0, stamp = Date.now()) {
  const name = String(item.name || 'Item').trim() || 'Item'
  return {
    id: String(item.id || `item-${stamp}-${index}`),
    name,
    pricePerPiece: Math.max(0, Number(item.pricePerPiece ?? item.estimatedValue) || 0),
    count: Math.max(0, Math.floor(Number(item.count) || 0)),
    isCustom: Boolean(item.isCustom),
    category: item.category || inferCategory(name),
    pricingUnit: item.pricingUnit || item.pricing_unit || 'piece',
  }
}

function createItemFromMenu(menuItem) {
  return normalizeItem({ ...menuItem, count: 0, isCustom: false })
}

function emptyRestaurantFields() {
  return {
    restaurantId: null,
    restaurantName: '',
    city: '',
    state: '',
    topBeatToBeat: null,
    hasStoredMenu: false,
    completed: false,
    completedAt: null,
    brokeEvenCelebrated: false,
  }
}

function createFreshSession(overrides = {}) {
  return {
    pricePaid: '',
    items: DEFAULT_MENU_ITEMS.map(createItemFromMenu),
    clientMealId: newClientMealId(),
    leaderboardSubmitted: false,
    ...emptyRestaurantFields(),
    ...overrides,
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createFreshSession()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return createFreshSession()
    return {
      pricePaid:
        typeof parsed.pricePaid === 'string' || typeof parsed.pricePaid === 'number'
          ? String(parsed.pricePaid)
          : '',
      items: parsed.items.map((item, i) => normalizeItem(item, i)),
      clientMealId:
        typeof parsed.clientMealId === 'string' && parsed.clientMealId
          ? parsed.clientMealId
          : newClientMealId(),
      leaderboardSubmitted: Boolean(parsed.leaderboardSubmitted),
      restaurantId: parsed.restaurantId ? String(parsed.restaurantId) : null,
      restaurantName: String(parsed.restaurantName || ''),
      city: String(parsed.city || ''),
      state: String(parsed.state || ''),
      topBeatToBeat:
        parsed.topBeatToBeat == null || parsed.topBeatToBeat === ''
          ? null
          : Number(parsed.topBeatToBeat),
      hasStoredMenu: Boolean(parsed.hasStoredMenu),
      completed: Boolean(parsed.completed),
      completedAt: parsed.completedAt || null,
      brokeEvenCelebrated: Boolean(parsed.brokeEvenCelebrated),
    }
  } catch {
    return createFreshSession()
  }
}

export function useMealSession() {
  const [session, setSession] = useState(loadSession)
  const visitorId = useMemo(() => getVisitorId(), [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const persist = useCallback((updater) => {
    setSession((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return next
    })
  }, [])

  const setPricePaid = useCallback((value) => {
    persist((prev) => ({ ...prev, pricePaid: value }))
  }, [persist])

  const adjustCount = useCallback((id, delta) => {
    persist((prev) => {
      if (prev.completed) return prev
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== id) return item
          return { ...item, count: Math.max(0, item.count + delta) }
        }),
      }
    })
  }, [persist])

  const updateItem = useCallback((id, updates) => {
    persist((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? normalizeItem({
              ...item,
              ...updates,
              name: updates.name !== undefined ? String(updates.name) : item.name,
              pricePerPiece:
                updates.pricePerPiece !== undefined
                  ? Math.max(0, Number(updates.pricePerPiece) || 0)
                  : item.pricePerPiece,
            })
          : item,
      ),
    }))
  }, [persist])

  const removeItem = useCallback((id) => {
    persist((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }, [persist])

  const addCustomItem = useCallback(({ name, pricePerPiece, category, pricingUnit }) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return false
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    persist((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        normalizeItem({
          id,
          name: trimmed,
          pricePerPiece: Math.max(0, Number(pricePerPiece) || 0),
          count: 0,
          isCustom: true,
          category: category || inferCategory(trimmed),
          pricingUnit: pricingUnit || 'piece',
        }),
      ],
    }))
    return true
  }, [persist])

  const resetSession = useCallback(() => {
    persist(createFreshSession())
  }, [persist])

  const clearCounts = useCallback(() => {
    persist((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, count: 0 })),
      completed: false,
      completedAt: null,
      brokeEvenCelebrated: false,
      leaderboardSubmitted: false,
    }))
  }, [persist])

  const replaceMenu = useCallback((menuItems, options = {}) => {
    if (!Array.isArray(menuItems) || menuItems.length === 0) return false
    const stamp = Date.now()
    persist((prev) => ({
      ...prev,
      items: menuItems.map((item, index) =>
        normalizeItem({ ...item, count: 0, isCustom: Boolean(item.isCustom ?? true) }, index, stamp),
      ),
      hasStoredMenu: options.hasStoredMenu ?? prev.hasStoredMenu,
      clientMealId: options.keepMealId ? prev.clientMealId : newClientMealId(),
      leaderboardSubmitted: false,
      completed: false,
      completedAt: null,
      brokeEvenCelebrated: false,
    }))
    return true
  }, [persist])

  const startMeal = useCallback((payload = {}) => {
    const price =
      payload.pricePaid != null && payload.pricePaid !== ''
        ? String(payload.pricePaid)
        : ''
    const menuItems = Array.isArray(payload.items) && payload.items.length
      ? payload.items
      : DEFAULT_MENU_ITEMS
    persist(
      createFreshSession({
        pricePaid: price,
        items: menuItems.map(createItemFromMenu),
        restaurantId: payload.restaurantId ? String(payload.restaurantId) : null,
        restaurantName: String(payload.restaurantName || ''),
        city: String(payload.city || ''),
        state: String(payload.state || ''),
        topBeatToBeat:
          payload.topBeatToBeat == null || payload.topBeatToBeat === ''
            ? null
            : Number(payload.topBeatToBeat),
        hasStoredMenu: Boolean(payload.hasStoredMenu),
      }),
    )
  }, [persist])

  const finishMeal = useCallback(() => {
    persist((prev) => {
      const paid = Number.parseFloat(String(prev.pricePaid).replace(/[^0-9.]/g, '')) || 0
      const pieces = prev.items.reduce((s, i) => s + (i.count || 0), 0)
      if (!canFinishMeal({ pricePaid: paid, totalPieces: pieces })) return prev
      return {
        ...prev,
        completed: true,
        completedAt: new Date().toISOString(),
      }
    })
  }, [persist])

  const markBrokeEvenCelebrated = useCallback(() => {
    persist((prev) => ({ ...prev, brokeEvenCelebrated: true }))
  }, [persist])

  const markLeaderboardSubmitted = useCallback(() => {
    persist((prev) => ({ ...prev, leaderboardSubmitted: true }))
  }, [persist])

  const setTopBeatToBeat = useCallback((value) => {
    persist((prev) => ({
      ...prev,
      topBeatToBeat: value == null ? null : Number(value),
    }))
  }, [persist])

  const eatenValue = useMemo(() => calcEatenValue(session.items), [session.items])
  const pricePaidNumber = useMemo(() => {
    const n = Number.parseFloat(String(session.pricePaid).replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) ? n : 0
  }, [session.pricePaid])
  const worthIt = useMemo(
    () => calcWorthIt(eatenValue, pricePaidNumber),
    [eatenValue, pricePaidNumber],
  )
  const totalPieces = useMemo(
    () => session.items.reduce((sum, item) => sum + (item.count || 0), 0),
    [session.items],
  )
  const isCompletable = canFinishMeal({
    pricePaid: pricePaidNumber,
    totalPieces,
  })

  return {
    pricePaid: session.pricePaid,
    items: session.items,
    clientMealId: session.clientMealId,
    leaderboardSubmitted: session.leaderboardSubmitted,
    restaurantId: session.restaurantId,
    restaurantName: session.restaurantName,
    city: session.city,
    state: session.state,
    topBeatToBeat: session.topBeatToBeat,
    hasStoredMenu: session.hasStoredMenu,
    completed: session.completed,
    completedAt: session.completedAt,
    brokeEvenCelebrated: session.brokeEvenCelebrated,
    visitorId,
    setPricePaid,
    adjustCount,
    updateItem,
    removeItem,
    addCustomItem,
    clearCounts,
    resetSession,
    replaceMenu,
    startMeal,
    finishMeal,
    markBrokeEvenCelebrated,
    markLeaderboardSubmitted,
    setTopBeatToBeat,
    eatenValue,
    pricePaidNumber,
    worthIt,
    totalPieces,
    isCompletable,
  }
}
