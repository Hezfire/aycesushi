/**
 * Restaurant detail — preview top 3 + link to full leaderboard.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchRestaurant } from '../utils/leaderboardApi'
import { formatBeat, rankLabel } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'

export default function RestaurantPage() {
  const { restaurantId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRestaurant(restaurantId)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load restaurant.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  if (loading) {
    return (
      <div className="app">
        <p className="page-status">Loading restaurant…</p>
      </div>
    )
  }

  if (error || !data?.restaurant) {
    return (
      <div className="app">
        <p className="import-panel__error" role="alert">
          {error || 'Restaurant not found.'}
        </p>
        <Link className="btn btn--ghost" to="/">
          Back to meal tracker
        </Link>
      </div>
    )
  }

  const { restaurant, topEntries, entryCount } = data

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__brand">WorthBite</p>
        <h1>{restaurant.name}</h1>
        <p className="app-header__tagline">
          {restaurant.city}, {restaurant.state}
        </p>
      </header>

      <main className="app-main">
        <section className="import-panel">
          <div className="section-head">
            <h2>Restaurant leaderboard</h2>
            <p>
              {entryCount} logged meal{entryCount === 1 ? '' : 's'}
              {restaurant.aycePriceDefault != null
                ? ` · typical AYCE ${formatMoney(restaurant.aycePriceDefault)}`
                : ''}
            </p>
          </div>

          {topEntries.length === 0 ? (
            <p className="lb-empty">
              No scores yet. Be the first to beat the buffet at {restaurant.name}.
            </p>
          ) : (
            <ul className="lb-preview-list">
              {topEntries.map((entry) => (
                <li key={entry.id} className="lb-preview-row">
                  <span className="lb-preview-row__rank">{rankLabel(entry.rank)}</span>
                  <span className="lb-preview-row__name">{entry.displayName}</span>
                  <strong className="lb-preview-row__beat">{formatBeat(entry.beatBuffetBy)}</strong>
                </li>
              ))}
            </ul>
          )}

          <div className="lb-submit__actions" style={{ marginTop: '0.85rem' }}>
            <Link className="btn btn--primary" to={`/restaurants/${restaurant.id}/leaderboard`}>
              View full leaderboard
            </Link>
            <Link className="btn btn--ghost" to="/">
              Start a meal
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
