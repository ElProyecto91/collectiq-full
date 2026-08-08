import { Outlet } from 'react-router-dom';

import { BottomNav } from './BottomNav';

/**
 * AppLayout — the app shell wrapping every primary route.
 *
 * Provides the scrollable content area (with top/bottom safe-area padding) and
 * the fixed bottom navigation. Pages render into the Outlet; the layout
 * guarantees consistent spacing so individual pages don't repeat it.
 */
export function AppLayout() {
  return (
    <div className="relative min-h-dvh bg-base">
      <main
        className="mx-auto min-h-dvh max-w-md px-4 pb-24"
        style={{ paddingTop: 'var(--tg-safe-top)' }}
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
