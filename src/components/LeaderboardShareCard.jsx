/**
 * LeaderboardShareCard — shareable “I beat the buffet” result.
 */

import { useState } from 'react'
import { formatMoney } from '../utils/money'
import { formatBeat, rankLabel } from '../utils/leaderboardFormat'

export default function LeaderboardShareCard({
  restaurantName,
  aycePricePaid,
  totalMenuValueEaten,
  beatBuffetBy,
  rank,
  piecesEaten,
  leaderboardPath,
}) {
  const [note, setNote] = useState('')
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${leaderboardPath}`
      : leaderboardPath

  const shareText = [
    `I BEAT ${String(restaurantName || 'the buffet').toUpperCase()}`,
    `Paid: ${formatMoney(aycePricePaid)}`,
    `Value eaten: ${formatMoney(totalMenuValueEaten)}`,
    `Beat buffet by: ${formatBeat(beatBuffetBy)}`,
    `Rank: ${rankLabel(rank)}`,
    piecesEaten != null ? `Pieces eaten: ${piecesEaten}` : null,
    'Think you can beat me?',
    url,
  ]
    .filter(Boolean)
    .join('\n')

  async function handleShare() {
    setNote('')
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: `WorthBite — ${restaurantName}`,
          text: shareText,
          url,
        })
        setNote('Shared.')
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(shareText)
      setNote('Result copied.')
    } catch {
      setNote('Could not share. Copy the link manually.')
    }
  }

  return (
    <div className="lb-share-card">
      <p className="lb-share-card__eyebrow">I beat</p>
      <h3 className="lb-share-card__title">{restaurantName}</h3>
      <ul className="lb-share-card__stats">
        <li>
          <span>Paid</span>
          <strong>{formatMoney(aycePricePaid)}</strong>
        </li>
        <li>
          <span>Value eaten</span>
          <strong>{formatMoney(totalMenuValueEaten)}</strong>
        </li>
        <li>
          <span>Beat buffet by</span>
          <strong className={beatBuffetBy >= 0 ? 'is-ahead' : 'is-behind'}>
            {formatBeat(beatBuffetBy)}
          </strong>
        </li>
        <li>
          <span>Rank</span>
          <strong>{rankLabel(rank)}</strong>
        </li>
        {piecesEaten != null && (
          <li>
            <span>Pieces</span>
            <strong>{piecesEaten}</strong>
          </li>
        )}
      </ul>
      <p className="lb-share-card__cta">Think you can beat me?</p>
      <button type="button" className="btn btn--secondary btn--block" onClick={handleShare}>
        Share result
      </button>
      {note && (
        <p className="lb-share-card__note" role="status">
          {note}
        </p>
      )}
    </div>
  )
}
