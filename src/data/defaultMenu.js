/**
 * DEFAULT MENU — edit this file to match a restaurant's à la carte prices.
 *
 * HOW TO UPDATE FOR A DIFFERENT RESTAURANT:
 * 1. Change each item's `name` and `pricePerPiece` (USD).
 * 2. Add or delete whole objects in the array.
 * 3. Keep `id` unique (letters/numbers/dashes only, no spaces).
 * 4. Save the file, then refresh the app. Use "New meal" in the app
 *    if an old session is still loaded from a previous visit.
 *
 * Example paste-friendly format (copy a line and tweak):
 *   { id: 'salmon-nigiri', name: 'Salmon Nigiri', pricePerPiece: 3.5 },
 *
 * Prices below are typical U.S. à la carte estimates (per piece), not
 * restaurant-specific. Adjust them to your local menu.
 */

export const DEFAULT_MENU_ITEMS = [
  { id: 'salmon-nigiri', name: 'Salmon Nigiri', pricePerPiece: 3.5 },
  { id: 'tuna-nigiri', name: 'Tuna Nigiri', pricePerPiece: 3.75 },
  { id: 'eel-nigiri', name: 'Eel Nigiri', pricePerPiece: 4.0 },
  { id: 'shrimp-nigiri', name: 'Shrimp Nigiri', pricePerPiece: 3.0 },
  { id: 'yellowtail-nigiri', name: 'Yellowtail Nigiri', pricePerPiece: 4.0 },
  { id: 'tuna-sashimi', name: 'Tuna Sashimi', pricePerPiece: 4.5 },
  { id: 'salmon-sashimi', name: 'Salmon Sashimi', pricePerPiece: 4.25 },
  { id: 'spicy-tuna-roll', name: 'Spicy Tuna Roll', pricePerPiece: 1.75 },
  { id: 'california-roll', name: 'California Roll', pricePerPiece: 1.5 },
  { id: 'shrimp-tempura-roll', name: 'Shrimp Tempura Roll', pricePerPiece: 2.0 },
  { id: 'dragon-roll', name: 'Dragon Roll', pricePerPiece: 2.5 },
  { id: 'avocado-roll', name: 'Avocado Roll', pricePerPiece: 1.25 },
  { id: 'cucumber-roll', name: 'Cucumber Roll', pricePerPiece: 1.0 },
  { id: 'edamame', name: 'Edamame (serving)', pricePerPiece: 5.0 },
  { id: 'miso-soup', name: 'Miso Soup', pricePerPiece: 3.5 },
]
