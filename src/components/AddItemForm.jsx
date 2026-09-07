/**
 * AddItemForm — add a custom menu item not in the default list.
 */

import { useState } from 'react'

export default function AddItemForm({ onAdd }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [open, setOpen] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const ok = onAdd({
      name,
      pricePerPiece: Number.parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0,
    })
    if (ok) {
      setName('')
      setPrice('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <div className="add-item">
        <button type="button" className="btn btn--secondary btn--block" onClick={() => setOpen(true)}>
          + Add custom item
        </button>
      </div>
    )
  }

  return (
    <form className="add-item add-item--open" onSubmit={handleSubmit}>
      <h3>Custom item</h3>
      <label>
        <span>Name</span>
        <input
          type="text"
          placeholder="e.g. Soft Shell Crab Roll"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </label>
      <label>
        <span>Est. $ per piece</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="2.50"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <div className="add-item__actions">
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Add item
        </button>
      </div>
    </form>
  )
}
