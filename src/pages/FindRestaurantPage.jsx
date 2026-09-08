/**
 * FindRestaurantPage — search WorthBite + Geoapify, or add manually.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  createRestaurant,
  createRestaurantFromGeoapify,
  searchRestaurants,
} from '../utils/restaurantApi'
import { formatBeat } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'

export default function FindRestaurantPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [results, setResults] = useState([])
  const [placeSuggestions, setPlaceSuggestions] = useState([])
  const [placesEnabled, setPlacesEnabled] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(params.get('add') === '1')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [aycePrice, setAycePrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [importingPlaceId, setImportingPlaceId] = useState('')

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      setLoading(true)
      setError('')
      searchRestaurants(query, 25, location)
        .then((data) => {
          if (cancelled) return
          setResults(data.restaurants || [])
          setPlaceSuggestions(data.placeSuggestions || [])
          setPlacesEnabled(Boolean(data.placesEnabled))
          setPlacesError(data.placesError || '')
        })
        .catch((err) => {
          if (!cancelled) setError(err.message || 'Search failed.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, location])

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

  async function handleSelectPlace(suggestion) {
    setError('')
    setImportingPlaceId(suggestion.externalPlaceId)
    try {
      const data = await createRestaurantFromGeoapify(suggestion)
      navigate(`/restaurants/${data.restaurant.id}`)
    } catch (err) {
      setError(err.message || 'Could not add that restaurant.')
    } finally {
      setImportingPlaceId('')
    }
  }

  const emptyNeon = !loading && results.length === 0
  const emptyPlaces = !loading && placeSuggestions.length === 0
  const showManualPrompt =
    !loading && emptyNeon && emptyPlaces && query.trim().length >= 2

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__brand">WorthBite</p>
        <h1>Find your restaurant</h1>
        <p className="app-header__tagline">Pick where you’re eating, then start a meal.</p>
      </header>

      <main className="app-main">
        <label className="find-search">
          <span>Restaurant name</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Hanami"
            autoFocus
          />
        </label>

        <label className="find-search">
          <span>City / location</span>
          <input
            type="search"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Austin, TX"
          />
        </label>

        {loading && <p className="page-status">Searching…</p>}
        {error && (
          <p className="import-panel__error" role="alert">
            {error}
          </p>
        )}
        {placesError && !error && (
          <p className="find-hint" role="status">
            {placesError}
          </p>
        )}

        <section className="find-section" aria-label="WorthBite restaurants">
          <h2 className="find-section__title">On WorthBite</h2>
          {emptyNeon && (
            <p className="lb-empty">
              No saved restaurants match yet.
              {!placesEnabled
                ? ' Add one below, or set GEOAPIFY_API_KEY to search places.'
                : ' Try place results below, or add one manually.'}
            </p>
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
        </section>

        {(placesEnabled || placeSuggestions.length > 0) && (
          <section className="find-section" aria-label="Place suggestions">
            <h2 className="find-section__title">From places</h2>
            {emptyPlaces && query.trim().length >= 3 && location.trim() && !loading && (
              <p className="lb-empty">No place matches. Try another spelling or add manually.</p>
            )}
            <ul className="find-list">
              {placeSuggestions.map((p) => (
                <li key={p.externalPlaceId} className="find-card">
                  <div className="find-card__info">
                    <strong>{p.name}</strong>
                    <p>
                      {p.city}
                      {p.state ? `, ${p.state}` : ''}
                    </p>
                    {p.formattedAddress && <p>{p.formattedAddress}</p>}
                  </div>
                  <div className="find-card__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={Boolean(importingPlaceId)}
                      onClick={() => handleSelectPlace(p)}
                    >
                      {importingPlaceId === p.externalPlaceId ? 'Adding…' : 'Select'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {placeSuggestions.length > 0 && (
              <p className="find-places-attr">
                Powered by{' '}
                <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
                  Geoapify
                </a>
                {' · '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  © OpenStreetMap contributors
                </a>
              </p>
            )}
          </section>
        )}

        {showManualPrompt && !showAdd && (
          <p className="find-hint">Can&apos;t find it? Add restaurant manually</p>
        )}

        {!showAdd ? (
          <button type="button" className="btn btn--secondary btn--block" onClick={() => setShowAdd(true)}>
            Add a restaurant manually
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
