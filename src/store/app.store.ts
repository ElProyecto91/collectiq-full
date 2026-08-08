import { create } from 'zustand';

import type { Tcg } from '@/types';

/**
 * App store — global UI/runtime concerns.
 *
 * Anything that crosses feature boundaries lives here: the active TCG filter,
 * whether the app is running inside Telegram, and the global network status.
 * Per-feature state belongs in its own store, not here.
 */
type NetworkStatus = 'online' | 'offline' | 'unknown';

interface AppState {
  /** Which TCG vertical the collector is currently focused on. */
  activeTcg: Tcg;
  /** Whether the Telegram WebApp SDK loaded and is available. */
  isTelegram: boolean;
  /** Coarse network status for banner/empty-state decisions. */
  networkStatus: NetworkStatus;

  setActiveTcg: (tcg: Tcg) => void;
  setIsTelegram: (value: boolean) => void;
  setNetworkStatus: (status: NetworkStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTcg: 'pokemon',
  isTelegram: false,
  networkStatus: 'unknown',

  setActiveTcg: (activeTcg) => set({ activeTcg }),
  setIsTelegram: (isTelegram) => set({ isTelegram }),
  setNetworkStatus: (networkStatus) => set({ networkStatus }),
}));
