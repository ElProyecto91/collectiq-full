import { create } from 'zustand';

import type { Profile, TelegramUser } from '@/types';

interface UserState {
  telegramUser: TelegramUser | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  sessionLoaded: boolean;

  setTelegramUser: (user: TelegramUser | null) => void;
  setProfile: (profile: Profile | null) => void;
  setAuthenticated: (value: boolean) => void;
  setAuthenticating: (value: boolean) => void;
  setSessionLoaded: (value: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  telegramUser: null,
  profile: null,
  isAuthenticated: false,
  isAuthenticating: false,
  sessionLoaded: false,

  setTelegramUser: (telegramUser) => set({ telegramUser, sessionLoaded: true }),
  setProfile: (profile) => set({ profile }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
  setSessionLoaded: (sessionLoaded) => set({ sessionLoaded }),
  reset: () =>
    set({
      telegramUser: null,
      profile: null,
      isAuthenticated: false,
      isAuthenticating: false,
      sessionLoaded: false,
    }),
}));