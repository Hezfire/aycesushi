/**
 * DEFAULT MENU — estimated sushi menu values (per piece / serving).
 * Used when a restaurant has no stored menu yet.
 */

export const DEFAULT_MENU_ITEMS = [
  { id: 'salmon-nigiri', name: 'Salmon Nigiri', pricePerPiece: 1.25, category: 'Nigiri', pricingUnit: 'piece' },
  { id: 'tuna-nigiri', name: 'Tuna Nigiri', pricePerPiece: 1.35, category: 'Nigiri', pricingUnit: 'piece' },
  { id: 'eel-nigiri', name: 'Eel Nigiri', pricePerPiece: 1.5, category: 'Nigiri', pricingUnit: 'piece' },
  { id: 'shrimp-nigiri', name: 'Shrimp Nigiri', pricePerPiece: 1.0, category: 'Nigiri', pricingUnit: 'piece' },
  { id: 'yellowtail-nigiri', name: 'Yellowtail Nigiri', pricePerPiece: 1.4, category: 'Nigiri', pricingUnit: 'piece' },
  { id: 'tuna-sashimi', name: 'Tuna Sashimi', pricePerPiece: 1.6, category: 'Sashimi', pricingUnit: 'piece' },
  { id: 'salmon-sashimi', name: 'Salmon Sashimi', pricePerPiece: 1.5, category: 'Sashimi', pricingUnit: 'piece' },
  { id: 'spicy-tuna-roll', name: 'Spicy Tuna Roll', pricePerPiece: 0.75, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'california-roll', name: 'California Roll', pricePerPiece: 0.6, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'shrimp-tempura-roll', name: 'Shrimp Tempura Roll', pricePerPiece: 0.85, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'dragon-roll', name: 'Dragon Roll', pricePerPiece: 1.0, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'avocado-roll', name: 'Avocado Roll', pricePerPiece: 0.55, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'cucumber-roll', name: 'Cucumber Roll', pricePerPiece: 0.45, category: 'Rolls', pricingUnit: 'piece' },
  { id: 'edamame', name: 'Edamame (serving)', pricePerPiece: 2.5, category: 'Appetizers', pricingUnit: 'order' },
  { id: 'miso-soup', name: 'Miso Soup', pricePerPiece: 1.5, category: 'Appetizers', pricingUnit: 'order' },
]

export const CATEGORY_ORDER = ['Nigiri', 'Sashimi', 'Rolls', 'Appetizers', 'Other']

export function inferCategory(name = '') {
  const n = String(name).toLowerCase()
  if (/\bnigiri\b/.test(n)) return 'Nigiri'
  if (/\bsashimi\b/.test(n)) return 'Sashimi'
  if (/\broll\b|\bmaki\b/.test(n)) return 'Rolls'
  if (/edamame|miso|soup|salad|appetizer|gyoza|tempura(?!.*roll)/.test(n)) return 'Appetizers'
  return 'Other'
}
