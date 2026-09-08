/**
 * WorthItBanner — compact sticky live score (tap to expand).
 */

import { useEffect, useState } from 'react'
import { formatMoney } from '../utils/money'
import { formatBeat } from '../utils/leaderboardFormat'
import { getDistanceToRecord, getStickyScoreLines } from '../utils/mealScore'

export default function WorthItBanner({
  eatenValue,
  pricePaid,
  worthIt,
  totalPieces,
  topBeatToBeat = null,
  restaurantName = '',
  brokeEvenCelebrated = false,
  onBrokeEven,
}) {
  const [expanded, setExpanded] = useState(false)
  const { difference, status, message } = worthIt
  const lines = getStickyScoreLines({
    eatenValue,
    pricePaid,
    totalPieces,
    difference,
  })
  const record = getDistanceToRecord(difference, topBeatToBeat)
  const crossed =
    pricePaid > 0 && difference >= -0.005 && (status === 'even' || status === 'ahead' || status === 'crushing')

  useEffect(() => {
    if (!crossed || brokeEvenCelebrated) return
    onBrokeEven?.()
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(30)
      }
    } catch {
      /* ignore */
    }
  }, [crossed, brokeEvenCelebrated, onBrokeEven])

  const recordLabel =
    record?.kind === 'lead' && restaurantName
      ? `New #1 at ${restaurantName}`
      : record?.label

  return (
    <section
      className={`worth-banner worth-banner--${status} ${expanded ? 'worth-banner--expanded' : 'worth-banner--collapsed'} ${crossed && !brokeEvenCelebrated ? 'worth-banner--celebrate' : ''}`}
      aria-live="polite"
    >
      <button
        type="button"
        className="worth-banner__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="worth-banner__collapsed">
          <p className="worth-banner__primary">{lines.primary}</p>
          <p className="worth-banner__secondary">
            {lines.beatMode ? lines.secondary : lines.piecesLabel}
          </p>
        </div>
        <span className="worth-banner__chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="worth-banner__details">
          {crossed && (
            <p className="worth-banner__beat-headline">YOU BEAT THE BUFFET</p>
          )}
          <div className="worth-banner__main">
            <div className="worth-banner__stat">
              <span className="worth-banner__label">Menu value</span>
              <strong className="worth-banner__value">{formatMoney(eatenValue)}</strong>
            </div>
            <div className="worth-banner__divider" aria-hidden="true" />
            <div className="worth-banner__stat">
              <span className="worth-banner__label">AYCE paid</span>
              <strong className="worth-banner__paid">{formatMoney(pricePaid)}</strong>
            </div>
          </div>
          <div className="worth-banner__status">
            <p className="worth-banner__diff">
              {pricePaid > 0
                ? difference >= 0
                  ? formatBeat(difference)
                  : `${formatMoney(Math.abs(difference))} to break even`
                : 'Set AYCE price'}
            </p>
            <p className="worth-banner__message">{message}</p>
            <p className="worth-banner__pieces">
              {totalPieces} piece{totalPieces === 1 ? '' : 's'} logged
            </p>
            {recordLabel && <p className="worth-banner__record">{recordLabel}</p>}
          </div>
          {pricePaid > 0 && (
            <div
              className="worth-banner__meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={lines.progressPct}
              aria-label="Progress toward break-even"
            >
              <div
                className="worth-banner__meter-fill"
                style={{ width: `${lines.progressPct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
