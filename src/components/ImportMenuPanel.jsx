/**
 * ImportMenuPanel — paste a restaurant menu URL (or menu text fallback),
 * review AI-estimated à la carte prices, then apply to the current meal.
 */

import { useState } from 'react'
import { importMenuFromSource } from '../utils/importMenuApi'

function draftFromItems(items) {
  return items.map((item, index) => ({
    key: `draft-${index}-${item.name}`,
    name: item.name,
    pricePerPiece: String(item.pricePerPiece ?? ''),
  }))
}

export default function ImportMenuPanel({ onReplaceMenu }) {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [showTextFallback, setShowTextFallback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState(null)

  async function handleImport(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const items = await importMenuFromSource({
        url: url.trim() || undefined,
        text: showTextFallback ? text : undefined,
      })
      setDrafts(draftFromItems(items))
    } catch (err) {
      setDrafts(null)
      setError(err.message || 'Import failed.')
      // If URL fetch often fails, nudge users toward paste fallback.
      if (!showTextFallback) setShowTextFallback(true)
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
  }

  if (drafts) {
    return (
      <section className="import-panel import-panel--review" aria-labelledby="import-review-heading">
        <div className="section-head">
          <h2 id="import-review-heading">Review imported menu</h2>
          <p>
            Prices are AI estimates of typical à la carte value — not the restaurant’s official
            prices. Edit before applying.
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
                <span>$ / piece</span>
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

        <div className="import-panel__actions">
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

  return (
    <section className="import-panel" aria-labelledby="import-heading">
      <div className="section-head">
        <h2 id="import-heading">Import from menu URL</h2>
        <p>
          Paste a restaurant menu page link. We’ll pull item names and estimate typical à la carte
          prices.
        </p>
      </div>

      <form className="import-panel__form" onSubmit={handleImport}>
        <label className="import-panel__url">
          <span>Menu website URL</span>
          <input
            type="url"
            inputMode="url"
            placeholder="https://example.com/menu"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
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

        <button
          type="submit"
          className="btn btn--secondary btn--block"
          disabled={loading || (!url.trim() && !(showTextFallback && text.trim()))}
        >
          {loading ? 'Importing…' : 'Import menu'}
        </button>
      </form>
    </section>
  )
}
