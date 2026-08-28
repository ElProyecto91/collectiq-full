import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, CheckCircle2, Heart, Loader2, SearchX,
  LayoutGrid, Grid3x3, SlidersHorizontal, X, ShoppingBag,
} from 'lucide-react';
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
  power?: number | null;
  cost?: number | null;
  image_url: string;
  set_id: string;
  set_name: string;
  price_eur?: number | null;
}

const COLOR_MAP: Record<string, { bg: string; text: string; label: string }> = {
  Red:    { bg: 'bg-red-500/20',    text: 'text-red-400',    label: '🔴 Rojo' },
  Blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: '🔵 Azul' },
  Green:  { bg: 'bg-green-500/20',  text: 'text-green-400',  label: '🟢 Verde' },
  Purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: '🟣 Morado' },
  Black:  { bg: 'bg-gray-500/20',   text: 'text-gray-300',   label: '⚫ Negro' },
  Yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '🟡 Amarillo' },
};

const RARITY_ORDER = ['Leader', 'Secret Rare', 'Super Rare', 'Rare', 'Uncommon', 'Common', 'Promo'];

async function fetchCards(q: string, set: string, page: number) {
  try {
    const p = new URLSearchParams({ page: String(page) });
    if (q) p.set('q', q);
    if (set) p.set('set', set);
    const r = await fetch(`${API}/onepiece-cards?${p}`);
    if (!r.ok) return { cards: [] as OnePieceCard[], total: 0 };
    return await r.json() as { cards: OnePieceCard[]; total: number };
  } catch { return { cards: [] as OnePieceCard[], total: 0 }; }
}

async function fetchSets() {
  try {
    const r = await fetch(`${API}/onepiece-sets`);
    if (!r.ok) return [] as { id: string; name: string; total: number }[];
    const d = await r.json();
    return (d.sets || []) as { id: string; name: string; total: number }[];
  } catch { return [] as { id: string; name: string; total: number }[]; }
}

