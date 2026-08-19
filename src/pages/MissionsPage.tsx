import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock } from 'lucide-react';
import { useMissions, DAILY_MISSIONS } from '@/hooks/use-missions';
import { useStreak } from '@/hooks/use-streak';

export function MissionsPage() {
  const navigate = useNavigate();
  const { missions, completedCount, totalXP, isLoading } = useMissions();
  const { streak } = useStreak();

  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const hoursLeft = Math.floor((midnight.getTime() - now.getTime()) / 3600000);
  const minutesLeft = Math.floor(((midnight.getTime() - now.getTime()) % 3600000) / 60000);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Misiones del dia</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Racha */}
        <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="text-4xl">🔥</div>
          <div className="flex-1">
            <p className="text-2xl font-black text-white">{streak.currentStreak} dias</p>
            <p className="text-xs text-orange-400">Racha actual · Record: {streak.longestStreak} dias</p>
          </div>
          {streak.isActiveToday && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-xl px-2 py-1">
              <p className="text-[10px] text-green-400 font-bold">✓ Hoy activo</p>
            </div>
          )}
        </div>

        {/* Progreso del dia */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{completedCount}/{DAILY_MISSIONS.length} misiones</p>
              <p className="text-xs text-gray-500">{totalXP} XP ganados hoy</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={12} />
              <span>Se reinicia en {hoursLeft}h {minutesLeft}m</span>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
              style={{ width: (completedCount / DAILY_MISSIONS.length * 100) + '%' }} />
          </div>
        </div>

        {/* Lista de misiones */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Misiones de hoy</p>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Cargando misiones...</div>
          ) : (
            DAILY_MISSIONS.map(mission => {
              const progress = missions.find(m => m.key === mission.key);
              const current = progress?.progress ?? 0;
              const completed = progress?.completed ?? false;
              const pct = Math.round((current / mission.target) * 100);

              return (
                <div key={mission.key}
                  className={'flex items-center gap-3 rounded-2xl p-4 border transition-all ' + (
                    completed ? 'bg-green-500/5 border-green-500/20' : 'bg-[#111118] border-white/8'
                  )}>
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ' + (completed ? 'bg-green-500/20' : 'bg-white/5')}>
                    {completed ? '✅' : mission.emoji}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={'text-sm font-bold ' + (completed ? 'text-green-400' : 'text-white')}>{mission.title}</p>
                    <p className="text-xs text-gray-500">{mission.description}</p>
                    {!completed && (
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                    )}
                    {!completed && (
                      <p className="text-[10px] text-gray-600">{current}/{mission.target}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={'text-xs font-bold ' + (completed ? 'text-green-400' : 'text-yellow-400')}>
                      +{mission.xp} XP
                    </p>
                    {completed && <CheckCircle2 size={16} className="text-green-400 mt-1 ml-auto" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bonus racha */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Bonus de racha 🔥</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { days: 3, bonus: '+10 XP', emoji: '🌱' },
              { days: 7, bonus: '+25 XP', emoji: '⚡' },
              { days: 14, bonus: '+60 XP', emoji: '🌟' },
              { days: 30, bonus: '+150 XP', emoji: '👑' },
            ].map(item => (
              <div key={item.days}
                className={'text-center p-2 rounded-xl border ' + (streak.currentStreak >= item.days ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/8 opacity-50')}>
                <p className="text-lg">{item.emoji}</p>
                <p className="text-[10px] text-white font-bold">{item.days}d</p>
                <p className="text-[9px] text-yellow-400">{item.bonus}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}