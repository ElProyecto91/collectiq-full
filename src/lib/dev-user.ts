import type { TelegramUser } from '@/types';

const DEV_USER_ID = 999_999_999;

const DEV_USER: TelegramUser = {
  id: DEV_USER_ID,
  first_name: 'Development User',
  username: 'developer',
  language_code: 'en',
};

/**
 * True when Development Mode should be active.
 * En producción dentro de Telegram, siempre devuelve false.
 * Solo activa el modo dev cuando no hay SDK de Telegram disponible.
 */
export function isDevelopmentMode(): boolean {
  if (typeof window === 'undefined') return false;
  const webApp = window.Telegram?.WebApp;
  // Si no hay SDK en absoluto, estamos en dev
  if (!webApp) return true;
  // Si hay SDK pero no hay usuario AÚN, esperamos — no activamos dev mode
  // Esto evita el falso positivo en Telegram donde el user tarda en cargar
  return false;
}

export function getDevUser(): TelegramUser | null {
  if (!isDevelopmentMode()) return null;

  if (import.meta.env.DEV) {
    console.log('Development Mode Active');
    console.log(`User ID: ${DEV_USER.id}`);
    console.log(`Username: ${DEV_USER.username}`);
  }

  return DEV_USER;
}