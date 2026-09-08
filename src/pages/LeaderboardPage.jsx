/**
 * Full restaurant leaderboard page — top 25 + summary stats.
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchLeaderboard } from '../utils/leaderboardApi'
import { formatBeat, formatShortDate, rankLabel } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'
import { getVisitorId } from '../utils/visitorId'

export default function LeaderboardPage() {
  const { restaurantId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const visitorId = getVisitorId()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLeaderboard(restaurantId, 25)
      .then((payload) => {
        if (!cancelled) setData(payload)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load leaderboard.')
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
        <p className="page-status">Loading leaderboard…</p>
      </div>
    )
  }

  if (error || !data?.restaurant) {
    return (
      <div className="app">
        <p className="import-panel__error" role="alert">
          {error || 'Leaderboard not found.'}
        </p>
        <Link className="btn btn--ghost" to="/">
          Back to meal tracker
        </Link>
      </div>
    )
  }

  const { restaurant, entries, stats } = data

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__brand">WorthBite</p>
        <h1>
          {restaurant.name} — {restaurant.city}, {restaurant.state}
        </h1>
        <p className="app-header__tagline">Restaurant-specific leaderboard · Did you beat the buffet?</p>
      </header>

      <main className="app-main">
        {stats.count > 0 && (
          <section className="lb-stats" aria-label="Leaderboard summary">
            <div className="lb-stats__card">
              <span>Top score</span>
              <strong>{formatBeat(stats.top)}</strong>
            </div>
            <div className="lb-stats__card">
              <span>Average diner</span>
              <strong>{formatBeat(stats.avgBeat)}</strong>
            </div>
            <div className="lb-stats__card">
              <span>Average value eaten</span>
              <strong>{formatMoney(stats.avgValue)}</strong>
            </div>
            <div className="lb-stats__card">
              <span>Logged meals</span>
              <strong>{stats.count}</strong>
            </div>
          </section>
        )}

        {entries.length === 0 ? (
          <section className="import-panel">
            <p className="lb-empty">
              No scores yet. Be the first to beat the buffet at {restaurant.name}.
            </p>
            <Link className="btn btn--primary btn--block" to="/">
              Start a meal
            </Link>
          </section>
        ) : (
          <section className="lb-board" aria-label="Rankings">
            <ul className="lb-card-list">
              {entries.map((entry, index) => {
                const rank = index + 1
                const mine = entry.visitorId === visitorId
                return (
                  <li
                    key={entry.id}
                    className={`lb-card ${mine ? 'lb-card--mine' : ''}`}
                  >
                    <div className="lb-card__top">
                      <span className="lb-card__rank">{rankLabel(rank)}</span>
                      <strong className="lb-card__name">
                        {entry.displayName}
                        {mine ? ' (you)' : ''}
                      </strong>
                      <span
                        className={`lb-card__beat ${
                          entry.beatBuffetBy >= 0 ? 'is-ahead' : 'is-behind'
                        }`}
                      >
                        {formatBeat(entry.beatBuffetBy)}
                      </span>
                    </div>
                    <div className="lb-card__meta">
                      <span>Value {formatMoney(entry.totalMenuValueEaten)}</span>
                      <span>Paid {formatMoney(entry.aycePricePaid)}</span>
                      <span>{entry.piecesEaten} pcs</span>
                      <span>{formatShortDate(entry.completedAt)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <Link className="btn btn--ghost btn--block" to={`/restaurants/${restaurant.id}`}>
          Restaurant page
        </Link>
        <Link className="btn btn--secondary btn--block" to="/">
          Start a meal
        </Link>
      </main>
    </div>
  )
}
