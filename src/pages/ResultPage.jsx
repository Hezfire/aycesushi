/**
 * ResultPage — end-of-meal score, leaderboard submit, share.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMealSession } from '../hooks/useMealSession'
import LeaderboardSubmit from '../components/LeaderboardSubmit'
import LeaderboardShareCard from '../components/LeaderboardShareCard'
import { formatBeat, rankLabel } from '../utils/leaderboardFormat'
import { formatMoney } from '../utils/money'

export default function ResultPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const meal = useMealSession()
  const [submitResult, setSubmitResult] = useState(null)

  const {
    isCompletable,
    completed,
    finishMeal,
    worthIt,
    restaurantName,
    city,
    pricePaidNumber,
    eatenValue,
    totalPieces,
    leaderboardSubmitted,
    clientMealId,
    visitorId,
    restaurantId: sessionRestaurantId,
    markLeaderboardSubmitted,
  } = meal

  useEffect(() => {
    if (!isCompletable) {
      navigate(`/restaurants/${restaurantId}/meal`, { replace: true })
      return
    }
    if (!completed) {
      finishMeal()
    }
  }, [isCompletable, completed, finishMeal, restaurantId, navigate])

  const beat = worthIt.difference
  const won = beat >= -0.005
  const rank = submitResult?.rank
  const entryCount = submitResult?.entryCount
  const pctBeaten =
    rank != null && entryCount > 1
      ? Math.max(0, Math.round(((entryCount - rank) / (entryCount - 1)) * 100))
      : null

  return (
    <div className="app app--result">
      <header className="result-hero">
        <p className="app-header__brand">WorthBite</p>
        <h1 className={won ? 'result-hero__win' : 'result-hero__lose'}>
          {won ? 'YOU BEAT THE BUFFET' : 'THE BUFFET WON THIS ROUND'}
        </h1>
        <p className="result-hero__beat">{formatBeat(beat)}</p>
        <p className="result-hero__place">
          {restaurantName}
          {city ? ` — ${city}` : ''}
        </p>
      </header>

      <main className="app-main">
        <ul className="result-stats">
          <li>
            <span>You paid</span>
            <strong>{formatMoney(pricePaidNumber)}</strong>
          </li>
          <li>
            <span>Menu value</span>
            <strong>{formatMoney(eatenValue)}</strong>
          </li>
          <li>
            <span>Sushi eaten</span>
            <strong>
              {totalPieces} piece{totalPieces === 1 ? '' : 's'}
            </strong>
          </li>
          {rank != null && (
            <li>
              <span>Rank</span>
              <strong>
                {rankLabel(rank)} at {restaurantName}
              </strong>
            </li>
          )}
        </ul>

        {pctBeaten != null && (
          <p className="result-pct">You beat {pctBeaten}% of logged diners</p>
        )}

        <LeaderboardSubmit
          isCompletable={completed && isCompletable}
          alreadySubmitted={leaderboardSubmitted}
          clientMealId={clientMealId}
          visitorId={visitorId}
          restaurantId={sessionRestaurantId || restaurantId}
          restaurantName={restaurantName}
          aycePricePaid={pricePaidNumber}
          totalMenuValueEaten={eatenValue}
          piecesEaten={totalPieces}
          onSubmitted={(data) => {
            markLeaderboardSubmitted()
            setSubmitResult(data)
          }}
          compact
        />

        <LeaderboardShareCard
          restaurantName={restaurantName}
          aycePricePaid={pricePaidNumber}
          totalMenuValueEaten={eatenValue}
          beatBuffetBy={submitResult?.entry?.beatBuffetBy ?? beat}
          rank={submitResult?.rank}
          piecesEaten={totalPieces}
          leaderboardPath={`/restaurants/${restaurantId}/leaderboard`}
        />

        <Link
          className="btn btn--secondary btn--block"
          to={`/restaurants/${restaurantId}/leaderboard`}
        >
          View {restaurantName || 'restaurant'} leaderboard
        </Link>
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => navigate(`/restaurants/${restaurantId}/meal`)}
        >
          Start another meal
        </button>
        <Link className="btn btn--ghost btn--block" to="/">
          Home
        </Link>
      </main>
    </div>
  )
}
