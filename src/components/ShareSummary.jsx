/**
 * ShareSummary — share or copy a short meal worth-it blurb.
 */

import { useState } from 'react'
import { formatMoney } from '../utils/money'

function buildSummary({ totalPieces, eatenValue, pricePaid, worthIt }) {
  const { difference, status, message } = worthIt
  const lines = [
    'WorthBite — AYCE check-in',
    `${totalPieces} piece${totalPieces === 1 ? '' : 's'} logged`,
    `Grocery value: ${formatMoney(eatenValue)}`,
    `Paid: ${formatMoney(pricePaid)}`,
  ]

  if (pricePaid > 0) {
    if (difference >= 0) {
      lines.push(`Result: ${formatMoney(difference)} ahead`)
    } else {
      lines.push(`Result: ${formatMoney(Math.abs(difference))} to break even`)
    }
  }

  if (status !== 'waiting' && message) {
    lines.push(message)
  }

  lines.push('https://aycesushi.vercel.app')
  return lines.join('\n')
}

export default function ShareSummary({ totalPieces, eatenValue, pricePaid, worthIt }) {
  const [note, setNote] = useState('')

  async function handleShare() {
    const text = buildSummary({ totalPieces, eatenValue, pricePaid, worthIt })
    setNote('')

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'WorthBite meal',
          text,
        })
        setNote('Shared.')
        return
      }
    } catch (err) {
      // User cancel should stay quiet; other failures fall through to copy.
      if (err?.name === 'AbortError') return
    }

    try {
      await navigator.clipboard.writeText(text)
      setNote('Summary copied.')
    } catch {
      setNote('Could not share or copy. Try again.')
    }
  }

  return (
    <div className="share-summary">
      <button type="button" className="btn btn--secondary btn--block" onClick={handleShare}>
        Share summary
      </button>
      {note && (
        <p className="share-summary__note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
