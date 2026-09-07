/**
 * Small helpers for displaying and parsing dollar amounts.
 */

/** Format a number as USD, e.g. 12.5 → "$12.50" */
export function formatMoney(amount) {
  const value = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

/** Parse a price typed by the user into a non-negative number (or 0). */
export function parseMoneyInput(raw) {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}
