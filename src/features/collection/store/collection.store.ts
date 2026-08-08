import { create } from 'zustand';

import type { CollectionFilters, CollectionSortKey, CollectionStats } from '../types/collection';

/**
 * Collection store — local UI state for the collection feature.
 *
 * Server data (the list, the stats) is owned by React Query and fetched via
 * the collection hooks. This store holds only the ephemeral view state the
 * query cache shouldn't manage: the active search term, filter selections,
 * sort selection, and a cached stats snapshot for instant home-screen rendering.
 * Keeping view state out of the cache prevents stale filters from surviving a
 * refetch.
 */

const emptyFilters: CollectionFilters = {
  condition: null,
  language: null,
  setId: null,
  rarity: null,
  favoritesOnly: false,
};

const emptyStats: CollectionStats = {
  totalCards: 0,
  uniqueCards: 0,
  favoriteCount: 0,
  estimatedValue: 0,
};

interface CollectionState {
  search: string;
  filters: CollectionFilters;
  sort: CollectionSortKey;
  stats: CollectionStats | null;

  setSearch: (value: string) => void;
  setFilter: <K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K]) => void;
  toggleFilter: <K extends keyof CollectionFilters>(key: K, value: CollectionFilters[K]) => void;
  clearFilters: () => void;
  setSort: (sort: CollectionSortKey) => void;
  setStats: (stats: CollectionStats | null) => void;
  reset: () => void;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  search: '',
  filters: { ...emptyFilters },
  sort: 'recent',
  stats: null,

  setSearch: (search) => set({ search }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  toggleFilter: (key, value) =>
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: state.filters[key] === value ? null : value,
      },
    })),
  clearFilters: () => set({ filters: { ...emptyFilters } }),
  setSort: (sort) => set({ sort }),
  setStats: (stats) => set({ stats }),
  reset: () => set({ search: '', filters: { ...emptyFilters }, sort: 'recent', stats: emptyStats }),
}));
