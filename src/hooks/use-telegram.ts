import { useState, useEffect } from 'react';
import { useUserStore } from '@/store';

const API_BASE = 'https://collectiq-api.esxdinero.workers.dev';

export function useTelegram() {
  const { telegramUser, setTelegramUser } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.initData) return;
    authenticateWithTelegram(tg.initData, tg.initDataUnsafe?.user);
  }, []);

  async function authenticateWithTelegram(initData: string, user: any) {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (data.ok) {
        setTelegramUser(data.user);
        if (data.token) localStorage.setItem('auth_token', data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function verifySession(token: string) {
    try {
      const res = await fetch(`${API_BASE}/auth-telegram?token=${token}`);
      const data = await res.json();
      if (data.ok) {
        setTelegramUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return { telegramUser, isLoading, error, verifySession };
}

export function useDisplayName(user?: any) {
  if (!user) return 'Usuario';
  return user.first_name ?? user.username ?? 'Usuario';
}