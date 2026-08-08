import type { TelegramWebApp } from '@/types';

/**
 * Telegram WebApp SDK accessor.
 *
 * The SDK is loaded via a <script> tag in index.html and attaches to
 * `window.Telegram.WebApp`. This module centralizes detection so callers never
 * touch `window` directly — and so tests can stub the SDK by replacing this
 * module's export.
 */

/** The raw Telegram WebApp instance, or null outside Telegram. */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** True when running inside the Telegram Mini App WebView. */
export function isInsideTelegram(): boolean {
  return getTelegramWebApp() !== null;
}

/**
 * Initialize the Telegram WebApp for display: signal readiness, apply theme,
 * and expand the viewport. Safe to call outside Telegram (no-op).
 */
export function initTelegramWebApp(): TelegramWebApp | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;

  try {
    webApp.ready();
    webApp.expand();
    // Match CollectIQ's dark identity; the SDK accepts a hex color.
    webApp.setBackgroundColor('#07080c');
    webApp.setHeaderColor('#0a0b0f');
    webApp.enableClosingConfirmation?.();
    webApp.disableVerticalSwipes?.();
  } catch {
    // The SDK may throw on unsupported calls across Telegram platform versions;
    // degrade gracefully rather than blocking the app.
  }

  return webApp;
}
