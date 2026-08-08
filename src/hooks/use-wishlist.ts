import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { wishlistService } from '@/services';
import type { WishlistQueryOptions } from '@/services';
import { queryKeys } from '@/lib/query-client';
import { isDevelopmentMode } from '@/lib/dev-user';
import type { WishlistItem, WishlistItemInput, WishlistItemUpdate } from '@/types';

/** Wishlist hooks — mirrors the collection hooks' structure. */
export function useWishlistList(search = '', tcg?: string) {
  const options: WishlistQueryOptions = {
    search: search.trim() || undefined,
    tcg: tcg as WishlistQueryOptions['tcg'],
  };

  return useQuery<WishlistItem[]>({
    queryKey: queryKeys.wishlistList({ tcg: options.tcg, search: options.search }),
    queryFn: () =>
      isDevelopmentMode() ? Promise.resolve([]) : wishlistService.list(options),
  });
}

export function useCreateWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WishlistItemInput) => wishlistService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });
}

export function useUpdateWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: WishlistItemUpdate }) =>
      wishlistService.update(id, update),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wishlistService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.wishlist });
    },
  });
}
