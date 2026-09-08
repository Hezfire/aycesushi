/**
 * Restaurant detail — start meal, edit price, top-3 preview.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchRestaurant, updateRestaurant } from '../utils/restaurantApi'
import { formatBeat, rankLabel } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'

export default function RestaurantPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRestaurant(restaurantId)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setPriceDraft(
            payload.restaurant?.aycePriceDefault != null
              ? String(payload.restaurant.aycePriceDefault)
              : '',
          )
        }
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

  async function savePrice(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await updateRestaurant(restaurantId, {
        aycePriceDefault: priceDraft,
      })
      setData((prev) => ({
        ...prev,
        restaurant: { ...prev.restaurant, ...result.restaurant },
      }))
      setEditingPrice(false)
    } catch (err) {
      setError(err.message || 'Could not update price.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <p className="page-status">Loading restaurant…</p>
      </div>
    )
  }

  if (error && !data?.restaurant) {
    return (
      <div className="app">
        <p className="import-panel__error" role="alert">
          {error}
        </p>
        <Link className="btn btn--ghost" to="/find">
          Find a restaurant
        </Link>
      </div>
    )
  }

  const { restaurant, topEntries, entryCount, topScore } = data
  const count = entryCount ?? restaurant.entryCount ?? 0

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
        <section className="restaurant-meta">
          <div className="restaurant-meta__row">
            <span>AYCE price</span>
            <strong>
              {restaurant.aycePriceDefault != null
                ? formatMoney(restaurant.aycePriceDefault)
                : 'Not set'}
            </strong>
          </div>
          {!editingPrice ? (
            <button type="button" className="btn btn--ghost" onClick={() => setEditingPrice(true)}>
              Edit price
            </button>
          ) : (
            <form className="restaurant-meta__edit" onSubmit={savePrice}>
              <input
                type="text"
                inputMode="decimal"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                required
              />
              <button type="submit" className="btn btn--primary" disabled={saving}>
                Save
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditingPrice(false)}>
                Cancel
              </button>
            </form>
          )}
          {error && (
            <p className="import-panel__error" role="alert">
              {error}
            </p>
          )}
          <div className="restaurant-meta__row">
            <span>Top score</span>
            <strong>{topScore != null ? formatBeat(topScore) : '—'}</strong>
          </div>
          <div className="restaurant-meta__row">
            <span>Logged meals</span>
            <strong>{count}</strong>
          </div>
        </section>

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => navigate(`/restaurants/${restaurant.id}/meal`)}
        >
          Start Meal
        </button>

        <section className="import-panel">
          <div className="section-head">
            <h2>Leaderboard</h2>
            <p>Top scores at {restaurant.name}</p>
          </div>

          {topEntries.length === 0 ? (
            <p className="lb-empty">No scores yet. Be the first to log a meal here.</p>
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
            <Link className="btn btn--secondary" to={`/restaurants/${restaurant.id}/leaderboard`}>
              View full leaderboard
            </Link>
            <Link className="btn btn--ghost" to="/find">
              Change restaurant
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
