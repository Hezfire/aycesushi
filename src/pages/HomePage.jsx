/**
 * HomePage — restaurant-first landing: “Did you beat the buffet?”
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchRecentRecords } from '../utils/restaurantApi'
import { formatBeat } from '../utils/leaderboardFormat'
import AboutCalculations from '../components/AboutCalculations'

export default function HomePage() {
  const [recent, setRecent] = useState([])

  useEffect(() => {
    let cancelled = false
    fetchRecentRecords(5)
      .then((data) => {
        if (!cancelled) setRecent(data.entries || [])
      })
      .catch(() => {
        if (!cancelled) setRecent([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app app--landing">
      <header className="landing-hero">
        <p className="app-header__brand">WorthBite</p>
        <h1 className="landing-hero__headline">Did you beat the buffet?</h1>
        <p className="landing-hero__sub">
          Track what you eat at AYCE sushi and see if you got your money’s worth.
        </p>
        <Link className="btn btn--primary btn--block landing-hero__cta" to="/find">
          Find your restaurant
        </Link>
        <p className="landing-hero__secondary">
          <Link to="/find?add=1">Or start manually</Link>
        </p>
      </header>

      {recent.length > 0 && (
        <section className="recent-records" aria-label="Recent records">
          <h2 className="recent-records__title">Recent records</h2>
          <ul className="recent-records__list">
            {recent.map((entry) => (
              <li key={entry.id}>
                <Link
                  className="recent-records__row"
                  to={`/restaurants/${entry.restaurantId}/leaderboard`}
                >
                  <span>
                    <strong>{entry.restaurantName}</strong>
                    {entry.city ? ` — ${entry.city}` : ''}
                  </span>
                  <span className="recent-records__beat">{formatBeat(entry.beatBuffetBy)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="app-footer app-footer--compact">
        <AboutCalculations />
      </footer>
    </div>
  )
}
