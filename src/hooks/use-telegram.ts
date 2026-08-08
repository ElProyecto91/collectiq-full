import { useEffect } from 'react';

import { initTelegramWebApp, isInsideTelegram } from '@/lib/telegram';
import { isDevelopmentMode, getDevUser } from '@/lib/dev-user';
import { useAppStore } from '@/store';
import { useUserStore } from '@/store';
import type { TelegramUser } from '@/types';

/**
 * Telegram integration hook.
 *
 * Detects the Telegram WebApp on mount, initializes it for display, and loads
 * the Telegram user into the user store. Outside Telegram in development, a
 * synthetic dev user is loaded instead so the app behaves identically to a
 * real Telegram session. In production builds, the dev-user branch is
 * tree-shaken out by Vite's `import.meta.env.DEV` flag.
 *
 * Returns a snapshot so components can branch on `isTelegram` without
 * re-reading the SDK.
 */
export function useTelegram() {
  const isTelegram = useAppStore((s) => s.isTelegram);
  const setIsTelegram = useAppStore((s) => s.setIsTelegram);
  const setTelegramUser = useUserStore((s) => s.setTelegramUser);
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    const inside = isInsideTelegram();
    setIsTelegram(inside);

    if (inside) {
      const webApp = initTelegramWebApp();
      const tgUser = webApp?.initDataUnsafe?.user ?? null;
      if (tgUser) {
        const normalized: TelegramUser = {
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
          language_code: tgUser.language_code,
          is_premium: tgUser.is_premium,
        };
        setTelegramUser(normalized);
        return;
      }
    }

    // No real Telegram user found — load the dev user in development so the
    // app works. This also covers the case where the Telegram SDK stub is
    // present (from index.html) but no actual Telegram session exists, which
    // is exactly what happens in Bolt Preview.
    if (isDevelopmentMode()) {
      const devUser = getDevUser();
      if (devUser) setTelegramUser(devUser);
    }
  }, [setIsTelegram, setTelegramUser]);

  return { isTelegram, telegramUser };
}
