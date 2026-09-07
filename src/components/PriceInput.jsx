/**
 * PriceInput — AYCE price paid (include drinks/fees if you want them in the comparison).
 */

import { formatMoney } from '../utils/money'

export default function PriceInput({ value, onChange }) {
  return (
    <section className="price-input" aria-labelledby="price-heading">
      <div className="price-input__copy">
        <h2 id="price-heading">What you paid</h2>
        <p>Per person. Worth-it math uses grocery sushi value, not restaurant à la carte.</p>
      </div>
      <label className="price-input__field">
        <span className="price-input__prefix">$</span>
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          placeholder="32.99"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="AYCE price paid in dollars"
        />
      </label>
      {Number.parseFloat(String(value).replace(/[^0-9.]/g, '')) > 0 && (
        <p className="price-input__hint">Break-even target: {formatMoney(Number.parseFloat(String(value).replace(/[^0-9.]/g, '')))}</p>
      )}
    </section>
  )
}
