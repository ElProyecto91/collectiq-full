import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  isActiveToday: boolean;
}

export function useStreak() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    isActiveToday: false,
  });

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadAndUpdateStreak();
  }, [telegramUser?.id]);

  const loadAndUpdateStreak = async () => {
    if (!telegramUser?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('telegram_user_id', telegramUser.id)
      .maybeSingle();

    if (!data) {
      await supabase.from('user_streaks').insert({
        telegram_user_id: telegramUser.id,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: today,
      });
      setStreak({ currentStreak: 1, longestStreak: 1, lastActiveDate: today, isActiveToday: true });
      return;
    }

    const lastActive = data.last_active_date;
    const isActiveToday = lastActive === today;
    const wasActiveYesterday = lastActive === yesterday;

    if (isActiveToday) {
      setStreak({
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastActiveDate: lastActive,
        isActiveToday: true,
      });
      return;
    }

    let newStreak = wasActiveYesterday ? data.current_streak + 1 : 1;
    let newLongest = Math.max(newStreak, data.longest_streak);

    await supabase.from('user_streaks').update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    }).eq('telegram_user_id', telegramUser.id);

    setStreak({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActiveDate: today,
      isActiveToday: true,
    });
  };

  return { streak };
}