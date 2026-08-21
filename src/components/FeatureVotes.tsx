import { useFeatureVotes } from '@/hooks/use-feature-votes';
import { ThumbsUp } from 'lucide-react';

export function FeatureVotes() {
  const { votes, userVotes, loading, vote, features } = useFeatureVotes();

  if (loading) return null;

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">¿Qué quieres que añadamos?</p>
        <p className="text-[10px] text-gray-600">Vota las categorías que más te interesan</p>
      </div>
      <div className="space-y-2">
        {features.map(f => {
          const count = votes[f.key] ?? 0;
          const voted = userVotes.has(f.key);
          return (
            <button key={f.key} onClick={() => vote(f.key)}
              className={'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all active:scale-95 ' + (
                voted
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-white/5 border-white/8'
              )}>
              <span className="text-lg shrink-0">{f.emoji}</span>
              <span className={'text-sm font-medium flex-1 text-left ' + (voted ? 'text-blue-300' : 'text-gray-300')}>
                {f.label}
              </span>
              <div className={'flex items-center gap-1.5 shrink-0 ' + (voted ? 'text-blue-400' : 'text-gray-500')}>
                <ThumbsUp size={12} className={voted ? 'fill-blue-400' : ''} />
                <span className="text-xs font-bold">{count}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}