import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { useTelegram } from '@/hooks';
import { I18nProvider } from '@/i18n';

/**
 * App providers — the composition root.
 *
 * Wraps the app with React Query (server-state cache), the i18n provider, and
 * runs the Telegram SDK initialization on mount. New providers (theme, toast)
 * slot in here as the app grows, keeping the provider stack in one auditable
 * place.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  // Detect + initialize the Telegram WebApp once at startup.
  useTelegram();

  // Track network status for offline banners / graceful degradation.
  useEffect(() => {
    const goOnline = () => queryClient.invalidateQueries();
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
}
