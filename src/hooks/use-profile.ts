import { useQuery } from '@tanstack/react-query';

import { profileService, userService } from '@/services';
import { queryKeys } from '@/lib/query-client';
import { useUserStore } from '@/store';
import type { Profile } from '@/types';

/**
 * Loads the current collector's profile.
 *
 * Depends on an authenticated Supabase session (owned by the auth flow). When
 * no session exists yet, the query is disabled so it doesn't fire prematurely.
 * The returned profile is mirrored into the user store for synchronous UI use.
 */
export function useProfile() {
  const setProfile = useUserStore((s) => s.setProfile);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);

  return useQuery<Profile | null>({
    queryKey: queryKeys.profile('me'),
    enabled: isAuthenticated,
    queryFn: async () => {
      const user = await userService.getCurrentUser();
      if (!user) return null;
      return profileService.getById(user.id);
    },
    meta: { onError: (error: unknown) => console.error('profile load failed', error) },
  });
}

/** Convenience hook returning just the display name for greeting surfaces. */
export function useDisplayName(): string {
  const { telegramUser, profile } = useUserStore();
  return profile?.username ?? telegramUser?.first_name ?? 'Collector';
}
