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
import ShareSummary from './components/ShareSummary'
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
          Log pieces as you eat. Compare AYCE to grocery sushi value.
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
        <ShareSummary
          totalPieces={totalPieces}
          eatenValue={eatenValue}
          pricePaid={pricePaidNumber}
          worthIt={worthIt}
        />
        <ResetButton onClearCounts={clearCounts} onReset={resetSession} />
      </main>

      <footer className="app-footer">
        <p>
          WorthBite compares grocery/store-bought sushi value (HEB/Kroger-style) to what you paid
          for AYCE. Imported dish names come from the restaurant menu; dollar amounts are grocery
          estimates for table math—not official store or restaurant prices. Progress stays on this
          phone until you reset. Tap New meal if prices still look like an older session.
        </p>
      </footer>
    </div>
  )
}
