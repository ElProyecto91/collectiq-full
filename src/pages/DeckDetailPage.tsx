import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface DeckCard {
  id: string;
  card_name: string;
  card_number: string;
  set_name: string;
  image_url: string;
  quantity: number;
  supertype: string;
}

interface DeckDetail {
  id: string;
  name: string;
  description: string | null;
  telegram_user_id: number;
  is_public: boolean;
  created_at: string;
  cards: DeckCard[];
  votes: number;
  copies: number;
  userVoted: boolean;
}

export function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);

  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<DeckCard | null>(null);

  useEffect(() => {
    if (!deckId) return;
    loadDeck();
  }, [deckId]);

  const loadDeck = async () => {
    setIsLoading(true);
    try {
      const { data: deckData } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();

      if (!deckData) return;

      const { data: cards } = await supabase
        .from('deck_cards')
        .select('*')
        .eq('deck_id', deckId);

      const { count: votes } = await supabase
        .from('deck_votes')
        .select('*', { count: 'exact', head: true })
        .eq('deck_id', deckId);

      const { count: copies } = await supabase
        .from('deck_copies')
        .select('*', { count: 'exact', head: true })
        .eq('deck_id', deckId);

      const { data: userVoteData } = await supabase
        .from('deck_votes')
        .select('id')
        .eq('deck_id', deckId)
        .eq('telegram_user_id', telegramUser?.id ?? 0)
        .maybeSingle();

      setDeck({
        ...deckData,
        cards: cards ?? [],
        votes: votes ?? 0,
        copies: copies ?? 0,
        userVoted: !!userVoteData,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!deck || !telegramUser?.id) return;
    if (deck.userVoted) {
      await supabase.from('deck_votes').delete()
        .eq('deck_id', deck.id).eq('telegram_user_id', telegramUser.id);
      setDeck(d => d ? { ...d, votes: d.votes - 1, userVoted: false } : d);
    } else {
      await supabase.from('deck_votes').insert({ deck_id: deck.id, telegram_user_id: telegramUser.id });
      setDeck(d => d ? { ...d, votes: d.votes + 1, userVoted: true } : d);
    }
  };

  const handleCopy = async () => {
    if (!deck || !telegramUser?.id) return;
    await supabase.from('deck_copies').insert({ deck_id: deck.id, telegram_user_id: telegramUser.id });
    setDeck(d => d ? { ...d, copies: d.copies + 1 } : d);
    alert('Mazo copiado');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando mazo...</p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Mazo no encontrado</p>
      </div>
    );
  }

  const pokemonCount = deck.cards.filter(c => c.supertype === 'Pokémon').reduce((s, c) => s + c.quantity, 0);
  const trainerCount = deck.cards.filter(c => c.supertype === 'Trainer').reduce((s, c) => s + c.quantity, 0);
  const energyCount = deck.cards.filter(c => c.supertype === 'Energy').reduce((s, c) => s + c.quantity, 0);
  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">

      {zoomedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={() => setZoomedCard(null)}>
          <img src={zoomedCard.image_url} alt={zoomedCard.card_name} className="w-full max-w-xs rounded-2xl shadow-2xl" />
          <p className="absolute bottom-8 text-white text-center font-bold">{zoomedCard.card_name}</p>
        </div>
      )}

      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold truncate">{deck.name}</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {deck.description && (
          <p className="text-sm text-gray-400">{deck.description}</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pokemon', value: pokemonCount, color: 'text-blue-400', emoji: '🎴' },
            { label: 'Entrenadores', value: trainerCount, color: 'text-yellow-400', emoji: '🎓' },
            { label: 'Energias', value: energyCount, color: 'text-red-400', emoji: '⚡' },
          ].map(item => (
            <div key={item.label} className="bg-[#111118] border border-white/8 rounded-xl p-2 text-center">
              <p className="text-xs">{item.emoji}</p>
              <p className={'text-lg font-bold ' + item.color}>{item.value}</p>
              <p className="text-[9px] text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">{totalCards}/60 cartas</span>
            {totalCards === 60 && <span className="text-green-400">✅ Completo</span>}
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 flex overflow-hidden">
            <div className="bg-blue-500 h-1.5" style={{ width: (pokemonCount / 60 * 100) + '%' }} />
            <div className="bg-yellow-500 h-1.5" style={{ width: (trainerCount / 60 * 100) + '%' }} />
            <div className="bg-red-500 h-1.5" style={{ width: (energyCount / 60 * 100) + '%' }} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleVote}
            className={'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border transition-all ' + (
              deck.userVoted
                ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                : 'bg-white/5 border-white/10 text-gray-400 active:scale-95'
            )}>
            <Heart size={16} className={deck.userVoted ? 'fill-pink-400' : ''} />
            {deck.votes} votos
          </button>
          <button onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium border border-white/10 bg-white/5 text-gray-400 active:scale-95 transition-transform">
            <Copy size={16} />
            Copiar mazo
          </button>
        </div>

        {['Pokémon', 'Trainer', 'Energy'].map(supertype => {
          const group = deck.cards.filter(c => c.supertype === supertype);
          if (group.length === 0) return null;
          const groupTotal = group.reduce((s, c) => s + c.quantity, 0);
          return (
            <div key={supertype} className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {supertype === 'Pokémon' ? '🎴 Pokemon' : supertype === 'Trainer' ? '🎓 Entrenadores' : '⚡ Energias'} ({groupTotal})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.map(card => (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setZoomedCard(card)}>
                    <img src={card.image_url} alt={card.card_name} className="w-full aspect-[2/3] object-cover" />
                    <div className="p-1.5">
                      <p className="text-[10px] font-bold truncate">{card.card_name}</p>
                      <p className="text-[9px] text-gray-500">x{card.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}