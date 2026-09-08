/**
 * MealPage — live tracker at a restaurant (score → log → finish).
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import WorthItBanner from '../components/WorthItBanner'
import PriceInput from '../components/PriceInput'
import ItemList from '../components/ItemList'
import AddItemForm from '../components/AddItemForm'
import ImportMenuPanel from '../components/ImportMenuPanel'
import AboutCalculations from '../components/AboutCalculations'
import { useMealSession } from '../hooks/useMealSession'
import { DEFAULT_MENU_ITEMS, inferCategory } from '../data/defaultMenu'
import { fetchRestaurant, fetchRestaurantMenu, saveRestaurantMenu } from '../utils/restaurantApi'

export default function MealPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const meal = useMealSession()
  const startedRef = useRef(false)
  const [bootError, setBootError] = useState('')
  const [booting, setBooting] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [awaitingMenuChoice, setAwaitingMenuChoice] = useState(false)

  const {
    startMeal,
    setTopBeatToBeat,
    replaceMenu,
    restaurantId: sessionRestaurantId,
    completed,
    items,
    hasStoredMenu,
    restaurantName,
    city,
    state,
    pricePaid,
    pricePaidNumber,
    eatenValue,
    worthIt,
    totalPieces,
    topBeatToBeat,
    brokeEvenCelebrated,
    markBrokeEvenCelebrated,
    setPricePaid,
    adjustCount,
    updateItem,
    removeItem,
    addCustomItem,
    isCompletable,
    finishMeal,
  } = meal

  useEffect(() => {
    let cancelled = false
    startedRef.current = false

    async function boot() {
      setBooting(true)
      setBootError('')
      try {
        const [restaurantPayload, menuPayload] = await Promise.all([
          fetchRestaurant(restaurantId),
          fetchRestaurantMenu(restaurantId).catch(() => ({ items: [] })),
        ])
        if (cancelled) return
        const r = restaurantPayload.restaurant
        const storedItems = menuPayload.items || []
        const resume =
          sessionRestaurantId === restaurantId && !completed && items.length > 0

        if (!resume) {
          if (storedItems.length) {
            startMeal({
              restaurantId: r.id,
              restaurantName: r.name,
              city: r.city,
              state: r.state,
              pricePaid: r.aycePriceDefault ?? '',
              topBeatToBeat: restaurantPayload.topScore ?? r.topScore,
              hasStoredMenu: true,
              items: storedItems.map((item) => ({
                id: item.id,
                name: item.name,
                pricePerPiece: item.estimatedValue ?? item.pricePerPiece,
                category: item.category || inferCategory(item.name),
                pricingUnit: item.pricingUnit || 'piece',
                isCustom: false,
              })),
            })
            setAwaitingMenuChoice(false)
          } else {
            startMeal({
              restaurantId: r.id,
              restaurantName: r.name,
              city: r.city,
              state: r.state,
              pricePaid: r.aycePriceDefault ?? '',
              topBeatToBeat: restaurantPayload.topScore ?? r.topScore,
              hasStoredMenu: false,
              items: [],
            })
            setAwaitingMenuChoice(true)
          }
        } else {
          setTopBeatToBeat(restaurantPayload.topScore ?? r.topScore)
          setAwaitingMenuChoice(!hasStoredMenu && items.length === 0)
        }
        startedRef.current = true
      } catch (err) {
        if (!cancelled) setBootError(err.message || 'Could not start meal.')
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
    // Boot once per restaurant route visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  async function handleReplaceMenu(menuItems) {
    const ok = replaceMenu(
      menuItems.map((item) => ({
        ...item,
        category: item.category || inferCategory(item.name),
        source: 'import',
      })),
      { hasStoredMenu: true, keepMealId: true },
    )
    if (ok && restaurantId) {
      try {
        await saveRestaurantMenu(
          restaurantId,
          menuItems.map((item) => ({
            name: item.name,
            estimatedValue: item.pricePerPiece,
            category: item.category || inferCategory(item.name),
            pricingUnit: 'piece',
            source: 'import',
          })),
        )
      } catch {
        /* local menu still applied */
      }
      setAwaitingMenuChoice(false)
      setShowImport(false)
    }
    return ok
  }

  function useDefaultMenu() {
    replaceMenu(DEFAULT_MENU_ITEMS, { hasStoredMenu: false, keepMealId: true })
    setAwaitingMenuChoice(false)
  }

  function handleFinish() {
    finishMeal()
    navigate(`/restaurants/${restaurantId}/meal/result`)
  }

  if (booting) {
    return (
      <div className="app">
        <p className="page-status">Starting meal…</p>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="app">
        <p className="import-panel__error" role="alert">
          {bootError}
        </p>
        <Link className="btn btn--ghost" to="/find">
          Find a restaurant
        </Link>
      </div>
    )
  }

  return (
    <div className="app app--meal">
      <header className="meal-header">
        <p className="meal-header__brand">WorthBite</p>
        <h1>{restaurantName || 'Meal'}</h1>
        <p className="meal-header__meta">{[city, state].filter(Boolean).join(', ')}</p>
      </header>

      <WorthItBanner
        eatenValue={eatenValue}
        pricePaid={pricePaidNumber}
        worthIt={worthIt}
        totalPieces={totalPieces}
        topBeatToBeat={topBeatToBeat}
        restaurantName={restaurantName}
        brokeEvenCelebrated={brokeEvenCelebrated}
        onBrokeEven={markBrokeEvenCelebrated}
      />

      <main className="app-main meal-main">
        <PriceInput value={pricePaid} onChange={setPricePaid} />

        {awaitingMenuChoice && !showImport && (
          <section className="menu-empty">
            <p>We don’t have this menu yet.</p>
            <button type="button" className="btn btn--primary btn--block" onClick={useDefaultMenu}>
              Add items manually
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setShowImport(true)}>
              Upload menu
            </button>
          </section>
        )}

        {showImport && <ImportMenuPanel onReplaceMenu={handleReplaceMenu} />}

        {!awaitingMenuChoice && (
          <>
            <ItemList
              items={items}
              onAdjustCount={adjustCount}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
            />
            <AddItemForm onAdd={addCustomItem} />
            {!showImport && (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => setShowImport(true)}
              >
                Manage / upload menu
              </button>
            )}
          </>
        )}
      </main>

      <div className="meal-finish-bar">
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={!isCompletable || completed}
          onClick={handleFinish}
        >
          Finish meal
        </button>
        <Link className="meal-finish-bar__link" to={`/restaurants/${restaurantId}`}>
          Restaurant page
        </Link>
      </div>

      <footer className="app-footer app-footer--compact">
        <AboutCalculations />
      </footer>
    </div>
  )
}
