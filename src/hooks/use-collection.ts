import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { collectionService } from '@/services';
import type { CollectionQueryOptions } from '@/services';
import { queryKeys } from '@/lib/query-client';
import { isDevelopmentMode } from '@/lib/dev-user';
import { useCollectionStore } from '@/store';
import { useUserStore } from '@/store';
import type { CollectionItem, CollectionItemInput, CollectionItemUpdate, CollectionStats } from '@/types';

const EMPTY_STATS: CollectionStats = {
  totalItems: 0,
  uniqueCards: 0,
  favoriteCount: 0,
  byTcg: {},
};

/** Map the UI sort key to the database column + direction. */
const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  recent: { column: 'created_at', ascending: false },
  name: { column: 'card_name', ascending: true },
  set: { column: 'set_name', ascending: true },
  rarity: { column: 'rarity', ascending: false },
};

/**
 * Collection data hooks — React Query wrappers over the collection service.
 *
 * Every hook reads the Telegram user ID from the user store and passes it to
 * the service, so queries are always scoped to the current collector. The list
 * hook also reads search/sort from the collection store so the cache key tracks
 * the active filters. Mutations invalidate the relevant caches so the UI
 * refreshes automatically after edits.
 */
export function useCollectionList() {
  const search = useCollectionStore((s) => s.search);
  const sort = useCollectionStore((s) => s.sort);
  const telegramUser = useUserStore((s) => s.telegramUser);

  const sortConfig = SORT_MAP[sort] ?? SORT_MAP.recent;
  const options: CollectionQueryOptions = {
    telegramUserId: telegramUser?.id ?? 0,
    search: search.trim() || undefined,
    orderBy: sortConfig.column,
    ascending: sortConfig.ascending,
  };

  return useQuery<CollectionItem[]>({
    queryKey: queryKeys.collectionList({ search: options.search, orderBy: options.orderBy }),
    queryFn: () =>
      isDevelopmentMode() ? Promise.resolve([]) : collectionService.list(options),
    enabled: Boolean(telegramUser?.id),
  });
}

export function useCollectionStats() {
  const setStats = useCollectionStore((s) => s.setStats);
  const telegramUser = useUserStore((s) => s.telegramUser);

  return useQuery({
    queryKey: queryKeys.collectionStats,
    queryFn: async () => {
      if (isDevelopmentMode()) {
        setStats(EMPTY_STATS);
        return EMPTY_STATS;
      }
      const stats = await collectionService.stats(telegramUser!.id);
      setStats(stats);
      return stats;
    },
    enabled: Boolean(telegramUser?.id),
  });
}

/** Check whether a card is already in the collection. */
export function useCollectionItem(cardId: string | undefined) {
  const telegramUser = useUserStore((s) => s.telegramUser);

  return useQuery<CollectionItem | null>({
    queryKey: ['collection', 'item', cardId],
    queryFn: () => collectionService.findByCardId(telegramUser!.id, cardId as string),
    enabled: Boolean(telegramUser?.id && cardId),
  });
}

export function useCreateCollectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CollectionItemInput) => collectionService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection });
    },
  });
}

export function useUpdateCollectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: CollectionItemUpdate }) =>
      collectionService.update(id, update),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection });
    },
  });
}

export function useDeleteCollectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collection });
    },
  });
}
