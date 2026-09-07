/**
 * Calls the serverless /api/import-menu endpoint (URL or pasted menu text).
 * The API key lives only on the server — never in this browser code.
 */

export async function importMenuFromSource({ url, text } = {}) {
  const body = {}
  if (url && String(url).trim()) body.url = String(url).trim()
  if (text && String(text).trim()) body.text = String(text).trim()

  if (!body.url && !body.text) {
    throw new Error('Paste a menu URL or menu text to import.')
  }

  const response = await fetch('/api/import-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message =
      data?.error ||
      (response.status === 429
        ? 'Too many import requests. Please wait a minute and try again.'
        : 'Could not import the menu. Try again or paste menu text instead.')
    throw new Error(message)
  }

  if (!data?.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('No menu items found. Try another URL or paste the menu text.')
  }

  return data.items
}
