import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface PremiumData {
  plan: 'free' | 'go';
  isGO: boolean;
  expiresAt: string | null;
  starsPaid: number;
}

export const GO_PRICE_STARS = 150; // ~1.99€ en Telegram Stars
export const GO_SCAN_LIMIT = 5; // escaneos gratis por día

export function usePremium() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [premium, setPremium] = useState<PremiumData>({
    plan: 'free',
    isGO: false,
    expiresAt: null,
    starsPaid: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadPremium();
  }, [telegramUser?.id]);

  const loadPremium = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('user_premium')
        .select('*')
        .eq('telegram_user_id', telegramUser.id)
        .maybeSingle();

      if (data) {
        const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
        const isGO = data.plan === 'go' && !isExpired;
        setPremium({
          plan: isGO ? 'go' : 'free',
          isGO,
          expiresAt: data.expires_at,
          starsPaid: data.stars_paid,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const upgradeToGO = useCallback(async (stars: number) => {
    if (!telegramUser?.id) return false;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('user_premium').upsert({
      telegram_user_id: telegramUser.id,
      plan: 'go',
      expires_at: expiresAt,
      stars_paid: (premium.starsPaid ?? 0) + stars,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' });

    if (!error) {
      setPremium({ plan: 'go', isGO: true, expiresAt, starsPaid: (premium.starsPaid ?? 0) + stars });
      return true;
    }
    return false;
  }, [telegramUser?.id, premium.starsPaid]);

  const getScanCount = useCallback(async (): Promise<number> => {
    if (!telegramUser?.id) return 0;
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('activity_feed')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id)
      .eq('type', 'scan')
      .gte('created_at', today + 'T00:00:00');
    return count ?? 0;
  }, [telegramUser?.id]);

  const canScan = useCallback(async (): Promise<boolean> => {
    if (premium.isGO) return true;
    const count = await getScanCount();
    return count < GO_SCAN_LIMIT;
  }, [premium.isGO, getScanCount]);

  const registerScan = useCallback(async () => {
    if (!telegramUser?.id) return;
    await supabase.from('activity_feed').insert({
      telegram_user_id: telegramUser.id,
      type: 'scan',
      data: {},
    });
  }, [telegramUser?.id]);

  return { premium, isLoading, upgradeToGO, canScan, registerScan, getScanCount };
}