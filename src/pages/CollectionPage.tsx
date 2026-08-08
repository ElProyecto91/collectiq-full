import {
  Heart,
  Layers,
  Minus,
  Plus,
  Trash2,
  TrendingUp,
  Star,
} from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, Card, CardGridSkeleton, EmptyState, ErrorState, SearchInput, StatTile } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useUserStore } from '@/store';
import { useCollectionStore } from '@/store';
import {
  useCollectionList,
  useCollectionStats,
  useDeleteCollectionItem,
  useUpdateCollectionItem,
} from '@/hooks';
import type { CollectionItem } from '@/types';

/**
 * Collection — the collector's owned cards.
 *
 * Shows stats (total cards, unique cards, favorites), a search bar, a sort
 * selector, and a responsive grid of real card tiles. Each tile shows the card
 * image, name, set, quantity, and favorite toggle, with controls to increase
 * quantity, decrease quantity, remove the card, or mark it as a favorite.
 */
export function CollectionPage() {
  const search = useCollectionStore((s) => s.search);
  const setSearch = useCollectionStore((s) => s.setSearch);
  const sort = useCollectionStore((s) => s.sort);
  const setSort = useCollectionStore((s) => s.setSort);
  const telegramUser = useUserStore((s) => s.telegramUser);

  const { data: items, isLoading, error, refetch } = useCollectionList();
  const { data: stats } = useCollectionStats();

  const hasTelegram = Boolean(telegramUser?.id);

  return (
    <div className="space-y-4 pt-3 animate-fade-in">
      <PageHeader title="Collection" subtitle="Every card you own, in one place." />

      {!hasTelegram ? (
        <EmptyState
          icon={<Layers size={28} strokeWidth={1.8} />}
          title="Connect your Telegram account"
          description="Your collection is tied to your Telegram identity. Open this app inside Telegram to view and manage your cards."
        />
      ) : (
        <>
          {/* Stats */}
          {stats && (stats.uniqueCards > 0 || isLoading) && (
            <div className="grid grid-cols-3 gap-2">
              <StatTile
                label="Total"
                value={stats.totalItems}
                accent="primary"
                icon={<Layers size={14} />}
              />
              <StatTile
                label="Unique"
                value={stats.uniqueCards}
                icon={<TrendingUp size={14} />}
              />
              <StatTile
                label="Favorites"
                value={stats.favoriteCount}
                accent="gold"
                icon={<Heart size={14} />}
              />
            </div>
          )}

          <SearchInput value={search} onChange={setSearch} placeholder="Search your collection" />

          {/* Sort selector */}
          <SortSelector value={sort} onChange={setSort} />

          {isLoading ? (
            <CardGridSkeleton count={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : !items || items.length === 0 ? (
            <EmptyState
              icon={<Layers size={28} strokeWidth={1.8} />}
              title={search ? 'No matches' : 'No cards yet'}
              description={
                search
                  ? `No cards match "${search}". Try a different search term.`
                  : 'Add cards from the Explorer to start building your collection.'
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <CollectionGridItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'set', label: 'Set' },
  { value: 'rarity', label: 'Rarity' },
] as const;

function SortSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: 'recent' | 'name' | 'set' | 'rarity') => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-xs text-ink-muted">Sort</span>
      {SORT_OPTIONS.map((opt) => (
        <Badge
          key={opt.value}
          variant={value === opt.value ? 'primary' : 'default'}
          className="shrink-0 cursor-pointer py-1"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Badge>
      ))}
    </div>
  );
}

function CollectionGridItem({ item }: { item: CollectionItem }) {
  const updateMutation = useUpdateCollectionItem();
  const deleteMutation = useDeleteCollectionItem();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateQuantity = (delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    updateMutation.mutate({ id: item.id, update: { quantity: newQty } });
  };

  const toggleFavorite = () => {
    updateMutation.mutate({ id: item.id, update: { favorite: !item.favorite } });
  };

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteMutation.mutate(item.id);
  };

  return (
    <Card padding="sm" className="flex flex-col gap-2 animate-scale-in">
      {/* Image + favorite */}
      <div className="relative">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-surface-3">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.cardName}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <Layers size={28} strokeWidth={1.5} className="text-ink-faint" />
          )}
        </div>
        <button
          onClick={toggleFavorite}
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface-2/80 backdrop-blur-sm transition-transform active:scale-90"
          aria-label={item.favorite ? 'Remove favorite' : 'Mark as favorite'}
        >
          <Heart
            size={16}
            className={item.favorite ? 'fill-accent text-accent' : 'text-ink-soft'}
          />
        </button>
        {item.favorite && (
          <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent/90">
            <Star size={12} className="fill-base text-base" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-1 pb-1">
        <p className="truncate text-sm font-semibold text-ink">{item.cardName}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{item.setName}</p>
        {item.rarity && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-accent">{item.rarity}</p>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex items-center justify-between gap-1 px-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateQuantity(-1)}
            disabled={updateMutation.isPending || item.quantity <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-ink">
            {item.quantity}
          </span>
          <button
            onClick={() => updateQuantity(1)}
            disabled={updateMutation.isPending}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-surface-3 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus size={14} />
          </button>
        </div>
        <button
          onClick={handleRemove}
          disabled={deleteMutation.isPending}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
            confirmDelete
              ? 'border-error bg-error/10 text-error'
              : 'border-line-soft bg-surface-3 text-ink-faint hover:text-error'
          }`}
          aria-label={confirmDelete ? 'Tap again to confirm' : 'Remove card'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}
