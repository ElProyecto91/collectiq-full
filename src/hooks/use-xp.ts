import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  xp: number;
  condition: (stats: UserStats) => boolean;
}

export interface UserStats {
  totalCards: number;
  uniqueCards: number;
  totalDecks: number;
  completedSets: number;
  totalVotes: number;
  totalFavorites: number;
}

export interface XPData {
  xp: number;
  level: number;
  nextLevelXP: number;
  currentLevelXP: number;
  progress: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { key: 'first_card', title: 'Primera carta', description: 'Añade tu primera carta', emoji: '🎴', xp: 50, condition: s => s.totalCards >= 1 },
  { key: 'ten_cards', title: 'Coleccionista', description: 'Llega a 10 cartas', emoji: '📦', xp: 100, condition: s => s.totalCards >= 10 },
  { key: 'fifty_cards', title: 'Entusiasta', description: 'Llega a 50 cartas', emoji: '🌟', xp: 200, condition: s => s.totalCards >= 50 },
  { key: 'hundred_cards', title: 'Centenario', description: 'Llega a 100 cartas', emoji: '💯', xp: 500, condition: s => s.totalCards >= 100 },
  { key: 'five_hundred_cards', title: 'Gran Coleccionista', description: 'Llega a 500 cartas', emoji: '👑', xp: 1000, condition: s => s.totalCards >= 500 },
  { key: 'first_favorite', title: 'Favorito', description: 'Marca tu primera carta favorita', emoji: '⭐', xp: 25, condition: s => s.totalFavorites >= 1 },
  { key: 'first_deck', title: 'Constructor', description: 'Crea tu primer mazo', emoji: '🃏', xp: 150, condition: s => s.totalDecks >= 1 },
  { key: 'three_decks', title: 'Estratega', description: 'Crea 3 mazos', emoji: '♟️', xp: 300, condition: s => s.totalDecks >= 3 },
  { key: 'first_vote', title: 'Social', description: 'Vota un mazo de la comunidad', emoji: '❤️', xp: 50, condition: s => s.totalVotes >= 1 },
  { key: 'first_set', title: 'Set completo', description: 'Completa tu primer set', emoji: '🏆', xp: 500, condition: s => s.completedSets >= 1 },
  { key: 'three_sets', title: 'Completista', description: 'Completa 3 sets', emoji: '💎', xp: 1000, condition: s => s.completedSets >= 3 },
];

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
const LEVEL_NAMES = [
  'Novato', 'Aprendiz', 'Entrenador', 'Coleccionista',
  'Experto', 'Maestro', 'Gran Maestro', 'Campeon',
  'Elite', 'Leyenda', 'Mitico', 'Inmortal',
];

export function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
}

export function getXPData(xp: number): XPData {
  const level = getLevel(xp);
  const currentLevelXP = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXP = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const progress = nextLevelXP > currentLevelXP
    ? Math.round(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100)
    : 100;
  return { xp, level, nextLevelXP, currentLevelXP, progress };
}

export function useXP() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [xpData, setXpData] = useState<XPData>({ xp: 0, level: 1, nextLevelXP: 100, currentLevelXP: 0, progress: 0 });
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadXP();
    loadAchievements();
  }, [telegramUser?.id]);

  const loadXP = async () => {
    if (!telegramUser?.id) return;
    const { data } = await supabase
      .from('user_xp')
      .select('xp, level')
      .eq('telegram_user_id', telegramUser.id)
      .maybeSingle();
    if (data) setXpData(getXPData(data.xp));
  };

  const loadAchievements = async () => {
    if (!telegramUser?.id) return;
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('telegram_user_id', telegramUser.id);
    setUnlockedAchievements((data ?? []).map(a => a.achievement_key));
  };

  const addXP = useCallback(async (amount: number) => {
    if (!telegramUser?.id) return;
    const newXP = xpData.xp + amount;
    const newLevel = getLevel(newXP);
    await supabase.from('user_xp').upsert({
      telegram_user_id: telegramUser.id,
      xp: newXP,
      level: newLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' });
    setXpData(getXPData(newXP));
  }, [telegramUser?.id, xpData.xp]);

  const checkAchievements = useCallback(async (stats: UserStats) => {
    if (!telegramUser?.id) return;
    for (const achievement of ACHIEVEMENTS) {
      if (unlockedAchievements.includes(achievement.key)) continue;
      if (achievement.condition(stats)) {
        const { error } = await supabase.from('user_achievements').insert({
          telegram_user_id: telegramUser.id,
          achievement_key: achievement.key,
        });
        if (!error) {
          setUnlockedAchievements(prev => [...prev, achievement.key]);
          setNewAchievement(achievement);
          await addXP(achievement.xp);
          setTimeout(() => setNewAchievement(null), 4000);
        }
      }
    }
  }, [telegramUser?.id, unlockedAchievements, addXP]);

  return { xpData, unlockedAchievements, newAchievement, addXP, checkAchievements };
}