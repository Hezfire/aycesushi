/**
 * AboutCalculations — short methodology disclosure (not in the meal flow).
 */

import { useState } from 'react'

export default function AboutCalculations() {
  const [open, setOpen] = useState(false)

  return (
    <div className="about-calc">
      <button
        type="button"
        className="about-calc__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        About calculations
      </button>
      {open && (
        <p className="about-calc__body">
          WorthBite estimates comparable sushi menu value from what you log, then subtracts what
          you paid for AYCE. Values may be estimated when restaurant pricing isn’t available —
          they are not official store or restaurant prices. Scores on leaderboards are computed
          on the server.
        </p>
      )}
    </div>
  )
}
