import { useCallback, useEffect, useRef } from 'react';
import { useUserStore } from '@/store';

const APP_ID = 'collectiq';

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
        properties: properties ?? {},
        platform: platform.current,
      }),
    }).catch(() => {}); // Silent fail — no queremos que un error de analytics rompa la app
  }, [telegramUser?.id]);

  return { track };
}

export function usePageView(pageName: string) {
  const { track } = useAnalytics();
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    track('page_view', { page: pageName });
  }, [pageName, telegramUser?.id]);
}