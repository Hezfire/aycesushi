/**
 * Shared restaurant row mapping for API responses.
 */

export function mapRestaurant(row, extras = {}) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    state: row.state,
    googlePlaceId: row.google_place_id,
    aycePriceDefault: row.ayce_price_default != null ? Number(row.ayce_price_default) : null,
    createdAt: row.created_at,
    ...extras,
  }
}

export function mapMenuItem(row) {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    category: row.category || 'Other',
    estimatedValue: Number(row.estimated_value),
    pricePerPiece: Number(row.estimated_value),
    pricingUnit: row.pricing_unit || 'piece',
    source: row.source || 'estimate',
    createdAt: row.created_at,
  }
}
