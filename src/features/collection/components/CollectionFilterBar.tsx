import { Heart, SlidersHorizontal, X } from 'lucide-react';

import { Badge } from '@/components/ui';
import { cx } from '@/utils';
import { useI18n } from '@/i18n';

import { useCollectionStore } from '../store/collection.store';
import { CONDITIONS, LANGUAGES } from '../types';
import type { Condition, Language } from '../types';

/**
 * CollectionFilterBar — filter chips for the collection page.
 *
 * Shows condition, language, and favorites-only filter toggles in a
 * horizontally scrollable row. Active filters are highlighted; tapping an
 * active filter clears it. The "Filters" label collapses/expands the row
 * on small screens.
 */
export function CollectionFilterBar() {
  const filters = useCollectionStore((s) => s.filters);
  const toggleFilter = useCollectionStore((s) => s.toggleFilter);
  const clearFilters = useCollectionStore((s) => s.clearFilters);
  const { t } = useI18n();

  const activeCount =
    (filters.condition ? 1 : 0) +
    (filters.language ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.setId ? 1 : 0) +
    (filters.rarity ? 1 : 0);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
        <SlidersHorizontal size={14} />
        <span>{t.collection.filters}</span>
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-ink-faint hover:text-ink"
            aria-label={t.collection.clearFilters}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Favorites toggle */}
      <FilterChip
        active={filters.favoritesOnly}
        onClick={() => toggleFilter('favoritesOnly', !filters.favoritesOnly)}
        icon={<Heart size={11} className={filters.favoritesOnly ? 'fill-current' : ''} />}
      >
        {t.collection.favorites}
      </FilterChip>

      {/* Condition */}
      {CONDITIONS.map((cond) => (
        <FilterChip
          key={cond}
          active={filters.condition === cond}
          onClick={() => toggleFilter('condition', cond as Condition)}
        >
          {cond}
        </FilterChip>
      ))}

      {/* Language */}
      {LANGUAGES.map((lang) => (
        <FilterChip
          key={lang}
          active={filters.language === lang}
          onClick={() => toggleFilter('language', lang as Language)}
        >
          {lang}
        </FilterChip>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant={active ? 'primary' : 'default'}
      className={cx('shrink-0 cursor-pointer py-1 select-none', active ? 'gap-1' : '')}
      onClick={onClick}
    >
      {icon}
      {children}
    </Badge>
  );
}
