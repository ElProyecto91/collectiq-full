import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, CheckCircle2, Heart, Loader2, SearchX } from 'lucide-react';
import { useCreateCollectionItem, useCollectionList } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';

const API = 'https://collectiq-api.esxdinero.workers.dev';

interface OnePieceCard {
  id: string;
  name: string;
  number: string;
  rarity: string;
  type: string;
  color: string[];
  power?: number;
  cost?: number;
  image_url: string;
  set_id: string;
  set_name: string;
  price_eur?: number | null;
}

const COLOR_STYLES: Record<string, string> = {
  Red: 'bg-red-500/20 text-red-400',
  Blue: 'bg-blue-500/20 text-blue-400',
  Green: 'bg-green-500/20 text-green-400',
  Purple: 'bg-purple-500/20 text-purple-400',
  Black: 'bg-gray-500/20 text-gray-300',
  Yellow: 'bg-yellow-500/20 text-yellow-400',
};

async function fetchCards(q: string, set: string, page: number): Promise<{ cards: OnePieceCard[]; total: number }> {
  try {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (set) params.set('set', set);
    const r = await fetch(`${API}/onepiece-cards?${params}`);
    if (!r.ok) return { cards: [], total: 0 };
    return await r.json();
  } catch { return { cards: [], total: 0 }; }
}

async function fetchSets(): Promise<{ id: string; name: string; total: number }[]> {
  try {
    const r = await fetch(`${API}/onepiece-sets`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.sets || [];
  } catch { return []; }
}

export function OnePieceExplorerPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [sets, setSets] = useState<{ id: string; name: string; total: number }[]>([]);
  const [cards, setCards] = useState<OnePieceCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: collectionCards = [] } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: createItem } = useCreateCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();
  const telegramUser = useUserStore(s => s.telegramUser);

  const addedIds = new Set(collectionCards.filter(c => c.tcg === 'onepiece').map(c => c.cardId ?? ''));
  const wishlistIds = new Set(wishlistItems.filter(w => w.tcg === 'onepiece').map(w => w.cardId ?? ''));

  // Cargar sets reales
  useEffect(() => {
    fetchSets().then(data => setSets(data));
  }, []);

  const doSearch = useCallback(async (q: string, set: string, p: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    const result = await fetchCards(q, set, p);
    setTotal(result.total);
    setCards(prev => append ? [...prev, ...result.cards] : result.cards);
    setHasMore(result.cards.length === 20);
    setPage(p);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => { doSearch('', '', 1, false); }, [doSearch]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(query, selectedSet, 1, false), 600);
    return () => clearTimeout(searchTimeout.current);
  }, [query, selectedSet, doSearch]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !isLoadingMore) doSearch(query, selectedSet, page + 1, true); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page, query, selectedSet, doSearch]);

  const handleAdd = (card: OnePieceCard) => {
    if (!telegramUser?.id) return;
    createItem({
      cardId: card.id, tcg: 'onepiece', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set_name, cardNumber: card.number,
      rarity: card.rarity, imageUrl: card.image_url, quantity: 1,
      favorite: false, marketPrice: card.price_eur ?? null, currency: 'EUR',
    } as any);
    setStatusMsg(`✅ ${card.name} añadida`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  const handleWishlist = (card: OnePieceCard) => {
    if (!telegramUser?.id) return;
    createWishlistItem({
      cardId: card.id, tcg: 'onepiece', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set_name, cardNumber: card.number,
      rarity: card.rarity, imageUrl: card.image_url,
    } as any);
    setStatusMsg(`❤️ ${card.name} en wishlist`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Explorador</h1>
          </div>
          <span className="ml-auto text-2xl">☠️</span>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar carta de One Piece..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50" />
        </div>

        {/* Sets reales */}
        {sets.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSet('')}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                selectedSet === '' ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'
              }`}>
              Todos
            </button>
            {sets.slice(0, 20).map(s => (
              <button key={s.id} onClick={() => setSelectedSet(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedSet === s.id ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'
                }`}>
                {s.name || s.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="mx-4 mb-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300 text-center">
          {statusMsg}
        </div>
      )}

      <div className="px-4">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                <div className="aspect-[3/4] bg-white/5 animate-pulse" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                  <div className="h-7 bg-white/5 rounded-xl animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <SearchX size={32} className="text-gray-600" />
            <p className="text-white font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-500">Prueba con otro nombre o set</p>
          </div>
        )}

        {!isLoading && cards.length > 0 && (
          <>
            <p className="text-xs text-gray-500 mb-3">{total} cartas</p>
            <div className="grid grid-cols-2 gap-3">
              {cards.map(card => {
                const added = addedIds.has(card.id);
                const inWishlist = wishlistIds.has(card.id);
                return (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="relative">
                      <img src={card.image_url} alt={card.name}
                        className="w-full aspect-[3/4] object-cover" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x280/111118/666?text=OP'; }} />
                      {added && (
                        <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full p-0.5">
                          <CheckCircle2 size={14} className="text-white" />
                        </div>
                      )}
                      {card.color?.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex gap-1">
                          {card.color.map(c => (
                            <span key={c} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${COLOR_STYLES[c] ?? 'bg-white/10 text-white'}`}>
                              {c[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.number} · {card.rarity}</p>
                      <p className="text-[10px] text-gray-600 truncate">{card.set_name}</p>
                      {card.price_eur && <p className="text-[10px] text-green-400 font-medium">{formatPrice(card.price_eur)}</p>}
                      <button onClick={() => handleAdd(card)}
                        className="w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 bg-red-600 text-white active:scale-95 transition-transform">
                        <Plus size={12} />{added ? 'Añadir otra' : 'Añadir'}
                      </button>
                      <button onClick={() => handleWishlist(card)} disabled={inWishlist}
                        className={`w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          inWishlist ? 'bg-pink-500/10 text-pink-400 cursor-default' : 'bg-white/5 border border-white/10 text-gray-400 active:scale-95'
                        }`}>
                        <Heart size={12} />{inWishlist ? 'En wishlist' : 'Wishlist'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={sentinelRef} className="h-4 w-full" />
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Cargando más...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
