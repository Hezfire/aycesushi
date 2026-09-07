/**
 * ItemList — scrollable list of sushi items with counters.
 */

import ItemRow from './ItemRow'

export default function ItemList({ items, onAdjustCount, onUpdateItem, onRemoveItem }) {
  return (
    <section className="item-list" aria-labelledby="menu-heading">
      <div className="section-head">
        <h2 id="menu-heading">Log what you eat</h2>
        <p>Tap + as you finish pieces. Prices are est. grocery value per piece. Tap Edit to change.</p>
      </div>
      <div className="item-list__rows">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onIncrement={() => onAdjustCount(item.id, 1)}
            onDecrement={() => onAdjustCount(item.id, -1)}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
          />
        ))}
      </div>
    </section>
  )
}
