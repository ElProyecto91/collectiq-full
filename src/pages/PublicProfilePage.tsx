import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { mapCollectionItem } from '@/utils/mappers';
import type { CollectionItem } from '@/types';
import { CARD_LANGUAGES } from '@/types';

interface PublicUser {
  username: string | null;
  first_name: string | null;
}

export function PublicProfilePage() {
  const { telegramId } = useParams<{ telegramId: string }>();
  const [cards, setCards] = useState<CollectionItem[]>([]);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<CollectionItem | null>(null);

  useEffect(() => {
    if (!telegramId) return;

    async function load() {
      setIsLoading(true);
      try {
        const { data: sessionData } = await supabase
          .from('user_sessions')
          .select('telegram_user_id, username, first_name')
          .eq('telegram_user_id', parseInt(telegramId!))
          .maybeSingle();

        if (sessionData) {
          setUser({ username: sessionData.username, first_name: sessionData.first_name });
        }

        const { data: cardsData } = await supabase
          .from('collection_items')
          .select('*')
          .eq('telegram_user_id', parseInt(telegramId!))
          .order('created_at', { ascending: false });

        setCards((cardsData ?? []).map(mapCollectionItem));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [telegramId]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={() => setZoomedCard(null)}>
          <img src={zoomedCard.imageUrl ?? ''} alt={zoomedCard.cardName} className="w-full max-w-xs rounded-2xl shadow-2xl" />
        </div>
      )}

      <div className="px-4 pt-8 pb-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-blue-400">
            {(user?.first_name ?? user?.username ?? 'C')[0].toUpperCase()}
          </span>
        </div>
        <h1 className="text-xl font-bold">{displayName}</h1>
        <p className="text-xs text-blue-400 mt-1">CollectIQ · Coleccion publica</p>
      </div>

      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cartas', value: totalCards, color: 'text-blue-400' },
            { label: 'Unicas', value: cards.length, color: 'text-purple-400' },
            { label: 'Valor est.', value: totalValue > 0 ? totalValue.toFixed(2) + 'EUR' : '—', color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
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
              <img
                src={card.imageUrl ?? ''}
                alt={card.cardName}
                className="w-full aspect-[2/3] object-cover rounded-xl"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-8 px-4">
        <p className="text-xs text-gray-600">Powered by</p>
        <p className="text-sm font-bold text-blue-400 mt-0.5">CollectIQ</p>
        <a href="https://t.me/CollectIQ_bot" className="mt-3 inline-block bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
          Crea tu coleccion gratis
        </a>
      </div>
    </div>
  );
}