import { useEffect, useState } from 'react';
import type { Achievement } from '@/hooks/use-xp';

export function AchievementToast({ achievement, onDone }: { achievement: Achievement | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setVisible(true);
      const t = setTimeout(() => { setVisible(false); setTimeout(onDone, 300); }, 3500);
      return () => clearTimeout(t);
    }
  }, [achievement]);

  if (!achievement) return null;

  return (
    <div className={'fixed top-4 left-4 right-4 z-50 transition-all duration-300 ' + (visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4')}>
      <div className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3 shadow-2xl border border-yellow-400/30">
        <span className="text-3xl shrink-0">{achievement.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-yellow-100/80 font-bold uppercase tracking-wider">Logro desbloqueado</p>
          <p className="text-sm font-bold text-white">{achievement.title}</p>
          <p className="text-xs text-yellow-100/70">{achievement.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black text-white">+{achievement.xp}</p>
          <p className="text-[10px] text-yellow-100/70">XP</p>
        </div>
      </div>
    </div>
  );
}