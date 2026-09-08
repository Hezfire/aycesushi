/**
 * ItemList — categorized sushi counters for one-handed logging.
 */

import ItemRow from './ItemRow'
import { CATEGORY_ORDER } from '../data/defaultMenu'
import { groupItemsByCategory } from '../utils/mealScore'

export default function ItemList({ items, onAdjustCount, onUpdateItem, onRemoveItem }) {
  const groups = groupItemsByCategory(items, CATEGORY_ORDER)

  return (
    <section className="item-list" aria-labelledby="menu-heading">
      <div className="section-head">
        <h2 id="menu-heading">Log what you eat</h2>
        <p>Tap + as you eat. Values are estimates when restaurant pricing isn’t available.</p>
      </div>
      {groups.length === 0 ? (
        <p className="lb-empty">No items yet — add a custom item below.</p>
      ) : (
        groups.map(({ category, items: groupItems }) => (
          <div key={category} className="item-list__group">
            <h3 className="item-list__category">{category}</h3>
            <div className="item-list__rows">
              {groupItems.map((item) => (
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
          </div>
        ))
      )}
    </section>
  )
}
