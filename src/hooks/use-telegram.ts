import { useEffect } from 'react';

import { initTelegramWebApp, isInsideTelegram } from '@/lib/telegram';
import { isDevelopmentMode, getDevUser } from '@/lib/dev-user';
import { useAppStore } from '@/store';
import { useUserStore } from '@/store';
import type { TelegramUser } from '@/types';

const SESSION_KEY = 'collectiq-session-token';

function getTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
    window.history.replaceState({}, '', '/');
  }
  return token;
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

async function generateAuthCode(telegramUserId: number, userData: any): Promise<string | null> {
  try {
    const res = await fetch('/api/auth-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId, userData }),
    });
    if (!res.ok) return null;
    const { code } = await res.json();
    return code;
  } catch {
    return null;
  }
}

async function loadSession(token: string): Promise<TelegramUser | null> {
  try {
    const res = await fetch(`/api/auth-telegram?token=${token}`);
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
      const startParam = webApp?.initDataUnsafe?.start_param ?? '';

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
// Bonus de bienvenida para nuevos usuarios
fetch('/api/welcome-bonus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telegramUserId: tgUser.id }),
});

        // Si viene desde la PWA, generar código
        if (startParam === 'pwa') {
          generateAuthCode(tgUser.id, normalized).then(code => {
            if (code) {
              webApp?.showAlert?.(
                `Tu código de acceso es:\n\n🔑 ${code}\n\nIntrodúcelo en la app para iniciar sesión. Válido 5 minutos.`,
                () => { webApp?.close?.(); }
              );
            }
          });
          return;
        }

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

    // Fuera de Telegram
    const urlToken = getTokenFromUrl();
    const savedToken = urlToken ?? localStorage.getItem(SESSION_KEY);

    if (savedToken) {
      loadSession(savedToken).then(user => {
        if (user) {
          setTelegramUser(user);
        } else {
          // Sesión inválida — limpiar todo
          localStorage.removeItem(SESSION_KEY);
          setTelegramUser(null);
        }
        setSessionLoaded(true);
      });
      return;
    }

    // No hay sesión guardada
    setTelegramUser(null);
    setSessionLoaded(true);

    if (isDevelopmentMode()) {
      const devUser = getDevUser();
      if (devUser) setTelegramUser(devUser);
    }
  }, [setIsTelegram, setTelegramUser, setSessionLoaded]);

  return { isTelegram, telegramUser };
}