import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from './BottomNav';

const ROOT_PATHS = ['/', '/collection', '/explorer', '/wishlist', '/profile'];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    const isRoot = ROOT_PATHS.includes(location.pathname);

    if (isRoot) {
      webApp.BackButton?.hide();
    } else {
      webApp.BackButton?.show();
      webApp.BackButton?.onClick(() => navigate(-1));
    }

    return () => {
      webApp.BackButton?.offClick(() => navigate(-1));
    };
  }, [location.pathname, navigate]);

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