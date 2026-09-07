/**
 * ResetButton — clears the current meal and reloads the default menu.
 */

export default function ResetButton({ onReset }) {
  function handleClick() {
    const confirmed = window.confirm(
      'Start a new meal? This clears your piece counts and price for this session.',
    )
    if (confirmed) onReset()
  }

  return (
    <div className="reset-wrap">
      <button type="button" className="btn btn--ghost btn--block" onClick={handleClick}>
        New meal / reset
      </button>
      <p className="reset-hint">Progress auto-saves on this phone/browser until you reset.</p>
    </div>
  )
}
