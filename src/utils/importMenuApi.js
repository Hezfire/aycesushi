/**
 * Calls the serverless /api/import-menu endpoint (URL, pasted text, or photo/PDF).
 * The API key lives only on the server — never in this browser code.
 */

export async function importMenuFromSource({ url, text, fileBase64, mimeType } = {}) {
  const body = {}
  if (url && String(url).trim()) body.url = String(url).trim()
  if (text && String(text).trim()) body.text = String(text).trim()
  if (fileBase64 && String(fileBase64).trim()) {
    body.fileBase64 = String(fileBase64).trim()
    body.mimeType = String(mimeType || 'application/octet-stream')
  }

  if (!body.url && !body.text && !body.fileBase64) {
    throw new Error('Paste a menu URL, upload a photo/PDF, or paste menu text.')
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
        : response.status === 413
          ? 'That file is too large. Try a smaller photo or PDF.'
          : 'Could not import the menu. Try again, upload a photo/PDF, or paste menu text.')
    throw new Error(message)
  }

  if (!data?.items || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('No menu items found. Try another URL, photo/PDF, or paste the menu text.')
  }

  return data.items
}
