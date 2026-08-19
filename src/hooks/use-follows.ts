import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface PublicUser {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  totalCards: number;
  totalDecks: number;
}

export function useFollows() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [following, setFollowing] = useState<number[]>([]);
  const [followers, setFollowers] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadFollows();
  }, [telegramUser?.id]);

  const loadFollows = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    try {
      const [{ data: followingData }, { data: followersData }] = await Promise.all([
        supabase.from('user_follows').select('following_id').eq('follower_id', telegramUser.id),
        supabase.from('user_follows').select('follower_id').eq('following_id', telegramUser.id),
      ]);
      setFollowing((followingData ?? []).map(f => f.following_id));
      setFollowers((followersData ?? []).map(f => f.follower_id));
    } finally {
      setIsLoading(false);
    }
  };

  const follow = useCallback(async (userId: number) => {
    if (!telegramUser?.id || following.includes(userId)) return;
    await supabase.from('user_follows').insert({
      follower_id: telegramUser.id,
      following_id: userId,
    });
    setFollowing(prev => [...prev, userId]);

    await supabase.from('user_notifications').insert({
      telegram_user_id: userId,
      type: 'new_follower',
      title: 'Nuevo seguidor',
      body: (telegramUser.username ? '@' + telegramUser.username : telegramUser.first_name ?? 'Alguien') + ' ha empezado a seguirte',
      data: { follower_id: telegramUser.id },
    });

    await supabase.from('activity_feed').insert({
      telegram_user_id: telegramUser.id,
      type: 'follow',
      data: { following_id: userId },
    });
  }, [telegramUser, following]);

  const unfollow = useCallback(async (userId: number) => {
    if (!telegramUser?.id) return;
    await supabase.from('user_follows').delete()
      .eq('follower_id', telegramUser.id)
      .eq('following_id', userId);
    setFollowing(prev => prev.filter(id => id !== userId));
  }, [telegramUser?.id]);

  const isFollowing = useCallback((userId: number) => following.includes(userId), [following]);

  return { following, followers, isLoading, follow, unfollow, isFollowing };
}

export async function searchUsers(query: string): Promise<PublicUser[]> {
  if (!query.trim()) return [];
  const { data } = await supabase
    .from('user_sessions')
    .select('telegram_user_id, username, first_name')
    .or('username.ilike.%' + query + '%,first_name.ilike.%' + query + '%')
    .limit(10);

  if (!data) return [];

  const users = await Promise.all(data.map(async user => {
    const { count: totalCards } = await supabase
      .from('collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', user.telegram_user_id);

    const { count: totalDecks } = await supabase
      .from('decks')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', user.telegram_user_id)
      .eq('is_public', true);

    return {
      telegram_user_id: user.telegram_user_id,
      username: user.username,
      first_name: user.first_name,
      totalCards: totalCards ?? 0,
      totalDecks: totalDecks ?? 0,
    };
  }));

  return users;
}