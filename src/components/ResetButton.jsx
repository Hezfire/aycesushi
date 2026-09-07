/**
 * ResetButton — clear piece counts only, or fully start a new meal
 * (restores the default menu and clears price).
 */

export default function ResetButton({ onClearCounts, onReset }) {
  function handleClearCounts() {
    const confirmed = window.confirm(
      'Clear all piece counts? Your menu and AYCE price stay the same.',
    )
    if (confirmed) onClearCounts()
  }

  function handleNewMeal() {
    const confirmed = window.confirm(
      'Start a new meal? This clears your price and piece counts, and restores the default menu. Any imported or custom menu will be lost.',
    )
    if (confirmed) onReset()
  }

  return (
    <div className="reset-wrap">
      <div className="reset-wrap__actions">
        <button type="button" className="btn btn--ghost btn--block" onClick={handleClearCounts}>
          Clear counts
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={handleNewMeal}>
          New meal
        </button>
      </div>
      <p className="reset-hint">Progress auto-saves on this phone/browser until you reset.</p>
    </div>
  )
}
