import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from '@tanstack/react-query';

import { cardRepository } from '../services';
import type { CatalogCard, CatalogCardPage } from '../types/catalog';

/**
 * Catalog React Query keys.
 *
 * Scoped under `['catalog', 'pokemon']` so future TCG providers (One Piece,
 * Magic) get their own namespace without colliding with Pokémon cache entries.
 */
export const catalogQueryKeys = {
  search: (query: string) => ['catalog', 'pokemon', 'search', query] as const,
  detail: (id: string) => ['catalog', 'pokemon', 'detail', id] as const,
} as const;

/** Minimum query length before a search fires — avoids noisy short prefixes. */
const MIN_QUERY_LENGTH = 2;

/**
 * Infinite-search hook for the Explorer.
 *
 * Uses `useInfiniteQuery` so pages are appended as the user scrolls. The query
 * is debounced at the input layer (SearchInput) and only fires once the term is
 * long enough; shorter terms disable the query so the network isn't hit on
 * every keystroke. An empty query returns the newest cards (browsing mode).
 *
 * Generics: <TQueryFnData, TError, TData, TQueryKey, TPageParam>. The queryFn
 * returns a CatalogCardPage (one page); React Query wraps pages into
 * InfiniteData<CatalogCardPage> for the hook's `data` field.
 */
export function useCatalogSearch(query: string) {
  const trimmed = query.trim();
  const enabled = trimmed.length === 0 || trimmed.length >= MIN_QUERY_LENGTH;

  return useInfiniteQuery<
    CatalogCardPage,
    Error,
    InfiniteData<CatalogCardPage>,
    ReturnType<typeof catalogQueryKeys.search>,
    number
  >({
    queryKey: catalogQueryKeys.search(trimmed),
    queryFn: ({ pageParam }) => cardRepository.search(trimmed, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Single-card detail hook for the Card Details page. */
export function useCatalogCard(id: string | undefined) {
  return useQuery<CatalogCard, Error>({
    queryKey: catalogQueryKeys.detail(id ?? ''),
    queryFn: () => cardRepository.getById(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}
