import { useState } from 'react';
import { DollarSign, Heart, Layers, TrendingUp } from 'lucide-react';

import {
  Badge,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  SearchInput,
  StatTile,
} from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useUserStore } from '@/store';
import { useI18n } from '@/i18n';
import { formatCurrency } from '@/utils/format';

import { useCollectionList, useCollectionStats } from '../hooks';
import { useCollectionStore } from '../store/collection.store';
import type { UserCard, CollectionSortKey } from '../types';
import { CollectionCardTile, CollectionFilterBar, AddToCollectionModal } from '../components';

/**
 * CollectionPage — the collector's owned cards.
 *
 * Shows stats (total cards, unique cards, favorites, estimated value), a
 * search bar, filter chips, a sort selector, and a responsive grid of card
 * tiles. Each tile has controls for quantity, edit, delete, and favorite.
 * Edit opens the AddToCollectionModal in edit mode.
 */
export function CollectionPage() {
  const search = useCollectionStore((s) => s.search);
  const setSearch = useCollectionStore((s) => s.setSearch);
  const sort = useCollectionStore((s) => s.sort);
  const setSort = useCollectionStore((s) => s.setSort);
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { t, tr } = useI18n();

  const { data: items, isLoading, error, refetch } = useCollectionList();
  const { data: stats } = useCollectionStats();

  const [editingCard, setEditingCard] = useState<UserCard | null>(null);

  const hasTelegram = Boolean(telegramUser?.id);

  return (
    <div className="space-y-4 pt-3 animate-fade-in">
      <PageHeader title={t.collection.title} subtitle={t.collection.subtitle} />

      {!hasTelegram ? (
        <EmptyState
          icon={<Layers size={28} strokeWidth={1.8} />}
          title={t.collection.connectTelegram}
          description={t.collection.connectTelegramDesc}
        />
      ) : (
        <>
          {/* Stats */}
          {stats && (stats.uniqueCards > 0 || isLoading) && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                label={t.stats.total}
                value={stats.totalCards}
                accent="primary"
                icon={<Layers size={14} />}
              />
              <StatTile
                label={t.stats.unique}
                value={stats.uniqueCards}
                icon={<TrendingUp size={14} />}
              />
              <StatTile
                label={t.stats.favorites}
                value={stats.favoriteCount}
                accent="gold"
                icon={<Heart size={14} />}
              />
              <StatTile
                label={t.stats.estValue}
                value={stats.estimatedValue > 0 ? formatCurrency(stats.estimatedValue) : '—'}
                icon={<DollarSign size={14} />}
              />
            </div>
          )}

          <SearchInput value={search} onChange={setSearch} placeholder={t.collection.searchPlaceholder} />

          <CollectionFilterBar />

          <SortSelector value={sort} onChange={setSort} />

          {isLoading ? (
            <CardGridSkeleton count={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : !items || items.length === 0 ? (
            <EmptyState
              icon={<Layers size={28} strokeWidth={1.8} />}
              title={search ? t.collection.noMatches : t.collection.noCardsYet}
              description={
                search
                  ? tr('collection.noMatchesDesc', { search })
                  : t.collection.noCardsYetDesc
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <CollectionCardTile
                  key={item.id}
                  card={item}
                  onEdit={(c) => setEditingCard(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit modal is rendered at page level so the grid tiles stay lightweight */}
      {editingCard && (
        <EditCardLauncher card={editingCard} onClose={() => setEditingCard(null)} />
      )}
    </div>
  );
}

function SortSelector({
  value,
  onChange,
}: {
  value: CollectionSortKey;
  onChange: (value: CollectionSortKey) => void;
}) {
  const { t } = useI18n();
  const SORT_OPTIONS: { value: CollectionSortKey; label: string }[] = [
    { value: 'recent', label: t.collection.sortRecent },
    { value: 'name', label: t.collection.sortAlphabetical },
    { value: 'value', label: t.collection.sortValue },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-xs text-ink-muted">{t.collection.sort}</span>
      {SORT_OPTIONS.map((opt) => (
        <Badge
          key={opt.value}
          variant={value === opt.value ? 'primary' : 'default'}
          className="shrink-0 cursor-pointer py-1 select-none"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * EditCardLauncher — bridges a UserCard back to the AddToCollectionModal,
 * which expects a CatalogCard. We reconstruct a minimal CatalogCard from
 * the stored snapshot so the modal can render the card image and name.
 */
function EditCardLauncher({ card, onClose }: { card: UserCard; onClose: () => void }) {
  const catalogCard = {
    id: card.pokemonCardId,
    name: card.snapshot.name,
    supertype: card.snapshot.supertype,
    subtypes: card.snapshot.subtypes ?? [],
    hp: null,
    types: [],
    set: {
      id: card.snapshot.setCode,
      name: card.snapshot.setName,
      series: null,
      printedTotal: null,
      total: null,
      releaseDate: null,
      logoUrl: null,
      symbolUrl: null,
    },
    number: card.snapshot.number,
    rarity: card.snapshot.rarity,
    regulationMark: null,
    artist: null,
    images: {
      small: card.snapshot.imageUrl,
      large: card.snapshot.imageUrl,
    },
    legalities: null,
    flavorText: null,
    evolvesFrom: null,
    retreatCost: null,
    tcg: 'pokemon' as const,
  };

  return (
    <AddToCollectionModal
      card={catalogCard}
      open={true}
      onClose={onClose}
      existing={card}
    />
  );
}
