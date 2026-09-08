/**
 * Worth-it math: compare estimated menu value eaten vs AYCE price paid.
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
  let message = 'Enter what you paid, then tap items as you eat.'

  if (paid <= 0 && value <= 0) {
    status = 'waiting'
    message = 'Enter what you paid, then tap items as you eat.'
  } else if (paid <= 0 && value > 0) {
    status = 'tracking'
    message = 'Add your AYCE price to see if you’re ahead.'
  } else if (difference < -0.005) {
    const remaining = paid - value
    status = 'behind'
    message = `${formatShort(remaining)} to break even.`
  } else if (Math.abs(difference) < 0.005) {
    status = 'even'
    message = 'YOU BEAT THE BUFFET — break even!'
  } else if (ratio < 1.25) {
    status = 'ahead'
    message = 'YOU BEAT THE BUFFET'
  } else {
    status = 'crushing'
    message = 'YOU BEAT THE BUFFET'
  }

  return { difference, ratio, status, message }
}

function formatShort(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