export function OnePieceExplorerPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('');
  const [selectedLang, setSelectedLang] = useState<'en' | 'jp' | 'fr'>('en');
  const [compact, setCompact] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
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

  useEffect(() => { fetchSets().then(setSets); }, []);

  const doSearch = useCallback(async (q: string, set: string, p: number, append: boolean) => {
    if (append) setIsLoadingMore(true); else setIsLoading(true);
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

  // Filtros locales (color y rareza)
  const filteredCards = cards.filter(c => {
    if (selectedColor && !c.color?.includes(selectedColor)) return false;
    if (selectedRarity && c.rarity !== selectedRarity) return false;
    return true;
  });

  const availableColors = [...new Set(cards.flatMap(c => c.color || []))].filter(Boolean);
  const availableRarities = [...new Set(cards.map(c => c.rarity).filter(Boolean))]
    .sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
  const activeFilters = [selectedColor, selectedRarity, selectedSet].filter(Boolean).length;

  const handleAdd = (card: OnePieceCard) => {
    if (!telegramUser?.id) return;
    createItem({
      cardId: card.id, tcg: 'onepiece', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set_name, cardNumber: card.number,
      rarity: card.rarity, imageUrl: card.image_url, quantity: 1,
      favorite: false, marketPrice: card.price_eur ?? null, currency: 'EUR',
    } as any);
    setStatusMsg(`✅ ${card.name} añadida`);
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleWishlist = (card: OnePieceCard) => {
    if (!telegramUser?.id) return;
    createWishlistItem({
      cardId: card.id, tcg: 'onepiece', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set_name, cardNumber: card.number,
      rarity: card.rarity, imageUrl: card.image_url,
    } as any);
    setStatusMsg(`❤️ ${card.name} en wishlist`);
    setTimeout(() => setStatusMsg(''), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Explorador</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Idioma */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {(['en', 'jp', 'fr'] as const).map(lang => (
                <button key={lang} onClick={() => setSelectedLang(lang)}
                  className={`px-2 py-1.5 text-[10px] font-bold transition-colors ${selectedLang === lang ? 'bg-red-600 text-white' : 'text-gray-400'}`}>
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Compacto */}
            <button onClick={() => setCompact(!compact)}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${compact ? 'bg-red-600/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
              {compact ? <Grid3x3 size={15} /> : <LayoutGrid size={15} />}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-3">
        {/* Búsqueda + filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar carta..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`relative w-12 rounded-2xl border flex items-center justify-center transition-all ${showFilters || activeFilters > 0 ? 'bg-red-600/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
            <SlidersHorizontal size={16} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Panel de filtros */}
        {showFilters && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white">Filtros</p>
              {activeFilters > 0 && (
                <button onClick={() => { setSelectedColor(''); setSelectedRarity(''); setSelectedSet(''); }}
                  className="text-xs text-red-400 flex items-center gap-1">
                  <X size={11} /> Limpiar
                </button>
              )}
            </div>

            {/* Set */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Set</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setSelectedSet('')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${!selectedSet ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                  Todos
                </button>
                {sets.slice(0, 15).map(s => (
                  <button key={s.id} onClick={() => setSelectedSet(selectedSet === s.id ? '' : s.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedSet === s.id ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                    {s.name || s.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            {availableColors.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {availableColors.map(color => {
                    const info = COLOR_MAP[color] ?? { bg: 'bg-white/10', text: 'text-white', label: color };
                    return (
                      <button key={color} onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedColor === color ? info.bg + ' ' + info.text + ' border-current' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rareza */}
            {availableRarities.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Rareza</p>
                <div className="flex gap-2 flex-wrap">
                  {availableRarities.map(r => (
                    <button key={r} onClick={() => setSelectedRarity(selectedRarity === r ? '' : r)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedRarity === r ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className="mx-4 mb-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 text-sm text-red-300 text-center">
          {statusMsg}
        </div>
      )}

      <div className="px-4">
        {isLoading ? (
          <div className={`grid gap-3 ${compact ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {Array.from({ length: compact ? 8 : 6 }).map((_, i) => (
              <div key={i} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                <div className={`${compact ? 'aspect-[3/4]' : 'aspect-[3/4]'} bg-white/5 animate-pulse`} />
                {!compact && <div className="p-2 space-y-1.5"><div className="h-3 bg-white/5 rounded animate-pulse w-3/4" /><div className="h-7 bg-white/5 rounded-xl animate-pulse" /></div>}
              </div>
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <SearchX size={32} className="text-gray-600" />
            <p className="text-white font-semibold">Sin resultados</p>
            <p className="text-sm text-gray-500">Prueba con otros filtros</p>
            {activeFilters > 0 && (
              <button onClick={() => { setSelectedColor(''); setSelectedRarity(''); setSelectedSet(''); }}
                className="text-red-400 text-sm underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              {filteredCards.length} cartas
              {activeFilters > 0 && ` (filtradas de ${cards.length})`}
            </p>
            <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {filteredCards.map(card => {
                const added = addedIds.has(card.id);
                const inWishlist = wishlistIds.has(card.id);

                if (compact) {
                  return (
                    <div key={card.id} className="relative">
                      <img src={card.image_url} alt={card.name}
                        className="w-full aspect-[3/4] object-cover rounded-xl" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x280/111118/666?text=OP'; }} />
                      {added && (
                        <div className="absolute top-1 right-1 bg-green-500/90 rounded-full p-0.5">
                          <CheckCircle2 size={10} className="text-white" />
                        </div>
                      )}
                      <button onClick={() => handleAdd(card)}
                        className="absolute bottom-1 right-1 w-6 h-6 bg-red-600/90 rounded-full flex items-center justify-center active:scale-90">
                        <Plus size={12} className="text-white" />
                      </button>
                    </div>
                  );
                }

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
                      {card.color && card.color.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex gap-1">
                          {card.color.map(c => {
                            const info = COLOR_MAP[c];
                            return info ? (
                              <span key={c} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${info.bg} ${info.text}`}>
                                {c[0]}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      {card.rarity && (
                        <div className="absolute bottom-1.5 left-1.5">
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-yellow-400">
                            {card.rarity === 'Secret Rare' ? 'SCR' :
                             card.rarity === 'Super Rare' ? 'SR' :
                             card.rarity === 'Leader' ? 'L' :
                             card.rarity === 'Rare' ? 'R' :
                             card.rarity === 'Uncommon' ? 'UC' :
                             card.rarity === 'Common' ? 'C' : card.rarity.slice(0, 2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.number} · {card.set_name}</p>
                      <div className="flex items-center gap-1">
                        {card.cost != null && (
                          <span className="text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-full">⚡{card.cost}</span>
                        )}
                        {card.power != null && (
                          <span className="text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-full">💪{card.power}</span>
                        )}
                      </div>
                      {card.price_eur != null && (
                        <p className="text-[10px] text-green-400 font-medium">{formatPrice(card.price_eur)}</p>
                      )}
                      <button onClick={() => handleAdd(card)}
                        className="w-full rounded-xl py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 bg-red-600 text-white active:scale-95 transition-transform">
                        <Plus size={11} />{added ? 'Añadir otra' : 'Añadir'}
                      </button>
                      <button onClick={() => handleWishlist(card)} disabled={inWishlist}
                        className={`w-full rounded-xl py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${inWishlist ? 'bg-pink-500/10 text-pink-400 cursor-default' : 'bg-white/5 border border-white/10 text-gray-400 active:scale-95'}`}>
                        <Heart size={11} />{inWishlist ? 'En wishlist' : 'Wishlist'}
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
