import { Users, Flame, Trophy, Plus, Layers, Heart, Copy, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface PublicDeck {
  id: string;
  name: string;
  description: string | null;
  cover_card_image: string | null;
  created_at: string;
  telegram_user_id: number;
  votes: number;
  copies: number;
  userVoted: boolean;
  cards: { supertype: string; quantity: number }[];
}

type CommunityTab = 'decks' | 'collections' | 'ranking';

export function CommunityPage() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('decks');
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);

  useEffect(() => {
    if (activeTab === 'decks') loadDecks();
  }, [activeTab]);

  const loadDecks = async () => {
    setIsLoading(true);
    try {
      const { data: decksData } = await supabase
        .from('decks')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!decksData) { setDecks([]); return; }

      const decksWithStats = await Promise.all(decksData.map(async deck => {
        const { count: votes } = await supabase
          .from('deck_votes')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deck.id);

        const { count: copies } = await supabase
          .from('deck_copies')
          .select('*', { count: 'exact', head: true })
          .eq('deck_id', deck.id);

        const { data: userVoteData } = await supabase
          .from('deck_votes')
          .select('id')
          .eq('deck_id', deck.id)
          .eq('telegram_user_id', telegramUser?.id ?? 0)
          .maybeSingle();

        const { data: cards } = await supabase
          .from('deck_cards')
          .select('supertype, quantity')
          .eq('deck_id', deck.id);

        return {
          ...deck,
          votes: votes ?? 0,
          copies: copies ?? 0,
          userVoted: !!userVoteData,
          cards: cards ?? [],
        };
      }));

      setDecks(decksWithStats);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (deck: PublicDeck) => {
    if (!telegramUser?.id) return;

    if (deck.userVoted) {
      await supabase.from('deck_votes').delete()
        .eq('deck_id', deck.id)
        .eq('telegram_user_id', telegramUser.id);
      setDecks(prev => prev.map(d => d.id === deck.id
        ? { ...d, votes: d.votes - 1, userVoted: false }
        : d));
    } else {
      await supabase.from('deck_votes').insert({
        deck_id: deck.id,
        telegram_user_id: telegramUser.id,
      });
      setDecks(prev => prev.map(d => d.id === deck.id
        ? { ...d, votes: d.votes + 1, userVoted: true }
        : d));
    }
  };

  const handleCopy = async (deck: PublicDeck) => {
    if (!telegramUser?.id) return;
    await supabase.from('deck_copies').insert({
      deck_id: deck.id,
      telegram_user_id: telegramUser.id,
    });
    setDecks(prev => prev.map(d => d.id === deck.id
      ? { ...d, copies: d.copies + 1 }
      : d));
    alert('Mazo copiado — proximamente podras verlo en Mis Mazos');
  };

  const filtered = decks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const ranked = [...decks].sort((a, b) => b.votes - a.votes);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-2xl font-bold">Comunidad</h1>
          <p className="text-sm text-gray-500">Mazos, colecciones y mas.</p>
        </div>
        {activeTab === 'decks' && (
          <button onClick={() => navigate('/decks/new')}
            className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center active:scale-95 transition-transform">
            <Plus size={18} className="text-white" />
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        <div className="flex gap-2 bg-white/5 rounded-xl p-1">
          {[
            { key: 'decks', label: 'Mazos', icon: <Flame size={13} /> },
            { key: 'collections', label: 'Colecciones', icon: <Users size={13} /> },
            { key: 'ranking', label: 'Ranking', icon: <Trophy size={13} /> },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as CommunityTab)}
              className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ' + (activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400')}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'decks' && (
          <>
            <button onClick={() => navigate('/decks')}
              className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 active:scale-95 transition-transform">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Layers size={16} className="text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-white">Mis mazos</p>
                <p className="text-xs text-gray-500">Ver y gestionar tus mazos</p>
              </div>
              <span className="text-gray-500 text-xs">›</span>
            </button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar mazos..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500 text-sm">Cargando mazos...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Flame size={28} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-white font-semibold">Sin mazos publicos todavia</p>
                  <p className="text-sm text-gray-500 mt-1">Se el primero en publicar un mazo.</p>
                </div>
                <button onClick={() => navigate('/decks/new')}
                  className="bg-blue-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
                  <Plus size={18} />
                  Crear mi primer mazo
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(deck => {
                  const pokemonCount = deck.cards.filter(c => c.supertype === 'Pokémon').reduce((s, c) => s + c.quantity, 0);
                  const trainerCount = deck.cards.filter(c => c.supertype === 'Trainer').reduce((s, c) => s + c.quantity, 0);
                  const energyCount = deck.cards.filter(c => c.supertype === 'Energy').reduce((s, c) => s + c.quantity, 0);
                  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);
                  const isOwn = deck.telegram_user_id === telegramUser?.id;

                  return (
                    <div key={deck.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                      <div className="relative h-20 bg-gradient-to-r from-blue-950/50 to-purple-950/50 overflow-hidden">
                        {deck.cover_card_image && (
                          <img src={deck.cover_card_image} alt=""
                            className="absolute right-4 top-0 h-full w-20 object-cover opacity-40 rounded-lg" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#111118] via-[#111118]/80 to-transparent" />
                        <div className="absolute bottom-3 left-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">{deck.name}</p>
                            {isOwn && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Tuyo</span>}
                          </div>
                          {deck.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{deck.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-3 space-y-3">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{'🎴 ' + pokemonCount + ' · 🎓 ' + trainerCount + ' · ⚡ ' + energyCount}</span>
                          <span className={totalCards === 60 ? 'text-green-400' : 'text-gray-500'}>{totalCards}/60</span>
                        </div>

                        <div className="w-full bg-white/10 rounded-full h-1 flex overflow-hidden">
                          <div className="bg-blue-500 h-1" style={{ width: (pokemonCount / 60 * 100) + '%' }} />
                          <div className="bg-yellow-500 h-1" style={{ width: (trainerCount / 60 * 100) + '%' }} />
                          <div className="bg-red-500 h-1" style={{ width: (energyCount / 60 * 100) + '%' }} />
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => handleVote(deck)}
                            className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all ' + (
                              deck.userVoted
                                ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                                : 'bg-white/5 border-white/10 text-gray-400 active:scale-95'
                            )}>
                            <Heart size={13} className={deck.userVoted ? 'fill-pink-400' : ''} />
                            {deck.votes} votos
                          </button>
                          <button onClick={() => handleCopy(deck)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 text-gray-400 active:scale-95 transition-transform">
                            <Copy size={13} />
                            {deck.copies} copias
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'collections' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Users size={28} className="text-gray-600" />
            </div>
            <p className="text-white font-semibold">Colecciones proximamente</p>
            <p className="text-sm text-gray-500">Pronto podras ver las colecciones de otros usuarios.</p>
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="space-y-3">
            {ranked.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Trophy size={28} className="text-gray-600" />
                </div>
                <p className="text-white font-semibold">Ranking proximamente</p>
                <p className="text-sm text-gray-500">Los mazos mas votados apareceran aqui.</p>
              </div>
            ) : (
              ranked.map((deck, i) => (
                <div key={deck.id} className="flex items-center gap-3 bg-[#111118] border border-white/8 rounded-xl px-4 py-3">
                  <span className={'text-lg font-bold w-6 text-center ' + (
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'
                  )}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                  </span>
                  {deck.cover_card_image && (
                    <img src={deck.cover_card_image} alt={deck.name} className="w-10 h-14 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{deck.name}</p>
                    <p className="text-xs text-gray-500">{deck.votes} votos · {deck.copies} copias</p>
                  </div>
                  <button onClick={() => handleVote(deck)}
                    className={'w-9 h-9 rounded-xl border flex items-center justify-center transition-all ' + (
                      deck.userVoted ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' : 'bg-white/5 border-white/10 text-gray-400'
                    )}>
                    <Heart size={14} className={deck.userVoted ? 'fill-pink-400' : ''} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}