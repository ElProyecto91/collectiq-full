import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers, Trash2, Share2, Globe, Lock, Heart, Download, MessageCircle, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';
import { useCollectionList } from '@/hooks/use-collection';
import { useCurrency } from '@/hooks/use-currency';

interface DeckCard {
  id: string; card_id: string; card_name: string; set_name: string;
  image_url: string; quantity: number; supertype?: string; market_price?: number | null;
}

interface DeckComment {
  id: string; telegram_user_id: number; username: string | null;
  first_name: string | null; content: string; created_at: string;
}

interface Deck {
  id: string; name: string; description: string | null; is_public: boolean;
  cover_card_image: string | null; created_at: string; cards: DeckCard[]; votes: number;
}

export function DecksPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: collectionCards = [] } = useCollectionList();
  const { formatPrice } = useCurrency();
  const collectionIds = new Set(collectionCards.map(c => c.cardId));

  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
const [isPremium, setIsPremium] = useState(false);
const [showPaywall, setShowPaywall] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
  if (!telegramUser?.id) return;
  loadDecks();
  supabase.from('user_premium').select('plan, expires_at')
    .eq('telegram_user_id', telegramUser.id).maybeSingle()
    .then(({ data }) => {
      const isExpired = data?.expires_at ? new Date(data.expires_at) < new Date() : true;
      setIsPremium(data?.plan === 'go' && !isExpired);
    });
}, [telegramUser?.id]);

  const loadDecks = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    try {
      const { data: decksData } = await supabase.from('decks').select('*')
        .eq('telegram_user_id', telegramUser.id).order('created_at', { ascending: false });

      if (!decksData) { setDecks([]); return; }

      const decksWithCards = await Promise.all(decksData.map(async deck => {
        const { data: cards } = await supabase.from('deck_cards').select('*').eq('deck_id', deck.id);
        const { count: votes } = await supabase.from('deck_votes').select('*', { count: 'exact', head: true }).eq('deck_id', deck.id);
        return { ...deck, cards: cards ?? [], votes: votes ?? 0 };
      }));

      setDecks(decksWithCards);
    } finally {
      setIsLoading(false);
    }
  };
