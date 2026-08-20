import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass, Loader2, SearchX, Plus, CheckCircle2, Search, TrendingUp, Heart, PackagePlus,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useCreateCollectionItem, useCollectionList } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { useI18n } from '@/i18n';
import { useActiveTCG, TCG_OPTIONS } from '@/hooks/use-active-tcg';
import { useXP } from '@/hooks/use-xp';
import { useMissions } from '@/hooks/use-missions';
import { AchievementToast } from '@/components/AchievementToast';
import type { CardVariant, CardLanguage } from '@/types';
import { CARD_LANGUAGES } from '@/types';
import { supabase } from '@/lib/supabase';

interface PokemonCard {
  id: string; name: string; number: string; rarity?: string;
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; releaseDate?: string; total?: number };
  cardmarket?: { prices?: { averageSellPrice?: number } };
  tcgplayer?: { prices?: { normal?: { market?: number }; holofoil?: { market?: number }; reverseHolofoil?: { market?: number } } };
  types?: string[]; supertype?: string;
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-500';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-400';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-500';
}

function getPriceForVariant(card: PokemonCard, variant: CardVariant): number | null {
  const prices = card.tcgplayer?.prices;
  if (prices) {
    if (variant === 'holofoil' && prices.holofoil?.market) return prices.holofoil.market;
    if (variant === 'reverseHolofoil' && prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
    if (variant === 'normal' && prices.normal?.market) return prices.normal.market;
  }
  return card.cardmarket?.prices?.averageSellPrice ?? null;
}

const POKEMON_API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY ?? '';

async function searchCards(query: string, page: number): Promise<{ cards: PokemonCard[]; total: number }> {
  const q = query.trim()
    ? 'name:"*' + query.trim() + '*"'
    : 'name:Charizard OR name:Pikachu OR name:Mewtwo';
  const url = 'https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(q) + '&page=' + page + '&pageSize=20&orderBy=-set.releaseDate';
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1))); continue;
      }
      if (!res.ok) throw new Error('Error ' + res.status);
      const json = await res.json();
      return { cards: json.data ?? [], total: json.totalCount ?? 0 };
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { cards: [], total: 0 };
}

function TCGSelector({ activeTCG, setActiveTCG }: { activeTCG: string; setActiveTCG: (tcg: any) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {TCG_OPTIONS.map(tcg => {
        const isActive = activeTCG === tcg.key;
        return (
          <button key={tcg.key} onClick={() => setActiveTCG(tcg.key)}
            className={'shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-medium transition-all border ' + (
              isActive ? 'border-opacity-100 text-white' : tcg.available ? 'bg-white/5 text-gray-400 border-white/10 active:scale-95' : 'bg-white/5 text-gray-600 border-white/8 active:scale-95'
            )}
            style={isActive ? { backgroundColor: tcg.color + '22', borderColor: tcg.color, color: tcg.color } : {}}>
            <span className="w-6 h-6" style={{ color: isActive ? tcg.color : tcg.available ? '#9ca3af' : '#4b5563' }}
              dangerouslySetInnerHTML={{ __html: tcg.icon }} />
            <span className="whitespace-nowrap">{tcg.label}</span>
            {!tcg.available && <span className="text-[8px] text-gray-600 -mt-0.5">pronto</span>}
          </button>
        );
      })}
    </div>
  );
}

