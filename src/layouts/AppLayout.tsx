import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { useUserStore } from '@/store';
import { isInsideTelegram } from '@/lib/telegram';

const ROOT_PATHS = ['/', '/collection', '/explorer', '/wishlist', '/profile'];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useUserStore((s) => s.telegramUser);

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

  useEffect(() => {
    // Si no está en Telegram y no hay usuario, redirigir al login
    if (!isInsideTelegram() && !telegramUser) {
      const timer = setTimeout(() => {
        if (!useUserStore.getState().telegramUser) {
          navigate('/login');
        }
      }, 2000); // Esperar 2 segundos para que cargue la sesión
      return () => clearTimeout(timer);
    }
  }, [telegramUser, navigate]);

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