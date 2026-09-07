/**
 * ItemRow — one sushi item with big +/- counters for one-handed table use.
 */

import { useState } from 'react'
import { formatMoney } from '../utils/money'

export default function ItemRow({ item, onIncrement, onDecrement, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(item.name)
  const [draftPrice, setDraftPrice] = useState(String(item.pricePerPiece))

  const lineTotal = item.count * item.pricePerPiece

  function startEdit() {
    setDraftName(item.name)
    setDraftPrice(String(item.pricePerPiece))
    setEditing(true)
  }

  function saveEdit() {
    const price = Number.parseFloat(String(draftPrice).replace(/[^0-9.]/g, ''))
    onUpdate(item.id, {
      name: draftName.trim() || item.name,
      pricePerPiece: Number.isFinite(price) ? price : item.pricePerPiece,
    })
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  return (
    <article className={`item-row ${item.count > 0 ? 'item-row--active' : ''}`}>
      {editing ? (
        <div className="item-row__edit">
          <label>
            <span>Name</span>
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            <span>$ / piece</span>
            <input
              type="text"
              inputMode="decimal"
              value={draftPrice}
              onChange={(e) => setDraftPrice(e.target.value)}
            />
          </label>
          <div className="item-row__edit-actions">
            <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={saveEdit}>
              Save
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onRemove(item.id)}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="item-row__info">
            <button type="button" className="item-row__name" onClick={startEdit}>
              {item.name}
            </button>
            <p className="item-row__meta">
              {formatMoney(item.pricePerPiece)} / piece
              {item.count > 0 && (
                <span className="item-row__line"> · {formatMoney(lineTotal)}</span>
              )}
            </p>
          </div>
          <div className="item-row__counter">
            <button
              type="button"
              className="counter-btn"
              onClick={onDecrement}
              disabled={item.count <= 0}
              aria-label={`Decrease ${item.name}`}
            >
              −
            </button>
            <span className="counter-value" aria-live="polite">
              {item.count}
            </span>
            <button
              type="button"
              className="counter-btn counter-btn--plus"
              onClick={onIncrement}
              aria-label={`Increase ${item.name}`}
            >
              +
            </button>
          </div>
        </>
      )}
    </article>
  )
}
