import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/utils/error';

/**
 * Shared React Query client.
 *
 * Defaults are tuned for a mobile Mini App: stale time is short enough to feel
 * fresh but long enough to avoid refetching on every tab switch, and retries
 * are limited so a failing backend doesn't keep the UI spinning.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx) — they won't succeed.
        if (error instanceof ApiError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/** Stable query-key factories. Centralizing keys prevents cache collisions. */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  collection: ['collection'] as const,
  collectionList: (filters: { tcg?: string; search?: string; orderBy?: string } = {}) =>
    ['collection', 'list', filters] as const,
  collectionStats: ['collection', 'stats'] as const,
  wishlist: ['wishlist'] as const,
  wishlistList: (filters: { tcg?: string; search?: string } = {}) =>
    ['wishlist', 'list', filters] as const,
} as const;
