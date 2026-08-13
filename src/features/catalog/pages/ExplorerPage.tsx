import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Loader2,
  SearchX,
  Plus,
  CheckCircle2,
  Search,
  TrendingUp,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string; releaseDate?: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
  types?: string[];
  supertype?: string;
}

interface CollectionEntry {
  card: PokemonCard;
  quantity: number;
  favorite: boolean;
  addedAt: number;
}

const STORAGE_KEY = 'pokemon-collection';

function getCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];
    if ('card' in data[0]) return data;
    return data.map((card: PokemonCard) => ({
      card, quantity: 1, favorite: false, addedAt: Date.now(),
    }));
  } catch { return []; }
}

function addToCollection(card: PokemonCard) {
  const collection = getCollection();
  if (!collection.find(e => e.card.id === card.id)) {
    collection.push({ card, quantity: 1, favorite: false, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-500';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-400';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-500';
}

async function searchCards(query: string, page: number): Promise<{ cards: PokemonCard[]; total: number }> {
  const q = query.trim()
    ? `name:"*${query.trim()}*"`
    : 'name:Charizard OR name:Pikachu OR name:Mewtwo';

  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=20&orderBy=-set.releaseDate`;

  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      return { cards: json.data ?? [], total: json.totalCount ?? 0 };
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 800));
    }
  }
  return { cards: [], total: 0 };
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
  const navigate = useNavigate();
  const [addedIds, setAddedIds] = useState<Set<string>>(() => {
    return new Set(getCollection().map(e => e.card.id));
  });
  const [statusMsg, setStatusMsg] = useState('');

  // Refresh addedIds when component mounts and after adding
  const refreshAddedIds = useCallback(() => {
    setAddedIds(new Set(getCollection().map(e => e.card.id)));
  }, []);

  useEffect(() => {
    refreshAddedIds();
  }, []);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string, p: number, append: boolean) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError('');

    try {
      const result = await searchCards(q, p);
      setTotal(result.total);
      setCards(prev => append ? [...prev, ...result.cards] : result.cards);
      setHasMore(result.cards.length === 20);
      setPage(p);
    } catch (err: any) {
      setError('La API de cartas está temporalmente inactiva. Toca Reintentar.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    doSearch('', 1, false);
  }, []);

  // Search with debounce
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      doSearch(query, 1, false);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          doSearch(query, page + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page, query]);

  const handleAdd = (card: PokemonCard) => {
    addToCollection(card);
    refreshAddedIds();
    setStatusMsg(`✅ ${card.name} añadida a tu colección`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">

      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
        <h1 className="text-2xl font-bold">Explorador</h1>
        <p className="text-sm text-gray-500">Descubre y añade cartas a tu colección</p>
      </div>

      {/* Search */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar carta por nombre…"
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
          {isLoading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Status toast */}
      {statusMsg && (
        <div className="mx-4 mb-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-blue-300 text-center">
          {statusMsg}
        </div>
      )}

      {/* Results count */}
      {!isLoading && cards.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs text-gray-500">
            {query.trim()
              ? `${total.toLocaleString()} resultados para "${query.trim()}"`
              : 'Cartas más recientes'
            }
          </span>
        </div>
      )}

      <div className="flex-1 px-4">

        {/* Loading skeleton */}
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

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => doSearch(query, 1, false)}
              className="mt-3 text-xs text-blue-400 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              {query.trim()
                ? <SearchX size={28} className="text-gray-600" />
                : <Compass size={28} className="text-gray-600" />
              }
            </div>
            <div>
              <p className="text-white font-semibold">
                {query.trim() ? 'No se encontraron cartas' : 'Empieza a explorar'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {query.trim()
                  ? `No hay resultados para "${query.trim()}"`
                  : 'Escribe el nombre de una carta para buscarla'
                }
              </p>
            </div>
          </div>
        )}

        {/* Cards grid */}
        {!isLoading && !error && cards.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {cards.map(card => (
                <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                  <div
                    onClick={() => navigate(`${RoutePaths.Explorer}/card/${card.id}`)}
                    className="cursor-pointer"
                  >
                    <img
                      src={card.images.small}
                      alt={card.name}
                      className="w-full aspect-[2/3] object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-bold truncate">{card.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                    {card.rarity && (
                      <p className={cx('text-[10px] truncate font-medium', getRarityColor(card.rarity))}>
                        {card.rarity
                          .replace('Common', 'Común')
                          .replace('Uncommon', 'Infrecuente')
                          .replace('Rare', 'Rara')
                          .replace('Ultra Rare', 'Ultra Rara')
                          .replace('Secret Rare', 'Secreta')
                          .replace('Hyper Rare', 'Hiper Rara')
                          .replace('Double Rare', 'Doble Rara')
                          .replace('Illustration Rare', 'Ilustración Rara')
                          .replace('Special Illustration Rare', 'Ilustración Especial')
                        }
                      </p>
                    )}
                    {card.cardmarket?.prices?.averageSellPrice && (
                      <p className="text-[10px] text-green-400 font-medium">
                        €{card.cardmarket.prices.averageSellPrice.toFixed(2)}
                      </p>
                    )}
                    <button
                      onClick={() => handleAdd(card)}
                      disabled={addedIds.has(card.id)}
                      className={cx(
                        'w-full mt-1 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                        addedIds.has(card.id)
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95',
                      )}
                    >
                      {addedIds.has(card.id)
                        ? <><CheckCircle2 className="w-3 h-3" /> Añadida</>
                        : <><Plus className="w-3 h-3" /> Añadir</>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4 w-full" />

            {/* Loading more */}
            {isLoadingMore && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" />
                Cargando más cartas…
              </div>
            )}

            {/* End of results */}
            {!hasMore && cards.length > 0 && (
              <p className="text-center text-xs text-gray-600 py-4">
                — Fin de los resultados —
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}