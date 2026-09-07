/**
 * useMealSession — owns meal state and saves it to the browser's local storage
 * so a refresh mid-meal doesn't wipe progress.
 *
 * Storage key below can stay as-is unless you run multiple calculator variants.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_MENU_ITEMS } from '../data/defaultMenu'
import { calcEatenValue, calcWorthIt } from '../utils/worthIt'

const STORAGE_KEY = 'ayce-sushi-worth-it-v1'

function createItemFromMenu(menuItem) {
  return {
    id: menuItem.id,
    name: menuItem.name,
    pricePerPiece: menuItem.pricePerPiece,
    count: 0,
    isCustom: false,
  }
}

function createFreshSession() {
  return {
    pricePaid: '',
    items: DEFAULT_MENU_ITEMS.map(createItemFromMenu),
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createFreshSession()
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return createFreshSession()
    return {
      pricePaid: typeof parsed.pricePaid === 'string' || typeof parsed.pricePaid === 'number'
        ? String(parsed.pricePaid)
        : '',
      items: parsed.items.map((item) => ({
        id: String(item.id),
        name: String(item.name ?? 'Item'),
        pricePerPiece: Number(item.pricePerPiece) || 0,
        count: Math.max(0, Math.floor(Number(item.count) || 0)),
        isCustom: Boolean(item.isCustom),
      })),
    }
  } catch {
    return createFreshSession()
  }
}

export function useMealSession() {
  const [session, setSession] = useState(loadSession)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const setPricePaid = useCallback((value) => {
    setSession((prev) => ({ ...prev, pricePaid: value }))
  }, [])

  const adjustCount = useCallback((id, delta) => {
    setSession((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item
        return { ...item, count: Math.max(0, item.count + delta) }
      }),
    }))
  }, [])

  const updateItem = useCallback((id, updates) => {
    setSession((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              name: updates.name !== undefined ? String(updates.name) : item.name,
              pricePerPiece:
                updates.pricePerPiece !== undefined
                  ? Math.max(0, Number(updates.pricePerPiece) || 0)
                  : item.pricePerPiece,
            }
          : item,
      ),
    }))
  }, [])

  const removeItem = useCallback((id) => {
    setSession((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }))
  }, [])

  const addCustomItem = useCallback(({ name, pricePerPiece }) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return false
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setSession((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id,
          name: trimmed,
          pricePerPiece: Math.max(0, Number(pricePerPiece) || 0),
          count: 0,
          isCustom: true,
        },
      ],
    }))
    return true
  }, [])

  const resetSession = useCallback(() => {
    setSession(createFreshSession())
  }, [])

  /** Replace the whole menu (e.g. after URL import). Counts reset to 0; price paid is kept. */
  const replaceMenu = useCallback((menuItems) => {
    if (!Array.isArray(menuItems) || menuItems.length === 0) return false
    const stamp = Date.now()
    setSession((prev) => ({
      ...prev,
      items: menuItems.map((item, index) => ({
        id: String(item.id || `imported-${stamp}-${index}`),
        name: String(item.name || 'Item').trim() || 'Item',
        pricePerPiece: Math.max(0, Number(item.pricePerPiece) || 0),
        count: 0,
        isCustom: true,
      })),
    }))
    return true
  }, [])

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

  return {
    pricePaid: session.pricePaid,
    items: session.items,
    setPricePaid,
    adjustCount,
    updateItem,
    removeItem,
    addCustomItem,
    resetSession,
    replaceMenu,
    eatenValue,
    pricePaidNumber,
    worthIt,
    totalPieces,
  }
}
