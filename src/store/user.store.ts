import { create } from 'zustand';

import type { Profile, TelegramUser } from '@/types';

/**
 * User store — identity and session state.
 *
 * Holds the Telegram user (read-only, from the SDK) and the collector's
 * Supabase profile (read/write via the profile service). Auth session state
 * lives in Supabase itself; this store only mirrors what the UI needs to
 * render greeting/avatar surfaces without re-fetching on every screen.
 */
interface UserState {
  telegramUser: TelegramUser | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;

  setTelegramUser: (user: TelegramUser | null) => void;
  setProfile: (profile: Profile | null) => void;
  setAuthenticated: (value: boolean) => void;
  setAuthenticating: (value: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  telegramUser: null,
  profile: null,
  isAuthenticated: false,
  isAuthenticating: false,

  setTelegramUser: (telegramUser) => set({ telegramUser }),
  setProfile: (profile) => set({ profile }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
  reset: () =>
    set({
      telegramUser: null,
      profile: null,
      isAuthenticated: false,
      isAuthenticating: false,
    }),
}));
