import { create } from 'zustand';

import type { CollectionItem, CollectionStats } from '@/types';

/**
 * Collection store — local UI state for the collection feature.
 *
 * Server data (the list, the stats) is owned by React Query and fetched via
 * the collection service. This store holds only the ephemeral view state the
 * query cache shouldn't manage: the active search term, filter/sort
 * selections, and selection mode for bulk actions. Keeping view state out of
 * the cache prevents stale filters from surviving a refetch.
 */
export type SortKey = 'recent' | 'name' | 'set' | 'rarity';

interface CollectionState {
  search: string;
  activeTcg: string | null;
  sort: SortKey;
  selectedIds: Set<string>;
  /** Cached stats snapshot for instant home-screen rendering. */
  stats: CollectionStats | null;

  setSearch: (value: string) => void;
  setActiveTcg: (tcg: string | null) => void;
  setSort: (sort: SortKey) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  setStats: (stats: CollectionStats | null) => void;
  reset: () => void;
}

const emptyStats: CollectionStats = { totalItems: 0, uniqueCards: 0, favoriteCount: 0, byTcg: {} };

export const useCollectionStore = create<CollectionState>((set) => ({
  search: '',
  activeTcg: null,
  sort: 'recent',
  selectedIds: new Set<string>(),
  stats: null,

  setSearch: (search) => set({ search }),
  setActiveTcg: (activeTcg) => set({ activeTcg }),
  setSort: (sort) => set({ sort }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clearSelected: () => set({ selectedIds: new Set<string>() }),
  setStats: (stats) => set({ stats }),
  reset: () =>
    set({
      search: '',
      activeTcg: null,
      sort: 'recent',
      selectedIds: new Set<string>(),
      stats: emptyStats,
    }),
}));

/** Selectors re-exported for ergonomic imports in components. */
export const selectCollectionItems = (items: CollectionItem[]) => items;
