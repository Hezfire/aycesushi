/**
 * App — main screen layout for the AYCE Sushi Worth-It Calculator.
 * Wire-up only; meal logic lives in useMealSession.
 */

import './App.css'
import PriceInput from './components/PriceInput'
import WorthItBanner from './components/WorthItBanner'
import ImportMenuPanel from './components/ImportMenuPanel'
import ItemList from './components/ItemList'
import AddItemForm from './components/AddItemForm'
import ResetButton from './components/ResetButton'
import { useMealSession } from './hooks/useMealSession'

export default function App() {
  const {
    pricePaid,
    items,
    setPricePaid,
    adjustCount,
    updateItem,
    removeItem,
    addCustomItem,
    clearCounts,
    resetSession,
    replaceMenu,
    eatenValue,
    pricePaidNumber,
    worthIt,
    totalPieces,
  } = useMealSession()

  return (
    <div className="app">
      <header className="app-header">
        <p className="app-header__brand">WorthBite</p>
        <h1>AYCE Sushi Worth-It</h1>
        <p className="app-header__tagline">
          Log pieces as you eat. See when the buffet pays for itself.
        </p>
      </header>

      <WorthItBanner
        eatenValue={eatenValue}
        pricePaid={pricePaidNumber}
        worthIt={worthIt}
        totalPieces={totalPieces}
      />

      <main className="app-main">
        <PriceInput value={pricePaid} onChange={setPricePaid} />
        <ImportMenuPanel onReplaceMenu={replaceMenu} />
        <ItemList
          items={items}
          onAdjustCount={adjustCount}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
        />
        <AddItemForm onAdd={addCustomItem} />
        <ResetButton onClearCounts={clearCounts} onReset={resetSession} />
      </main>

      <footer className="app-footer">
        <p>
          Default prices live in <code>src/data/defaultMenu.js</code>. Or import from a restaurant
          menu URL above. AI prices are typical-value estimates for worth-it math.
        </p>
      </footer>
    </div>
  )
}
