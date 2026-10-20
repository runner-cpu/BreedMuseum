import { Grid2X2 } from 'lucide-react';
import { categories } from '@/data/catalog';
import { categoryLabel } from '@/lib/displayLabels';
import { useSettings } from '@/contexts/AppSettings';
import { getCategorySvgIcon } from '@/lib/categorySvgIcons';

interface CategorySidebarProps {
  selected: string | null;
  onSelect: (category: string | null) => void;
  /**
   * 可选的类别清单，默认是完整目录。
   * 地图/百科只传有可浏览记录的类别，避免「蜂」这类空类别成为死入口。
   */
  options?: readonly string[];
}

/**
 * Shared category rail used by the map and encyclopedia views.
 *
 * 这是一组「筛选开关」而不是标签页：没有 tabpanel，点击也不改变焦点顺序。
 * 旧实现用 role="tab"/aria-selected，却没有方向键与 roving tabindex，
 * 屏幕阅读器会宣布一套并不存在的标签页交互。改用 group + aria-pressed，
 * 语义与行为一致，键盘仍按 Tab 逐项移动。
 */
export function CategorySidebar({ selected, onSelect, options = categories }: CategorySidebarProps) {
  const { t, language } = useSettings();

  return (
    <aside className="museum-category-sidebar" role="group" aria-label={t('enc.categoryFilter')}>
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={`museum-category-sidebar-item ${selected === null ? 'is-active' : ''}`}
      >
        <span className="museum-category-sidebar-icon" aria-hidden="true"><Grid2X2 className="h-6 w-6" strokeWidth={1.6} /></span>
        <span>{t('enc.allCategories')}</span>
      </button>
      {options.map((category) => {
        const Icon = getCategorySvgIcon(category);
        const active = selected === category;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(category)}
            className={`museum-category-sidebar-item ${active ? 'is-active' : ''}`}
          >
            <span className="museum-category-sidebar-icon" aria-hidden="true"><Icon className="h-6 w-6" /></span>
            <span>{categoryLabel(category, language)}</span>
          </button>
        );
      })}
    </aside>
  );
}
