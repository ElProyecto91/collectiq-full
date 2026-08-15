import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { wishlistService } from '@/services';
import type { WishlistQueryOptions } from '@/services';
import { queryKeys } from '@/lib/query-client';
import { isDevelopmentMode } from '@/lib/dev-user';
import { useUserStore } from '@/store';
import type { WishlistItem, WishlistItemInput, WishlistItemUpdate } from '@/types';

export function useWishlistList(search = '', tcg?: string) {
  const telegramUser = useUserStore((s) => s.telegramUser);

  const options: WishlistQueryOptions = {
    telegramUserId: telegramUser?.id ?? 0,
    search: search.trim() || undefined,
    tcg: tcg as WishlistQueryOptions['tcg'],
  };

  return useQuery<WishlistItem[]>({
    queryKey: queryKeys.wishlistList({ tcg: options.tcg, search: options.search }),
    queryFn: () =>
      isDevelopmentMode() ? Promise.resolve([]) : wishlistService.list(options),
    enabled: Boolean(telegramUser?.id),
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