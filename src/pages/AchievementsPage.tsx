import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useXP, ACHIEVEMENTS, getLevelName, getXPData } from '@/hooks/use-xp';
import { useCollectionList } from '@/hooks/use-collection';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export function AchievementsPage() {
  const navigate = useNavigate();
  const { xpData, unlockedAchievements, checkAchievements } = useXP();
  const { data: cards = [] } = useCollectionList();
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    if (!telegramUser?.id || cards.length === 0) return;
    loadAndCheck();
  }, [cards.length, telegramUser?.id]);

  const loadAndCheck = async () => {
    if (!telegramUser?.id) return;

    const { count: totalDecks } = await supabase
      .from('decks')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id);

    const { count: totalVotes } = await supabase
      .from('deck_votes')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id);

    const setGroups = Object.values(
      cards.reduce((acc, card) => {
        const key = card.setName ?? '';
        if (!acc[key]) acc[key] = { count: 0, total: card.setTotal ?? 0 };
        acc[key].count += 1;
        return acc;
      }, {} as Record<string, { count: number; total: number }>)
    );
    const completedSets = setGroups.filter(g => g.total > 0 && g.count >= g.total).length;

    checkAchievements({
      totalCards: cards.reduce((s, c) => s + c.quantity, 0),
      uniqueCards: cards.length,
      totalDecks: totalDecks ?? 0,
      completedSets,
      totalVotes: totalVotes ?? 0,
      totalFavorites: cards.filter(c => c.favorite).length,
    });
  };

  const levelName = getLevelName(xpData.level);
  const unlockedCount = unlockedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">

      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Logros y XP</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Nivel actual */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-5 text-center space-y-3">
          <div>
            <p className="text-4xl font-black text-white">Nivel {xpData.level}</p>
            <p className="text-blue-400 font-bold text-lg">{levelName}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{xpData.xp} XP</span>
              <span>{xpData.nextLevelXP} XP</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                style={{ width: xpData.progress + '%' }} />
            </div>
            <p className="text-xs text-gray-500">{xpData.progress}% para el siguiente nivel</p>
          </div>
        </div>

        {/* Progreso logros */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-2xl">🏅</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">{unlockedCount}/{totalCount} logros</p>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-1.5">
              <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: (unlockedCount / totalCount * 100) + '%' }} />
            </div>
          </div>
          <p className="text-lg font-bold text-yellow-400">{Math.round(unlockedCount / totalCount * 100)}%</p>
        </div>

        {/* Lista de logros */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Todos los logros</p>
          {ACHIEVEMENTS.map(achievement => {
            const unlocked = unlockedAchievements.includes(achievement.key);
            return (
              <div key={achievement.key}
                className={'flex items-center gap-3 rounded-2xl p-3 border transition-all ' + (
                  unlocked ? 'bg-[#111118] border-yellow-500/20' : 'bg-white/3 border-white/5 opacity-60'
                )}>
                <div className={'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ' + (unlocked ? 'bg-yellow-500/20' : 'bg-white/5')}>
                  {unlocked ? achievement.emoji : '🔒'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={'text-sm font-bold ' + (unlocked ? 'text-white' : 'text-gray-500')}>{achievement.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={'text-xs font-bold ' + (unlocked ? 'text-yellow-400' : 'text-gray-600')}>+{achievement.xp} XP</p>
                  {unlocked && <p className="text-[10px] text-green-400 mt-0.5">✓ Desbloqueado</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}