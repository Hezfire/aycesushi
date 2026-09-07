/**
 * ImportMenuPanel — import from URL, paste text, or photo/PDF upload,
 * review prices, then apply to the current meal.
 */

import { useState } from 'react'
import { importMenuFromSource } from '../utils/importMenuApi'

const MAX_UPLOAD_BYTES = Math.floor(2.6 * 1024 * 1024)

function draftFromItems(items) {
  return items.map((item, index) => ({
    key: `draft-${index}-${item.name}`,
    name: item.name,
    pricePerPiece: String(item.pricePerPiece ?? ''),
  }))
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Could not read that file. Try another photo or PDF.'))
    reader.readAsDataURL(file)
  })
}

export default function ImportMenuPanel({ onReplaceMenu }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState(null)

  async function handleImport(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let fileBase64
      let mimeType
      if (file) {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error('That file is too large. Use a photo/PDF under about 2.5 MB.')
        }
        fileBase64 = await readFileAsBase64(file)
        mimeType = file.type || 'application/octet-stream'
      }

      const items = await importMenuFromSource({
        url: url.trim() || undefined,
        text: showTextFallback ? text : undefined,
        fileBase64,
        mimeType,
      })
      setDrafts(draftFromItems(items))
    } catch (err) {
      setDrafts(null)
      setError(err.message || 'Import failed.')
      if (!showTextFallback && !file) setShowTextFallback(true)
    } finally {
      setLoading(false)
    }
  }

  function updateDraft(index, field, value) {
    setDrafts((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  function removeDraft(index) {
    setDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  function handleCancelReview() {
    setDrafts(null)
    setError('')
  }

  function handleConfirm() {
    const items = (drafts || [])
      .map((row) => ({
        name: String(row.name || '').trim(),
        pricePerPiece: Number.parseFloat(String(row.pricePerPiece).replace(/[^0-9.]/g, '')) || 0,
      }))
      .filter((row) => row.name)

    if (items.length === 0) {
      setError('Keep at least one item with a name.')
      return
    }

    const ok = onReplaceMenu(items)
    if (!ok) {
      setError('Could not apply the imported menu.')
      return
    }

    setDrafts(null)
    setError('')
    setUrl('')
    setText('')
    setFile(null)
  }

  if (drafts) {
    return (
      <section className="import-panel import-panel--review" aria-labelledby="import-review-heading">
        <div className="section-head">
          <h2 id="import-review-heading">Review imported menu</h2>
          <p>
            Prices are AI estimates of grocery/store-bought value (HEB/Kroger-style)—not the
            restaurant’s menu prices. Edit before applying.
          </p>
        </div>

        <ul className="import-review-list">
          {drafts.map((row, index) => (
            <li key={row.key} className="import-review-row">
              <label className="import-review-row__name">
                <span>Name</span>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateDraft(index, 'name', e.target.value)}
                />
              </label>
              <label className="import-review-row__price">
                <span>Est. grocery $ / piece</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.pricePerPiece}
                  onChange={(e) => updateDraft(index, 'pricePerPiece', e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn--danger import-review-row__remove"
                onClick={() => removeDraft(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        {error && <p className="import-panel__error" role="alert">{error}</p>}

        <div className="import-panel__actions import-panel__actions--sticky">
          <button type="button" className="btn btn--ghost" onClick={handleCancelReview}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleConfirm}>
            Use this menu
          </button>
        </div>
      </section>
    )
  }

  const canSubmit =
    Boolean(url.trim()) ||
    Boolean(file) ||
    (showTextFallback && Boolean(text.trim()))

  return (
    <section className="import-panel" aria-labelledby="import-heading">
      <div className="section-head">
        <h2 id="import-heading">Import menu</h2>
        <p>
          Paste a menu page or PDF link, upload a menu photo/PDF, or paste text. We’ll list dishes
          and estimate grocery/store-bought prices per piece.
        </p>
      </div>

      <form className="import-panel__form" onSubmit={handleImport}>
        <label className="import-panel__url">
          <span>Menu website or PDF URL</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://example.com/menu.pdf"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="import-panel__file">
          <span>Upload menu photo or PDF</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={loading}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <p className="import-panel__file-hint">
            {file
              ? `Selected: ${file.name}`
              : 'Handy for paper menus or PDF downloads (about 2.5 MB max).'}
          </p>
        </label>

        <button
          type="button"
          className="import-panel__toggle"
          onClick={() => setShowTextFallback((v) => !v)}
        >
          {showTextFallback ? 'Hide paste-text fallback' : 'Website blocked? Paste menu text instead'}
        </button>

        {showTextFallback && (
          <label className="import-panel__text">
            <span>Menu text</span>
            <textarea
              rows={5}
              placeholder="Paste item names (and prices if shown) from the menu…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
          </label>
        )}

        {error && <p className="import-panel__error" role="alert">{error}</p>}

        <button type="submit" className="btn btn--secondary btn--block" disabled={loading || !canSubmit}>
          {loading ? 'Importing…' : 'Import menu'}
        </button>
      </form>
    </section>
  )
}
