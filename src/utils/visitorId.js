/**
 * Anonymous visitor id for highlighting “your” leaderboard rows.
 */

const VISITOR_KEY = 'worthbite-visitor-id-v1'

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (id && id.length >= 8) return id
    id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(VISITOR_KEY, id)
    return id
  } catch {
    return `v-temp-${Date.now().toString(36)}`
  }
}
