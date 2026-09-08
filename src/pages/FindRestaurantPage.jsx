/**
 * FindRestaurantPage — search existing restaurants or add one manually.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createRestaurant, searchRestaurants } from '../utils/restaurantApi'
import { formatBeat } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'

export default function FindRestaurantPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(params.get('add') === '1')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [aycePrice, setAycePrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      setLoading(true)
      searchRestaurants(query, 25)
        .then((data) => {
          if (!cancelled) setResults(data.restaurants || [])
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Search failed.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const data = await createRestaurant({
        name,
        city,
        state,
        aycePriceDefault: aycePrice || undefined,
      })
      navigate(`/restaurants/${data.restaurant.id}`)
    } catch (err) {
      setError(err.message || 'Could not add restaurant.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__brand">WorthBite</p>
        <h1>Find your restaurant</h1>
        <p className="app-header__tagline">Pick where you’re eating, then start a meal.</p>
      </header>

      <main className="app-main">
        <label className="find-search">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or city"
            autoFocus
          />
        </label>

        {loading && <p className="page-status">Searching…</p>}
        {error && (
          <p className="import-panel__error" role="alert">
            {error}
          </p>
        )}

        {!loading && results.length === 0 && (
          <p className="lb-empty">No restaurants yet. Add yours below.</p>
        )}

        <ul className="find-list">
          {results.map((r) => (
            <li key={r.id} className="find-card">
              <div className="find-card__info">
                <strong>{r.name}</strong>
                <p>
                  {r.city}, {r.state}
                </p>
                <p>
                  {r.aycePriceDefault != null
                    ? `AYCE: ${formatMoney(r.aycePriceDefault)}`
                    : 'AYCE price not set'}
                  {r.topScore != null ? ` · Top score: ${formatBeat(r.topScore)}` : ''}
                </p>
              </div>
              <div className="find-card__actions">
                <Link className="btn btn--ghost" to={`/restaurants/${r.id}`}>
                  Details
                </Link>
                <Link className="btn btn--primary" to={`/restaurants/${r.id}/meal`}>
                  Start Meal
                </Link>
              </div>
            </li>
          ))}
        </ul>

        {!showAdd ? (
          <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowAdd(true)}>
            Add a restaurant
          </button>
        ) : (
          <form className="lb-submit__form" onSubmit={handleCreate}>
            <div className="section-head">
              <h2>Add restaurant</h2>
              <p>No menu upload needed — you can log items manually.</p>
            </div>
            <label>
              <span>Restaurant name</span>
              <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="lb-submit__row">
              <label>
                <span>City</span>
                <input required maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label>
                <span>State</span>
                <input required maxLength={40} value={state} onChange={(e) => setState(e.target.value)} />
              </label>
            </div>
            <label>
              <span>AYCE price (optional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={aycePrice}
                onChange={(e) => setAycePrice(e.target.value)}
                placeholder="39.99"
              />
            </label>
            <button type="submit" className="btn btn--primary btn--block" disabled={saving}>
              {saving ? 'Saving…' : 'Save & continue'}
            </button>
          </form>
        )}

        <Link className="btn btn--ghost btn--block" to="/">
          Back home
        </Link>
      </main>
    </div>
  )
}
