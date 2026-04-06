import type { Category } from '../data/spots';
import { categories } from '../data/spots';

const categoryEmoji: Record<Category, string> = {
  swimming: '🏊',
  hiking: '🥾',
  'beer garden': '🍺',
  cycling: '🚴',
  skiing: '⛷️',
};

interface FiltersProps {
  activeCategories: Set<Category>;
  onChange: (categories: Set<Category>) => void;
}

export default function Filters({ activeCategories, onChange }: FiltersProps) {
  function toggle(cat: Category) {
    const next = new Set(activeCategories);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(categories));
  }

  function clearAll() {
    onChange(new Set());
  }

  return (
    <div className="filters-panel">
      <h2>Categories</h2>
      <div className="filter-actions">
        <button onClick={selectAll}>All</button>
        <button onClick={clearAll}>None</button>
      </div>
      <ul className="filter-list">
        {categories.map((cat) => (
          <li key={cat}>
            <label className={`filter-label ${activeCategories.has(cat) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={activeCategories.has(cat)}
                onChange={() => toggle(cat)}
              />
              <span className="filter-emoji">{categoryEmoji[cat]}</span>
              {cat}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
