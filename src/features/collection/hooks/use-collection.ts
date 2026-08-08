import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { collectionService } from '../services';
import { isDevelopmentMode } from '@/lib/dev-user';
import type { UserCardInput, UserCardUpdate, CollectionStats } from '../types/collection';
import { useCollectionStore } from '../store/collection.store';
import { useUserStore } from '@/store';

const EMPTY_STATS: CollectionStats = {
  totalCards: 0,
  uniqueCards: 0,
  favoriteCount: 0,
  estimatedValue: 0,
};

/**
 * Collection React Query keys — scoped under `['collection-engine']` to avoid
 * collisions with the legacy collection cache namespace.
 */
export const collectionQueryKeys = {
  all: ['collection-engine'] as const,
  list: (query: Record<string, unknown>) => ['collection-engine', 'list', query] as const,
  item: (cardId: string) => ['collection-engine', 'item', cardId] as const,
  stats: ['collection-engine', 'stats'] as const,
};

/**
 * CollectionHooks — React Query wrappers over the collection service.
 *
 * Every hook reads the Telegram user ID from the user store and the
 * search/filter/sort state from the collection store, so queries are always
 * scoped to the current collector and the active view state. Mutations
 * invalidate the relevant caches so the UI refreshes automatically.
 */

export function useCollectionList() {
  const search = useCollectionStore((s) => s.search);
  const filters = useCollectionStore((s) => s.filters);
  const sort = useCollectionStore((s) => s.sort);
  const telegramUser = useUserStore((s) => s.telegramUser);

  return useQuery({
    queryKey: collectionQueryKeys.list({ search, filters, sort }),
    queryFn: () =>
      isDevelopmentMode()
        ? Promise.resolve([])
        : collectionService.list({
            telegramUserId: telegramUser!.id,
            search,
            filters,
            sort,
          }),
    enabled: Boolean(telegramUser?.id),
  });
}

export function useCollectionStats() {
  const setStats = useCollectionStore((s) => s.setStats);
  const telegramUser = useUserStore((s) => s.telegramUser);

  return useQuery({
    queryKey: collectionQueryKeys.stats,
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

export function useCollectionItem(cardId: string | undefined) {
  const telegramUser = useUserStore((s) => s.telegramUser);

  return useQuery({
    queryKey: collectionQueryKeys.item(cardId ?? ''),
    queryFn: () => collectionService.findByCardId(telegramUser!.id, cardId as string),
    enabled: Boolean(telegramUser?.id && cardId),
  });
}

export function useCreateCollectionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCardInput) => collectionService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
    },
  });
}

export function useUpdateCollectionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: UserCardUpdate }) =>
      collectionService.update(id, update),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
    },
  });
}

export function useDeleteCollectionItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all });
    },
  });
}
