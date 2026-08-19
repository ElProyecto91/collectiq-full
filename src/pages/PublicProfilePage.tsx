import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { mapCollectionItem } from '@/utils/mappers';
import type { CollectionItem } from '@/types';

interface PublicUser {
  username: string | null;
  first_name: string | null;
  isPremium: boolean;
}

export function PublicProfilePage() {
  const { telegramId } = useParams<{ telegramId: string }>();
  const [cards, setCards] = useState<CollectionItem[]>([]);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<CollectionItem | null>(null);

  useEffect(() => {
    if (!telegramId) return;
    load();
  }, [telegramId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [{ data: sessionData }, { data: cardsData }, { data: premiumData }] = await Promise.all([
        supabase.from('user_sessions').select('user_data')
          .eq('telegram_user_id', parseInt(telegramId!))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('collection_items').select('*')
          .eq('telegram_user_id', parseInt(telegramId!))
          .order('created_at', { ascending: false }),
        supabase.from('user_premium').select('plan, expires_at')
          .eq('telegram_user_id', parseInt(telegramId!)).maybeSingle(),
      ]);

      const ud = sessionData?.user_data ?? {};
      const isExpired = premiumData?.expires_at ? new Date(premiumData.expires_at) < new Date() : true;
      const isPremium = premiumData?.plan === 'go' && !isExpired;

      setUser({
        username: ud.username ?? null,
        first_name: ud.first_name ?? null,
        isPremium,
      });
      setCards((cardsData ?? []).map(mapCollectionItem));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user?.username ? '@' + user.username : user?.first_name ?? 'Coleccionista';
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const totalValue = cards.reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-12">

      {zoomedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          onClick={() => setZoomedCard(null)}>
          <img src={zoomedCard.imageUrl ?? ''} alt={zoomedCard.cardName}
            className="w-full max-w-xs rounded-2xl shadow-2xl" />
        </div>
      )}

      <div className="px-4 pt-8 pb-6 text-center">
        <div className={'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ' + (user?.isPremium ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : 'bg-blue-600/20 border border-blue-500/30')}>
          <span className={'text-2xl font-bold ' + (user?.isPremium ? 'text-yellow-400' : 'text-blue-400')}>
            {displayName[0].toUpperCase()}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {user?.isPremium ? (
            <h1 className="text-xl font-bold" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {displayName}
            </h1>
          ) : (
            <h1 className="text-xl font-bold">{displayName}</h1>
          )}
          {user?.isPremium && (
            <span className="text-[9px] bg-yellow-500 text-black font-black px-1.5 py-0.5 rounded-full">GO</span>
          )}
        </div>

        {user?.isPremium ? (
          <p className="text-xs text-yellow-500/80 mt-1">✨ CollectIQ GO · Coleccion publica</p>
        ) : (
          <p className="text-xs text-blue-400 mt-1">CollectIQ · Coleccion publica</p>
        )}
      </div>

      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cartas', value: totalCards, color: user?.isPremium ? 'text-yellow-400' : 'text-blue-400' },
            { label: 'Unicas', value: cards.length, color: user?.isPremium ? 'text-yellow-400' : 'text-purple-400' },
            { label: 'Valor est.', value: totalValue > 0 ? totalValue.toFixed(2) + '€' : '—', color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={'bg-[#111118] rounded-2xl p-3 text-center border ' + (user?.isPremium ? 'border-yellow-500/20' : 'border-white/8')}>
              <p className={'text-lg font-bold ' + color}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>Esta coleccion esta vacia</p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-3 gap-2">
          {cards.map(card => (
            <div key={card.id} className="cursor-pointer" onClick={() => setZoomedCard(card)}>
              <img src={card.imageUrl ?? ''} alt={card.cardName}
                className={'w-full aspect-[2/3] object-cover rounded-xl ' + (user?.isPremium ? 'ring-1 ring-yellow-500/20' : '')}
                loading="lazy" />
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-8 px-4">
        <p className="text-xs text-gray-600">Powered by</p>
        <p className="text-sm font-bold text-blue-400 mt-0.5">CollectIQ</p>
        <a href="https://t.me/CollectIQ_bot"
          className={'mt-3 inline-block text-white rounded-xl px-5 py-2.5 text-sm font-medium ' + (user?.isPremium ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-blue-600')}>
          Crea tu coleccion gratis
        </a>
      </div>
    </div>
  );
}