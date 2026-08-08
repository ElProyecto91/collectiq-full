import { useState } from 'react';
import { Heart, Layers, Minus, Pencil, Plus, Star, Trash2 } from 'lucide-react';

import { Card } from '@/components/ui';
import { cx } from '@/utils';
import { useI18n } from '@/i18n';

import { useUpdateCollectionItem, useDeleteCollectionItem } from '../hooks';
import type { UserCard } from '../types';

/**
 * CollectionCardTile — a single card tile in the collection grid.
 *
 * Shows the card image, name, set, rarity, quantity, and favorite/showcase
 * badges. Inline controls: increase/decrease quantity, edit (opens modal),
 * delete (two-tap confirm), and favorite toggle.
 */

interface CollectionCardTileProps {
  card: UserCard;
  onEdit: (card: UserCard) => void;
}

export function CollectionCardTile({ card, onEdit }: CollectionCardTileProps) {
  const updateMutation = useUpdateCollectionItem();
  const deleteMutation = useDeleteCollectionItem();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { t } = useI18n();

  const updateQuantity = (delta: number) => {
    const newQty = card.quantity + delta;
    if (newQty < 1) return;
    updateMutation.mutate({ id: card.id, update: { quantity: newQty } });
  };

  const toggleFavorite = () => {
    updateMutation.mutate({ id: card.id, update: { favorite: !card.favorite } });
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteMutation.mutate(card.id);
  };

  const snap = card.snapshot;

  return (
    <Card padding="sm" className="flex flex-col gap-2 animate-scale-in">
      {/* Image + badges */}
      <div className="relative">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-surface-3">
          {snap.imageUrl ? (
            <img
              src={snap.imageUrl}
              alt={snap.name}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <Layers size={28} strokeWidth={1.5} className="text-ink-faint" />
          )}
        </div>

        {/* Showcase badge */}
        {card.showcase && (
          <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent/90 shadow-sm">
            <Star size={12} className="fill-base text-base" />
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={toggleFavorite}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-2/80 backdrop-blur-sm transition-transform active:scale-90"
          aria-label={card.favorite ? t.collectionTile.removeFavorite : t.collectionTile.markFavorite}
        >
          <Heart
            size={16}
            className={card.favorite ? 'fill-accent text-accent' : 'text-ink-soft'}
          />
        </button>
      </div>

      {/* Info */}
      <div className="px-1 pb-1">
        <p className="truncate text-sm font-semibold text-ink">{snap.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{snap.setName}</p>
        {snap.rarity && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-accent">{snap.rarity}</p>
        )}
      </div>

      {/* Condition badge */}
      {card.condition && (
        <div className="px-1">
          <span className="inline-flex items-center rounded-md border border-line-soft bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
            {card.condition}
          </span>
        </div>
      )}

      {/* Quantity + actions */}
      <div className="flex items-center justify-between gap-1 px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateQuantity(-1)}
            disabled={updateMutation.isPending || card.quantity <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label={t.collectionTile.decreaseQty}
          >
            <Minus size={14} />
          </button>
          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-ink">
            {card.quantity}
          </span>
          <button
            onClick={() => updateQuantity(1)}
            disabled={updateMutation.isPending}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label={t.collectionTile.increaseQty}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(card)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-surface-3 text-ink-faint transition-colors hover:text-primary-soft"
            aria-label={t.collectionTile.editCard}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={cx(
              'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
              confirmDelete
                ? 'border-error bg-error/10 text-error'
                : 'border-line-soft bg-surface-3 text-ink-faint hover:text-error'
            )}
            aria-label={confirmDelete ? t.collectionTile.tapConfirm : t.collectionTile.removeCard}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Card>
  );
}
