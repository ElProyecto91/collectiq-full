import { useCallback, useEffect, useRef } from 'react';
import { useUserStore } from '@/store';
import { usePremium } from '@/hooks/use-premium';

const APP_ID = 'collectiq';
const APP_VERSION = '1.0.0';

function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('collectiq_session_id');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('collectiq_session_id', sessionId);
  }
  return sessionId;
}

function getPlatform(): string {
  const tg = (window as any).Telegram?.WebApp;
  if (tg?.initData) return 'telegram';
  if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}

export function useAnalytics() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { premium } = usePremium();
  const sessionId = useRef(getSessionId());
  const platform = useRef(getPlatform());

  const track = useCallback((eventName: string, properties?: Record<string, any>) => {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: APP_ID,
        telegramUserId: telegramUser?.id ?? null,
        sessionId: sessionId.current,
        eventName,
        platform: platform.current,
        appVersion: APP_VERSION,
        isPremium: premium.isGO ?? false,
        properties: properties ?? {},
      }),
    }).catch(() => {});
  }, [telegramUser?.id, premium.isGO]);

  return { track };
}

export function usePageView(pageName: string) {
  const { track } = useAnalytics();
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    track('page_view', { page: pageName });
  }, [pageName, telegramUser?.id]);
}