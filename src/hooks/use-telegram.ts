import { useEffect } from 'react';

import { initTelegramWebApp, isInsideTelegram } from '@/lib/telegram';
import { isDevelopmentMode, getDevUser } from '@/lib/dev-user';
import { useAppStore } from '@/store';
import { useUserStore } from '@/store';
import type { TelegramUser } from '@/types';

const SESSION_KEY = 'collectiq-session-token';

function getTokenFromCookie(): string | null {
  const match = document.cookie.match(/collectiq_session=([^;]+)/);
  return match ? match[1] : null;
}

async function createSession(initData: string): Promise<{ user: TelegramUser; token: string } | null> {
  try {
    const res = await fetch('/api/auth-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadSession(token: string): Promise<TelegramUser | null> {
  try {
    const res = await fetch(`/api/auth-telegram?token=${token}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const { user } = await res.json();
    return user ?? null;
  } catch {
    return null;
  }
}

export function useTelegram() {
  const isTelegram = useAppStore((s) => s.isTelegram);
  const setIsTelegram = useAppStore((s) => s.setIsTelegram);
  const setTelegramUser = useUserStore((s) => s.setTelegramUser);
  const setSessionLoaded = useUserStore((s) => s.setSessionLoaded);
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    const inside = isInsideTelegram();
    setIsTelegram(inside);

    if (inside) {
      const webApp = initTelegramWebApp();
      const initData = webApp?.initData ?? '';
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
        setSessionLoaded(true);

        if (initData) {
          createSession(initData).then(result => {
            if (result?.token) {
              localStorage.setItem(SESSION_KEY, result.token);
            }
            if (result?.user) {
              setTelegramUser({ ...normalized, ...result.user });
            }
          });
        }
        return;
      }
    }

    // Fuera de Telegram — intentar cargar sesión
    const cookieToken = getTokenFromCookie();
    const savedToken = cookieToken ?? localStorage.getItem(SESSION_KEY);

    if (savedToken) {
      loadSession(savedToken).then(user => {
        if (user) {
          setTelegramUser(user);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
        setSessionLoaded(true);
      });
      return;
    }

    // No hay sesión
    setSessionLoaded(true);

    if (isDevelopmentMode()) {
      const devUser = getDevUser();
      if (devUser) setTelegramUser(devUser);
    }
  }, [setIsTelegram, setTelegramUser, setSessionLoaded]);

  return { isTelegram, telegramUser };
}