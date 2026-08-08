import type { TelegramUser } from '@/types';

/**
 * Development Mode — a simulated Telegram user for local development.
 *
 * When the app is NOT running inside a real Telegram Mini App session, this
 * module provides a synthetic Telegram user so the entire app (collection,
 * wishlist, profile, statistics) works exactly as if a real Telegram user were
 * authenticated.
 *
 * PRODUCTION SAFETY: Development Mode activates ONLY when the Telegram SDK is
 * present but no real Telegram user can be read from it — which is exactly the
 * Bolt Preview / local-browser scenario. In a real Telegram production
 * deployment, `initDataUnsafe.user` is always populated, so this code never
 * activates and the dev user is never created.
 */

/**
 * Numeric Telegram ID for the dev user. Real Telegram IDs are large integers;
 * this sentinel is small enough to never collide with a real ID but valid as
 * a bigint for the `telegram_user_id` column.
 */
const DEV_USER_ID = 999_999_999;

/** The synthetic Telegram user used outside real Telegram sessions. */
const DEV_USER: TelegramUser = {
  id: DEV_USER_ID,
  first_name: 'Development User',
  username: 'developer',
  language_code: 'en',
};

/**
 * True when Development Mode should be active. This is a runtime check, not a
 * build-time check: the dev user loads only when the Telegram SDK stub is
 * present (from index.html) but no real Telegram user can be read from it.
 * In real Telegram, `initDataUnsafe.user` is always present, so this returns
 * false and the dev user is never created.
 */
export function isDevelopmentMode(): boolean {
  if (typeof window === 'undefined') return false;
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return true;
  return !webApp.initDataUnsafe?.user;
}

/** Returns the synthetic dev user, or null when a real Telegram user exists. */
export function getDevUser(): TelegramUser | null {
  if (!isDevelopmentMode()) return null;

  if (import.meta.env.DEV) {
    console.log('Development Mode Active');
    console.log('Current User:');
    console.log(`User ID: ${DEV_USER.id}`);
    console.log(`Username: ${DEV_USER.username}`);
  }

  return DEV_USER;
}