function AddCardSelector({ card, onAdd, onClose }: {
  card: PokemonCard;
  onAdd: (variant: CardVariant, language: CardLanguage) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState<'variant' | 'language'>('variant');
  const [selectedVariant, setSelectedVariant] = useState<CardVariant>('normal');

  const variants: { key: CardVariant; label: string; desc: string; emoji: string; price: number | null }[] = [
    { key: 'normal', label: t.variants.normal, desc: t.variants.normalDesc, emoji: '🃏', price: card.tcgplayer?.prices?.normal?.market ?? card.cardmarket?.prices?.averageSellPrice ?? null },
    { key: 'holofoil', label: t.variants.holofoil, desc: t.variants.holofoilDesc, emoji: '✨', price: card.tcgplayer?.prices?.holofoil?.market ?? null },
    { key: 'reverseHolofoil', label: t.variants.reverseHolofoil, desc: t.variants.reverseHolofoilDesc, emoji: '🌈', price: card.tcgplayer?.prices?.reverseHolofoil?.market ?? null },
    { key: 'firstEdition', label: t.variants.firstEdition, desc: t.variants.firstEditionDesc, emoji: '⭐', price: null },
    { key: 'promo', label: t.variants.promo, desc: t.variants.promoDesc, emoji: '🎁', price: null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3" onClick={e => e.stopPropagation()}>
        {step === 'variant' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{t.variants.select}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.name}</p>
              </div>
              <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">{t.common.cancel}</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {variants.map(v => (
                <button key={v.key} onClick={() => { setSelectedVariant(v.key); setStep('language'); }}
                  className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-3 text-left active:scale-95 transition-transform">
                  <span className="text-2xl shrink-0">{v.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{v.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{v.desc}</p>
                  </div>
                  {v.price && <span className="text-xs text-green-400 shrink-0 font-medium">{formatPrice(v.price)}</span>}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 'language' && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{t.cardLanguages.select}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.name}</p>
              </div>
              <button onClick={() => setStep('variant')} className="text-blue-400 text-xs bg-blue-500/10 px-3 py-1.5 rounded-lg">Volver</button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {CARD_LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => onAdd(selectedVariant, lang.code)}
                  className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-3 text-left active:scale-95 transition-transform">
                  <span className="text-2xl shrink-0">{lang.flag}</span>
                  <p className="text-sm font-semibold text-white">{lang.label}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ExplorerPage() {
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<PokemonCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [selectorCard, setSelectorCard] = useState<PokemonCard | null>(null);
  const [addingFullSet, setAddingFullSet] = useState(false);
  const navigate = useNavigate();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const cache = useRef<Map<string, { cards: PokemonCard[]; total: number }>>(new Map());

  const { data: collectionCards = [] } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();
  const { mutate: createItem } = useCreateCollectionItem();
  const { mutate: createWishlistItem } = useCreateWishlistItem();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const { activeTCG, setActiveTCG } = useActiveTCG();
  const { checkAchievements, newAchievement } = useXP();
  const { updateMission } = useMissions();

  const addedIds = new Set(collectionCards.map(c => c.cardId));
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setWishlistIds(new Set(wishlistItems.map(w => w.cardId)));
  }, [wishlistItems]);

  const doSearch = useCallback(async (q: string, p: number, append: boolean) => {
    const cacheKey = q + '-' + p;
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError('');
    try {
      let result;
      if (cache.current.has(cacheKey)) {
        result = cache.current.get(cacheKey)!;
      } else {
        result = await searchCards(q, p);
        cache.current.set(cacheKey, result);
      }
      setTotal(result.total);
      setCards(prev => append ? [...prev, ...result.cards] : result.cards);
      setHasMore(result.cards.length === 20);
      setPage(p);
    } catch {
      setError('La base de datos oficial de Pokemon esta caida. Intentalo de nuevo en unos minutos.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => { doSearch('', 1, false); }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      doSearch(query, 1, false);
      if (query.trim()) updateMission('explore');
    }, 800);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !isLoadingMore) doSearch(query, page + 1, true); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page, query]);

  const handleAdd = async (card: PokemonCard, variant: CardVariant, language: CardLanguage) => {
    if (!telegramUser?.id) return;
    setSelectorCard(null);
    const price = getPriceForVariant(card, variant);
    const marketPrice = card.cardmarket?.prices?.averageSellPrice ?? null;
    createItem({
      cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set.name, cardNumber: card.number,
      rarity: card.rarity ?? null, imageUrl: card.images.small, quantity: 1,
      favorite: false, setTotal: card.set.total ?? null,
      marketPrice: price ?? marketPrice, tcgplayerPrice: price, currency: 'EUR',
      variant, cardLanguage: language,
    });

    setStatusMsg('✅ ' + card.name + ' añadida a tu coleccion');
    setTimeout(() => setStatusMsg(''), 2500);

    await updateMission('add_card');

    const { count: totalDecks } = await supabase
      .from('decks').select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id);
    const newTotal = collectionCards.reduce((s, c) => s + c.quantity, 0) + 1;
    const newUnique = addedIds.has(card.id) ? collectionCards.length : collectionCards.length + 1;
    checkAchievements({
      totalCards: newTotal, uniqueCards: newUnique, totalDecks: totalDecks ?? 0,
      completedSets: 0, totalVotes: 0, totalFavorites: collectionCards.filter(c => c.favorite).length,
    });

    // Verificar referido
    fetch('/api/check-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id, totalCards: newTotal }),
    });
  };

  const handleWishlist = async (card: PokemonCard) => {
    if (!telegramUser?.id) return;
    createWishlistItem({
      cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set.name, cardNumber: card.number,
      rarity: card.rarity ?? null, imageUrl: card.images.small, setTotal: card.set.total ?? null,
    } as any);
    setWishlistIds(prev => new Set([...prev, card.id]));
    setStatusMsg('❤️ ' + card.name + ' añadida a tu wishlist');
    setTimeout(() => setStatusMsg(''), 2500);
    await updateMission('add_wishlist');
  };

  const addFullSet = useCallback(async () => {
    if (!telegramUser?.id || cards.length === 0 || addingFullSet) return;
    const setId = cards[0]?.set?.id;
    if (!setId) return;
    setAddingFullSet(true);
    setStatusMsg('⏳ Añadiendo set completo...');
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250`,
        { headers: { 'X-Api-Key': POKEMON_API_KEY } }
      );
      const json = await res.json();
      const setCards: PokemonCard[] = json.data ?? [];
      let added = 0;
      for (const card of setCards) {
        if (addedIds.has(card.id)) continue;
        const price = card.cardmarket?.prices?.averageSellPrice ?? card.tcgplayer?.prices?.normal?.market ?? null;
        createItem({
          cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
          cardName: card.name, setName: card.set.name, cardNumber: card.number,
          rarity: card.rarity ?? null, imageUrl: card.images.small, quantity: 1,
          favorite: false, setTotal: card.set.total ?? null,
          marketPrice: price, tcgplayerPrice: price, currency: 'EUR',
          variant: 'normal', cardLanguage: 'en',
        });
        added++;
      }
      if (added > 0) {
        await updateMission('add_card');
        const newTotal = collectionCards.reduce((s, c) => s + c.quantity, 0) + added;
        fetch('/api/check-referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramUserId: telegramUser.id, totalCards: newTotal }),
        });
      }
      setStatusMsg(`✅ ${added} cartas del set añadidas`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch {
      setStatusMsg('❌ Error al añadir el set. Inténtalo de nuevo.');
      setTimeout(() => setStatusMsg(''), 3000);
    } finally {
      setAddingFullSet(false);
    }
  }, [cards, telegramUser?.id, addedIds, createItem, addingFullSet]);

  const currentTCG = TCG_OPTIONS.find(t => t.key === activeTCG);
  const showComingSoon = activeTCG !== 'all' && activeTCG !== 'pokemon';

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <AchievementToast achievement={newAchievement} onDone={() => {}} />

      {selectorCard && (
        <AddCardSelector
          card={selectorCard}
          onAdd={(variant, language) => handleAdd(selectorCard, variant, language)}
          onClose={() => setSelectorCard(null)}
        />
      )}

      <div className="px-4 pt-6 pb-4">
        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
        <h1 className="text-2xl font-bold">{t.explorer.title}</h1>
        <p className="text-sm text-gray-500">{t.explorer.subtitle}</p>
      </div>

      <div className="px-4 pb-3">
        <TCGSelector activeTCG={activeTCG} setActiveTCG={setActiveTCG} />
      </div>

      {showComingSoon ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: (currentTCG?.color ?? '#6366f1') + '22' }}>
            <span className="w-10 h-10" style={{ color: currentTCG?.color }}
              dangerouslySetInnerHTML={{ __html: currentTCG?.icon ?? '' }} />
          </div>
          <div>
            <p className="text-white font-bold text-lg">{currentTCG?.label}</p>
            <p className="text-sm text-gray-500 mt-1">El catalogo de {currentTCG?.label} estara disponible proximamente.</p>
          </div>
          <button onClick={() => setActiveTCG('pokemon')} className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
            Ver Pokemon TCG
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t.explorer.searchPlaceholder}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
            </div>
          </div>

          {statusMsg && (
            <div className="mx-4 mb-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-blue-300 text-center">
              {statusMsg}
            </div>
          )}

          {!isLoading && cards.length > 0 && (
            <div className="px-4 pb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">
                  {query.trim() ? total.toLocaleString() + ' resultados para "' + query.trim() + '"' : t.explorer.latestCards}
                </span>
              </div>
              {!query.trim() && (
                <button onClick={addFullSet} disabled={addingFullSet}
                  className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl px-3 py-1.5 text-xs font-medium active:scale-95 transition-transform disabled:opacity-50">
                  {addingFullSet ? <Loader2 size={12} className="animate-spin" /> : <PackagePlus size={12} />}
                  Set completo
                </button>
              )}
            </div>
          )}

          <div className="flex-1 px-4">
            {isLoading && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="aspect-[2/3] bg-white/5 animate-pulse" />
                    <div className="p-2.5 space-y-2">
                      <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
                      <div className="h-7 bg-white/5 rounded-xl animate-pulse mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && !isLoading && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={() => doSearch(query, 1, false)} className="mt-3 text-xs text-blue-400 underline">
                  {t.common.tryAgain}
                </button>
              </div>
            )}

            {!isLoading && !error && cards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  {query.trim() ? <SearchX size={28} className="text-gray-600" /> : <Compass size={28} className="text-gray-600" />}
                </div>
                <div>
                  <p className="text-white font-semibold">{query.trim() ? t.explorer.noCardsFound : t.explorer.startSearching}</p>
                  <p className="text-sm text-gray-500 mt-1">{query.trim() ? 'No hay resultados para "' + query.trim() + '"' : t.explorer.startSearchingDesc}</p>
                </div>
              </div>
            )}

            {!isLoading && !error && cards.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {cards.map(card => {
                    const price = card.cardmarket?.prices?.averageSellPrice ?? card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market ?? null;
                    const alreadyAdded = addedIds.has(card.id);
                    return (
                      <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                        <div onClick={() => navigate(RoutePaths.Explorer + '/card/' + card.id)} className="cursor-pointer relative">
                          <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                          {alreadyAdded && (
                            <div className="absolute top-1.5 right-1.5 bg-green-500/90 rounded-full p-0.5">
                              <CheckCircle2 size={14} className="text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 space-y-1.5">
                          <p className="text-xs font-bold truncate">{card.name}</p>
                          <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                          {card.rarity && (
                            <p className={cx('text-[10px] truncate font-medium', getRarityColor(card.rarity))}>
                              {card.rarity.replace('Common', 'Comun').replace('Uncommon', 'Infrecuente').replace('Rare', 'Rara').replace('Ultra Rare', 'Ultra Rara').replace('Secret Rare', 'Secreta').replace('Hyper Rare', 'Hiper Rara').replace('Double Rare', 'Doble Rara').replace('Illustration Rare', 'Ilustracion Rara').replace('Special Illustration Rare', 'Ilustracion Especial')}
                            </p>
                          )}
                          {price && <p className="text-[10px] text-green-400 font-medium">{formatPrice(price)}</p>}
                          <button onClick={() => setSelectorCard(card)}
                            className="w-full mt-1 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-blue-600 hover:bg-blue-500 text-white active:scale-95">
                            <Plus className="w-3 h-3" />
                            {alreadyAdded ? 'Añadir otra' : 'Añadir'}
                          </button>
                          <button onClick={() => handleWishlist(card)} disabled={wishlistIds.has(card.id)}
                            className={cx('w-full rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                              wishlistIds.has(card.id) ? 'bg-pink-500/10 text-pink-400 cursor-default' : 'bg-white/5 border border-white/10 text-gray-400 active:scale-95')}>
                            <Heart className="w-3 h-3" />
                            {wishlistIds.has(card.id) ? 'En wishlist' : 'Wishlist'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div ref={sentinelRef} className="h-4 w-full" />

                {isLoadingMore && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    {t.explorer.loadingMore}
                  </div>
                )}

                {!hasMore && cards.length > 0 && (
                  <p className="text-center text-xs text-gray-600 py-4">— {t.explorer.endOfResults} —</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}