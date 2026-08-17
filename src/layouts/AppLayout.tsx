import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from './BottomNav';
import { useUserStore } from '@/store';
import { isInsideTelegram } from '@/lib/telegram';

const ROOT_PATHS = ['/', '/collection', '/explorer', '/community', '/profile'];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);

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
    if (!sessionLoaded) return;
    if (!isInsideTelegram() && !telegramUser) {
      navigate('/login');
    }
  }, [sessionLoaded, telegramUser, navigate]);

  if (!sessionLoaded && !isInsideTelegram()) {
    return (
      <div className="min-h-screen bg-[#07080c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-blue-400 font-bold text-lg">CQ</span>
          </div>
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

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