const handleCreateDeck = () => {
  if (!isPremium && decks.length >= 1) {
    setShowPaywall(true);
    return;
  }
  navigate('/decks/new');
};

  const handleDelete = async (deckId: string) => {
    if (deletingId !== deckId) { setDeletingId(deckId); return; }
    await supabase.from('decks').delete().eq('id', deckId);
    setDecks(prev => prev.filter(d => d.id !== deckId));
    setDeletingId(null);
  };

  const handleShare = (deck: Deck) => {
    const url = 'https://collectiq-full.vercel.app/decks/public/' + deck.id;
    if (navigator.share) {
      navigator.share({ title: deck.name + ' — CollectIQ', url });
    } else {
      navigator.clipboard.writeText(url);
      alert('Enlace copiado');
    }
  };

  const togglePublic = async (deck: Deck) => {
    await supabase.from('decks').update({ is_public: !deck.is_public }).eq('id', deck.id);
    setDecks(prev => prev.map(d => d.id === deck.id ? { ...d, is_public: !d.is_public } : d));
  };

  const exportToPTCGLive = (deck: Deck) => {
    setExportingId(deck.id);
    try {
      const lines: string[] = [];
      const pokemon = deck.cards.filter(c => c.supertype === 'Pokémon');
      const trainers = deck.cards.filter(c => c.supertype === 'Trainer');
      const energies = deck.cards.filter(c => c.supertype === 'Energy');

      if (pokemon.length > 0) {
        lines.push('Pokémon: ' + pokemon.reduce((s, c) => s + c.quantity, 0));
        pokemon.forEach(c => {
          const setCode = c.set_name.substring(0, 3).toUpperCase();
          lines.push(`${c.quantity} ${c.card_name} ${setCode}`);
        });
        lines.push('');
      }
      if (trainers.length > 0) {
        lines.push('Trainer: ' + trainers.reduce((s, c) => s + c.quantity, 0));
        trainers.forEach(c => {
          const setCode = c.set_name.substring(0, 3).toUpperCase();
          lines.push(`${c.quantity} ${c.card_name} ${setCode}`);
        });
        lines.push('');
      }
      if (energies.length > 0) {
        lines.push('Energy: ' + energies.reduce((s, c) => s + c.quantity, 0));
        energies.forEach(c => {
          const setCode = c.set_name.substring(0, 3).toUpperCase();
          lines.push(`${c.quantity} ${c.card_name} ${setCode}`);
        });
      }

      const text = lines.join('\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = deck.name.replace(/\s+/g, '_') + '.txt';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingId(null);
    }
  };

  const openComments = async (deckId: string) => {
    setCommentsOpen(deckId);
    setLoadingComments(true);
    setNewComment('');
    try {
      const { data } = await supabase.from('deck_comments').select('*')
        .eq('deck_id', deckId).order('created_at', { ascending: true });
      setComments(data ?? []);
    } finally {
      setLoadingComments(false);
    }
  };

  const sendComment = async (deckId: string) => {
    if (!newComment.trim() || !telegramUser?.id || sendingComment) return;
    setSendingComment(true);
    try {
      const { data } = await supabase.from('deck_comments').insert({
        deck_id: deckId,
        telegram_user_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.first_name ?? null,
        content: newComment.trim(),
      }).select().single();
      if (data) setComments(prev => [...prev, data]);
      setNewComment('');
    } finally {
      setSendingComment(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <p className="text-gray-500 text-sm">Cargando mazos...</p>
    </div>
  );

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      {/* Modal comentarios */}
      {commentsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCommentsOpen(null)}>
          <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Comentarios</p>
              <button onClick={() => setCommentsOpen(null)} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cerrar</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {loadingComments ? (
                <p className="text-center text-gray-500 text-sm py-4">Cargando...</p>
              ) : comments.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-4">Sin comentarios aún. ¡Sé el primero!</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs font-bold text-blue-400">{c.first_name ?? c.username ?? 'Usuario'}</p>
                    <p className="text-sm text-white mt-1">{c.content}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{new Date(c.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-2 border-t border-white/8">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment(commentsOpen)}
                placeholder="Escribe un comentario..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              <button onClick={() => sendComment(commentsOpen)} disabled={sendingComment}
                className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50">
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mis Mazos</h1>
          <p className="text-sm text-gray-500">Crea y comparte tus mazos.</p>
        </div>
        <button onClick={handleCreateDeck}
          className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center active:scale-95 transition-transform">
          <Plus size={18} className="text-white" />
        </button>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Layers size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Aun no tienes mazos</p>
            <p className="text-sm text-gray-500 mt-1">Crea tu primer mazo de 60 cartas.</p>
          </div>
          <button onClick={() => navigate('/decks/new')}
            className="bg-blue-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
            <Plus size={18} />Crear mazo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {decks.map(deck => {
            const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);
            const pokemonCount = deck.cards.filter(c => c.supertype === 'Pokémon').reduce((s, c) => s + c.quantity, 0);
            const trainerCount = deck.cards.filter(c => c.supertype === 'Trainer').reduce((s, c) => s + c.quantity, 0);
            const energyCount = deck.cards.filter(c => c.supertype === 'Energy').reduce((s, c) => s + c.quantity, 0);
            const ownedCards = deck.cards.filter(c => collectionIds.has(c.card_id));
            const ownedPct = deck.cards.length > 0 ? Math.round(ownedCards.length / deck.cards.length * 100) : 0;
            const deckValue = deck.cards.reduce((s, c) => s + ((c.market_price ?? 0) * c.quantity), 0);
            const coverImages = deck.cards.slice(0, 4).map(c => c.image_url).filter(Boolean);

            return (
              <div key={deck.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                <div className="relative h-24 bg-gradient-to-r from-blue-950/50 to-purple-950/50 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-end pr-2 gap-1 opacity-60">
                    {coverImages.map((img, i) => (
                      <img key={i} src={img} alt="" className="h-20 w-14 object-cover rounded-lg"
                        style={{ transform: 'rotate(' + (i % 2 === 0 ? -3 : 3) + 'deg)' }} />
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#111118] via-[#111118]/80 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{deck.name}</h3>
                      {deck.is_public ? <Globe size={12} className="text-blue-400" /> : <Lock size={12} className="text-gray-500" />}
                    </div>
                    {deck.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{deck.description}</p>}
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Pokemon', value: pokemonCount, color: 'text-blue-400', emoji: '🎴' },
                      { label: 'Entrenadores', value: trainerCount, color: 'text-yellow-400', emoji: '🎓' },
                      { label: 'Energias', value: energyCount, color: 'text-red-400', emoji: '⚡' },
                    ].map(item => (
                      <div key={item.label} className="bg-white/5 rounded-xl p-2 text-center">
                        <p className="text-xs">{item.emoji}</p>
                        <p className={'text-lg font-bold ' + item.color}>{item.value}</p>
                        <p className="text-[9px] text-gray-500">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{totalCards}/60 cartas</span>
                      {totalCards === 60 && <span className="text-green-400 font-medium">✅ Completo</span>}
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 flex overflow-hidden">
                      <div className="bg-blue-500 h-1.5" style={{ width: (pokemonCount / 60 * 100) + '%' }} />
                      <div className="bg-yellow-500 h-1.5" style={{ width: (trainerCount / 60 * 100) + '%' }} />
                      <div className="bg-red-500 h-1.5" style={{ width: (energyCount / 60 * 100) + '%' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 mb-0.5">Valor estimado</p>
                      <p className="text-sm font-bold text-green-400">{deckValue > 0 ? formatPrice(deckValue) : '—'}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 mb-0.5">En tu coleccion</p>
                      <p className="text-sm font-bold text-blue-400">{ownedPct}%</p>
                      <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                        <div className="bg-blue-500 h-1 rounded-full" style={{ width: ownedPct + '%' }} />
                      </div>
                    </div>
                  </div>

                  {deck.is_public && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Heart size={12} className="text-pink-400" />
                      <span>{deck.votes} votos</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button onClick={() => togglePublic(deck)}
                      className={'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all ' + (
                        deck.is_public ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400')}>
                      {deck.is_public ? <Globe size={13} /> : <Lock size={13} />}
                      {deck.is_public ? 'Publico' : 'Privado'}
                    </button>
                    <button onClick={() => handleShare(deck)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 text-gray-400 active:scale-95 transition-transform">
                      <Share2 size={13} />Compartir
                    </button>
                    <button onClick={() => openComments(deck.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 text-gray-400 active:scale-95 transition-transform">
                      <MessageCircle size={13} />Comentarios
                    </button>
                    <button onClick={() => exportToPTCGLive(deck)}
                      disabled={exportingId === deck.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-purple-500/20 bg-purple-500/10 text-purple-400 active:scale-95 transition-transform disabled:opacity-50">
                      <Download size={13} />PTCGLive
                    </button>
                    <button onClick={() => handleDelete(deck.id)}
                      className={'w-9 h-9 rounded-xl border flex items-center justify-center transition-all ' + (
                        deletingId === deck.id ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-500')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}