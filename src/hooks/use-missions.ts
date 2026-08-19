import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface Mission {
  key: string;
  title: string;
  description: string;
  emoji: string;
  xp: number;
  target: number;
}

export const DAILY_MISSIONS: Mission[] = [
  { key: 'add_card', title: 'Coleccionista del dia', description: 'Añade 3 cartas a tu coleccion', emoji: '🎴', xp: 30, target: 3 },
  { key: 'vote_deck', title: 'Critico de mazos', description: 'Vota un mazo de la comunidad', emoji: '❤️', xp: 20, target: 1 },
  { key: 'explore', title: 'Explorador', description: 'Busca 5 cartas en el explorador', emoji: '🔍', xp: 15, target: 5 },
  { key: 'check_value', title: 'Inversor', description: 'Revisa el valor de tu coleccion', emoji: '💰', xp: 10, target: 1 },
  { key: 'add_wishlist', title: 'Lista de deseos', description: 'Añade una carta a tu wishlist', emoji: '⭐', xp: 15, target: 1 },
];

export interface MissionProgress {
  key: string;
  progress: number;
  completed: boolean;
}

export function useMissions() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [missions, setMissions] = useState<MissionProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadMissions();
  }, [telegramUser?.id]);

  const loadMissions = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('telegram_user_id', telegramUser.id)
        .eq('date', today);

      const existing = data ?? [];
      const result = DAILY_MISSIONS.map(m => {
        const found = existing.find(e => e.mission_key === m.key);
        return { key: m.key, progress: found?.progress ?? 0, completed: found?.completed ?? false };
      });
      setMissions(result);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMission = useCallback(async (key: string, increment: number = 1) => {
    if (!telegramUser?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const mission = DAILY_MISSIONS.find(m => m.key === key);
    if (!mission) return;

    const current = missions.find(m => m.key === key);
    if (current?.completed) return;

    const newProgress = Math.min((current?.progress ?? 0) + increment, mission.target);
    const completed = newProgress >= mission.target;

    await supabase.from('daily_missions').upsert({
      telegram_user_id: telegramUser.id,
      mission_key: key,
      progress: newProgress,
      completed,
      date: today,
    }, { onConflict: 'telegram_user_id,mission_key,date' });

    setMissions(prev => prev.map(m => m.key === key ? { ...m, progress: newProgress, completed } : m));
    return completed ? mission : null;
  }, [telegramUser?.id, missions]);

  const completedCount = missions.filter(m => m.completed).length;
  const totalXP = missions
    .filter(m => m.completed)
    .reduce((s, m) => s + (DAILY_MISSIONS.find(d => d.key === m.key)?.xp ?? 0), 0);

  return { missions, isLoading, updateMission, completedCount, totalXP, reload: loadMissions };
}