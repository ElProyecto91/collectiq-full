import { type MouseEvent } from 'react';

import { Card } from '@/components/ui';
import { cx } from '@/utils';

import { CardImage } from './CardImage';
import type { CatalogCard } from '../types/catalog';

/**
 * CatalogCardItem — a single card tile in the Explorer grid.
 *
 * Shows the card image (with a graceful icon fallback while loading or when
 * missing), name, set name, number, rarity, and regulation mark. Tapping the
 * tile navigates to the card details page via the `onOpen` callback.
 */
export interface CatalogCardItemProps {
  card: CatalogCard;
  onOpen: (card: CatalogCard) => void;
  className?: string;
}

export function CatalogCardItem({ card, onOpen, className }: CatalogCardItemProps) {
  const handleClick = (_e: MouseEvent<HTMLDivElement>) => {
    onOpen(card);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(card);
    }
  };

  return (
    <Card
      interactive
      padding="sm"
      className={cx('flex flex-col gap-2 animate-scale-in', className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${card.name} from ${card.set.name}`}
    >
      <CardImage
        src={card.images.small}
        alt={card.name}
        className="aspect-[3/4] w-full"
      />

      <div className="px-1 pb-1">
        <p className="truncate text-sm font-semibold text-ink">{card.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{card.set.name}</p>
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <span className="text-[11px] text-ink-muted">#{card.number}</span>
          {card.rarity && (
            <span className="truncate text-[11px] font-medium text-accent" title={card.rarity}>
              {card.rarity}
            </span>
          )}
        </div>
        {card.regulationMark && (
          <div className="mt-1.5">
            <span className="inline-flex items-center rounded-md border border-line bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {card.regulationMark}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
