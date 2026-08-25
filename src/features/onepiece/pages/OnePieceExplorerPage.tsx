import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, CheckCircle2, Heart, Loader2, SearchX } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useCreateCollectionItem, useCollectionList } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';

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

const SETS = [
  { id: '', name: 'Todos los sets' },
  { id: 'OP01', name: 'OP01 - Romance Dawn' },
  { id: 'OP02', name: 'OP02 - Paramount War' },
  { id: 'OP03', name: 'OP03 - Pillars of Strength' },
  { id: 'OP04', name: 'OP04 - Kingdoms of Intrigue' },
  { id: 'OP05', name: 'OP05 - Awakening' },
  { id: 'OP06', name: 'OP06 - Wings of the Captain' },
  { id: 'OP07', name: 'OP07 - 500 Years in the Future' },
  { id: 'OP08', name: 'OP08 - Two Legends' },
  { id: 'OP09', name: 'OP09 - The Four Emperors' },
  { id: 'ST01', name: 'ST01 - Straw Hat Crew' },
  { id: 'ST02', name: 'ST02 - Worst Generation' },
];

const COLOR_STYLES: Record<string, string> = {
  Red: 'bg-red-500/20 text-red-400',
  Blue: 'bg-blue-500/20 text-blue-400',
  Green: 'bg-green-500/20 text-green-400',
  Purple: 'bg-purple-500/20 text-purple-400',
  Black: 'bg-gray-500/20 text-gray-300',
  Yellow: 'bg-yellow-500/20 text-yellow-400',
};

async function fetchOnePieceCards(q: string, set: string, page: number): Promise<{ cards: OnePieceCard[]; total: number }> {
  // Usamos la API de optcgdecks que es pública
  const params = new URLSearchParams();
  if (q) params.set('name', q);
  if (set) params.set('set', set);
  params.set('page', String(page));
  params.set('limit', '20');

  try {
    const r = await fetch(`https://db.optcgdecks.com/cards?${params.toString()}`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    const cards = (data.cards ?? data.data ?? []).map((c: any) => ({
      id: c.id ?? c.card_id ?? c.number,
      name: c.name,
      number: c.number ?? c.card_number ?? '',
      rarity: c.rarity ?? '',
      type: c.type ?? c.card_type ?? '',
      color: Array.isArray(c.color) ? c.color : [c.color].filter(Boolean),
      power: c.power ?? null,
      cost: c.cost ?? null,
      image_url: c.image_url ?? c.img ?? `https://en.onepiece-cardgame.com/images/cardlist/card/${c.number}.png`,
      set_id: c.set_id ?? c.set ?? '',
      set_name: c.set_name ?? c.set ?? '',
      price_eur: c.price_eur ?? null,
    }));
    return { cards, total: data.total ?? cards.length };
  } catch {
    return { cards: [], total: 0 };
  }
}

export function OnePieceExplorerPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [cards, setCards] = useState<OnePieceCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const { data: collectionCards = [] } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: createItem } = useCreateCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();
  const telegramUser = useUserStore(s => s.telegramUser);

  const addedIds = new Set(collectionCards.filter(c => c.tcg === 'onepiece').map(c => c.cardId ?? ''));
  const wishlistIds = new Set(wishlistItems.filter(w => w.tcg === 'onepiece').map(w => w.cardId ?? ''));

  const doSearch = useCallback(async (q: string, set: string, p: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    const result = await fetchOnePieceCards(q, set, p);
    setTotal(result.total);
    setCards(prev => append ? [...prev, ...result.cards] : result.cards);
    setHasMore(result.cards.length === 20);
    setPage(p);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => { doSearch('', '', 1, false); }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(query, selectedSet, 1, false), 600);
    return () => clearTimeout(searchTimeout.current);
  }, [query, selectedSet]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !isLoadingMore) doSearch(query, selectedSet, page + 1, true); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page, query, selectedSet]);

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
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
          <h1 className="text-lg font-bold">Explorador</h1>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar carta..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SETS.map(s => (
            <button key={s.id} onClick={() => setSelectedSet(s.id)}
              className={'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + (
                selectedSet === s.id ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'
              )}>
              {s.id || 'Todos'}
            </button>
          ))}
        </div>
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
                      {card.color.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex gap-1">
                          {card.color.map(c => (
                            <span key={c} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${COLOR_STYLES[c] ?? 'bg-white/10 text-white'}`}>{c[0]}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.number} · {card.rarity}</p>
                      {card.price_eur && <p className="text-[10px] text-green-400 font-medium">{formatPrice(card.price_eur)}</p>}
                      <button onClick={() => handleAdd(card)}
                        className="w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 bg-red-600 text-white active:scale-95 transition-transform">
                        <Plus size={12} />{added ? 'Añadir otra' : 'Añadir'}
                      </button>
                      <button onClick={() => handleWishlist(card)} disabled={inWishlist}
                        className={'w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ' + (
                          inWishlist ? 'bg-pink-500/10 text-pink-400 cursor-default' : 'bg-white/5 border border-white/10 text-gray-400 active:scale-95'
                        )}>
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
                <Loader2 size={16} className="animate-spin" />Cargando más...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}