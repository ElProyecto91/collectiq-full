import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

const FEATURES = [
  { key: 'funko', label: 'Funko Pop', emoji: '🎭' },
  { key: 'yugioh', label: 'Yu-Gi-Oh!', emoji: '🃏' },
  { key: 'magic', label: 'Magic: The Gathering', emoji: '🔮' },
  { key: 'onepiece', label: 'One Piece TCG', emoji: '⚓' },
  { key: 'lorcana', label: 'Lorcana', emoji: '✨' },
  { key: 'dragonball', label: 'Dragon Ball SCG', emoji: '🐉' },
  { key: 'digimon', label: 'Digimon TCG', emoji: '🦕' },
  { key: 'other', label: 'Otros coleccionables', emoji: '📦' },
];

export function useFeatureVotes() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadVotes = useCallback(async () => {
    const { data } = await supabase
      .from('feature_votes')
      .select('feature');

    if (!data) return;

    const counts: Record<string, number> = {};
    data.forEach(v => { counts[v.feature] = (counts[v.feature] ?? 0) + 1; });
    setVotes(counts);

    if (telegramUser?.id) {
      const { data: myVotes } = await supabase
        .from('feature_votes')
        .select('feature')
        .eq('telegram_user_id', telegramUser.id);
      setUserVotes(new Set(myVotes?.map(v => v.feature) ?? []));
    }

    setLoading(false);
  }, [telegramUser?.id]);

  useEffect(() => { loadVotes(); }, [loadVotes]);

  const vote = useCallback(async (feature: string) => {
    if (!telegramUser?.id || userVotes.has(feature)) return;
    await supabase.from('feature_votes').insert({
      telegram_user_id: telegramUser.id,
      feature,
    });
    setUserVotes(prev => new Set(prev).add(feature));
    setVotes(prev => ({ ...prev, [feature]: (prev[feature] ?? 0) + 1 }));
  }, [telegramUser?.id, userVotes]);

  return { votes, userVotes, loading, vote, features: FEATURES };
}