import { Grid2X2 } from 'lucide-react';
import { categories } from '@/data/catalog';
import { getCategorySvgIcon } from '@/lib/categorySvgIcons';

interface CategorySidebarProps {
  selected: string | null;
  onSelect: (category: string | null) => void;
}

/** Shared category rail used by the map and encyclopedia views. */
export function CategorySidebar({ selected, onSelect }: CategorySidebarProps) {
  return (
    <aside className="museum-category-sidebar" role="tablist" aria-label="按畜种筛选">
      <button
        type="button"
        role="tab"
        aria-selected={selected === null}
        aria-current={selected === null ? 'page' : undefined}
        onClick={() => onSelect(null)}
        className={`museum-category-sidebar-item ${selected === null ? 'is-active' : ''}`}
      >
        <span className="museum-category-sidebar-icon" aria-hidden="true"><Grid2X2 className="h-6 w-6" strokeWidth={1.6} /></span>
        <span>全部</span>
      </button>
      {categories.map((category) => {
        const Icon = getCategorySvgIcon(category);
        const active = selected === category;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(category)}
            className={`museum-category-sidebar-item ${active ? 'is-active' : ''}`}
          >
            <span className="museum-category-sidebar-icon" aria-hidden="true"><Icon className="h-6 w-6" /></span>
            <span>{category}</span>
          </button>
        );
      })}
    </aside>
  );
}
