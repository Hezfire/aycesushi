/**
 * WorthItBanner — sticky summary: value eaten vs price paid, plus status message.
 */

import { formatMoney } from '../utils/money'

export default function WorthItBanner({ eatenValue, pricePaid, worthIt, totalPieces }) {
  const { difference, status, message } = worthIt
  const ahead = difference >= 0 && pricePaid > 0
  const diffLabel =
    pricePaid <= 0
      ? 'Enter price above'
      : ahead
        ? `+${formatMoney(difference)} ahead`
        : `${formatMoney(Math.abs(difference))} to go`

  return (
    <section className={`worth-banner worth-banner--${status}`} aria-live="polite">
      <div className="worth-banner__main">
        <div className="worth-banner__stat">
          <span className="worth-banner__label">Grocery value</span>
          <strong className="worth-banner__value">{formatMoney(eatenValue)}</strong>
        </div>
        <div className="worth-banner__divider" aria-hidden="true" />
        <div className="worth-banner__stat">
          <span className="worth-banner__label">vs paid</span>
          <strong className="worth-banner__paid">{formatMoney(pricePaid)}</strong>
        </div>
      </div>
      <div className="worth-banner__status">
        <p className="worth-banner__diff">{diffLabel}</p>
        <p className="worth-banner__message">{message}</p>
        <p className="worth-banner__pieces">
          {totalPieces} piece{totalPieces === 1 ? '' : 's'} logged
        </p>
      </div>
      {pricePaid > 0 && (
        <div
          className="worth-banner__meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round((eatenValue / pricePaid) * 100))}
          aria-label="Progress toward break-even"
        >
          <div
            className="worth-banner__meter-fill"
            style={{ width: `${Math.min(100, (eatenValue / pricePaid) * 100)}%` }}
          />
        </div>
      )}
    </section>
  )
}
