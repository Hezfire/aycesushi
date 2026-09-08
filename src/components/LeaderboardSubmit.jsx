/**
 * LeaderboardSubmit — CTA + form to post a completed meal to a restaurant board.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { submitLeaderboardScore } from '../utils/leaderboardApi'
import { formatBeat, rankLabel } from '../utils/leaderboardFormat'
import LeaderboardShareCard from './LeaderboardShareCard'

export default function LeaderboardSubmit({
  isCompletable,
  alreadySubmitted,
  clientMealId,
  visitorId,
  aycePricePaid,
  totalMenuValueEaten,
  piecesEaten,
  onSubmitted,
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  if (!isCompletable) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await submitLeaderboardScore({
        clientMealId,
        visitorId,
        displayName,
        restaurant: { name: restaurantName, city, state },
        aycePricePaid,
        totalMenuValueEaten,
        piecesEaten,
      })
      setResult(data)
      onSubmitted?.(data)
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Submit failed.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const { entry, rank, restaurant } = result
    const path = `/restaurants/${restaurant.id}/leaderboard`
    return (
      <section className="lb-submit lb-submit--success" aria-live="polite">
        <h2>You beat the buffet by {formatBeat(entry.beatBuffetBy)}</h2>
        <p className="lb-submit__rank">
          {rankLabel(rank)} at {restaurant.name}
        </p>
        <p className="lb-submit__hint">Think you can beat the top score?</p>
        <Link className="btn btn--primary btn--block" to={path}>
          View leaderboard
        </Link>
        <LeaderboardShareCard
          restaurantName={restaurant.name}
          aycePricePaid={entry.aycePricePaid}
          totalMenuValueEaten={entry.totalMenuValueEaten}
          beatBuffetBy={entry.beatBuffetBy}
          rank={rank}
          piecesEaten={entry.piecesEaten}
          leaderboardPath={path}
        />
      </section>
    )
  }

  if (alreadySubmitted) {
    return (
      <section className="lb-submit">
        <p className="lb-submit__done">This meal is already on a leaderboard.</p>
      </section>
    )
  }

  return (
    <section className="lb-submit">
      {!open ? (
        <button type="button" className="btn btn--primary btn--block" onClick={() => setOpen(true)}>
          Add me to the leaderboard
        </button>
      ) : (
        <form className="lb-submit__form" onSubmit={handleSubmit}>
          <div className="section-head">
            <h2>Add me to the leaderboard</h2>
            <p>Did you beat the buffet? Drop your name and restaurant.</p>
          </div>

          <label>
            <span>Display name</span>
            <input
              type="text"
              maxLength={30}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="SushiShark"
              disabled={loading}
            />
          </label>
          <label>
            <span>Restaurant</span>
            <input
              type="text"
              maxLength={80}
              required
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Kimoto Premium Sushi"
              disabled={loading}
            />
          </label>
          <div className="lb-submit__row">
            <label>
              <span>City</span>
              <input
                type="text"
                maxLength={60}
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Houston"
                disabled={loading}
              />
            </label>
            <label>
              <span>State</span>
              <input
                type="text"
                maxLength={40}
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="TX"
                disabled={loading}
              />
            </label>
          </div>

          {error && (
            <p className="import-panel__error" role="alert">
              {error}
            </p>
          )}

          <div className="lb-submit__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Submitting…' : 'Submit score'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
