/**
 * DEFAULT MENU — grocery / store-bought baseline prices (per piece).
 *
 * WorthBite compares AYCE spend to what similar sushi would cost at a
 * supermarket (HEB, Kroger, Costco-pack style)—not restaurant à la carte.
 *
 * HOW TO TWEAK:
 * 1. Change each item's `name` and `pricePerPiece` (USD per piece).
 * 2. Add or delete whole objects in the array.
 * 3. Keep `id` unique (letters/numbers/dashes only, no spaces).
 * 4. Save, refresh, then tap "New meal" if an old session is still loaded.
 */

export const DEFAULT_MENU_ITEMS = [
  { id: 'salmon-nigiri', name: 'Salmon Nigiri', pricePerPiece: 1.25 },
  { id: 'tuna-nigiri', name: 'Tuna Nigiri', pricePerPiece: 1.35 },
  { id: 'eel-nigiri', name: 'Eel Nigiri', pricePerPiece: 1.5 },
  { id: 'shrimp-nigiri', name: 'Shrimp Nigiri', pricePerPiece: 1.0 },
  { id: 'yellowtail-nigiri', name: 'Yellowtail Nigiri', pricePerPiece: 1.4 },
  { id: 'tuna-sashimi', name: 'Tuna Sashimi', pricePerPiece: 1.6 },
  { id: 'salmon-sashimi', name: 'Salmon Sashimi', pricePerPiece: 1.5 },
  { id: 'spicy-tuna-roll', name: 'Spicy Tuna Roll', pricePerPiece: 0.75 },
  { id: 'california-roll', name: 'California Roll', pricePerPiece: 0.6 },
  { id: 'shrimp-tempura-roll', name: 'Shrimp Tempura Roll', pricePerPiece: 0.85 },
  { id: 'dragon-roll', name: 'Dragon Roll', pricePerPiece: 1.0 },
  { id: 'avocado-roll', name: 'Avocado Roll', pricePerPiece: 0.55 },
  { id: 'cucumber-roll', name: 'Cucumber Roll', pricePerPiece: 0.45 },
  { id: 'edamame', name: 'Edamame (serving)', pricePerPiece: 2.5 },
  { id: 'miso-soup', name: 'Miso Soup', pricePerPiece: 1.5 },
]
