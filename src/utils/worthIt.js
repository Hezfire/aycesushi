/**
 * Worth-it math: compare estimated à la carte value eaten vs AYCE price paid.
 * Tweak thresholds here if you want different status messages.
 */

export function calcEatenValue(items) {
  return items.reduce((sum, item) => {
    const count = Number(item.count) || 0
    const price = Number(item.pricePerPiece) || 0
    return sum + count * price
  }, 0)
}

export function calcWorthIt(eatenValue, pricePaid) {
  const paid = Number(pricePaid) || 0
  const value = Number(eatenValue) || 0
  const difference = value - paid
  const ratio = paid > 0 ? value / paid : value > 0 ? Infinity : 0

  let status = 'waiting'
  let message = 'Enter what you paid, then tap pieces as you eat.'

  if (paid <= 0 && value <= 0) {
    status = 'waiting'
    message = 'Enter what you paid, then tap pieces as you eat.'
  } else if (paid <= 0 && value > 0) {
    status = 'tracking'
    message = 'Add your AYCE price above to see if you’re ahead.'
  } else if (difference < -0.005) {
    const remaining = paid - value
    status = 'behind'
    message = `Keep going — about ${formatShort(remaining)} more to break even.`
  } else if (Math.abs(difference) < 0.005) {
    status = 'even'
    message = 'Break even! Anything else is bonus value.'
  } else if (ratio < 1.25) {
    status = 'ahead'
    message = 'You’re ahead — solid value so far.'
  } else {
    status = 'crushing'
    message = 'Crushing it. AYCE is paying off big.'
  }

  return { difference, ratio, status, message }
}

function formatShort(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
