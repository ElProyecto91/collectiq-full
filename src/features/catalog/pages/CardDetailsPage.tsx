import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  ArrowLeft, Brush, Hash, Layers, Scale,
  Shield, Sparkles, Type, Zap, Heart,
  CheckCircle2, TrendingUp, ExternalLink,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';

interface CardSet {
  id: string;
  name: string;
  series: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string;
  images?: { logo?: string; symbol?: string };
}

interface CardPrices {
  averageSellPrice?: number;
  lowPrice?: number;
  trendPrice?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
}

interface PokemonCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  number: string;
  rarity?: string;
  artist?: string;
  flavorText?: string;
  evolvesFrom?: string;
  retreatCost?: string[];
  regulationMark?: string;
  images: { small: string; large: string };
  set: CardSet;
  legalities?: Record<string, string>;
  cardmarket?: { url?: string; prices?: CardPrices };
  tcgplayer?: { url?: string; prices?: Record<string, { market?: number; mid?: number }> };
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
    if (!Array.isArray(data) || data.length === 0) return [];
    if ('card' in data[0]) return data;
    return data.map((card: PokemonCard) => ({ card, quantity: 1, favorite: false, addedAt: Date.now() }));
  } catch { return []; }
}

function addToCollection(card: PokemonCard) {
  const collection = getCollection();
  if (!collection.find(e => e.card.id === card.id)) {
    collection.push({ card, quantity: 1, favorite: false, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
  }
}

function isInCollection(cardId: string): boolean {
  return getCollection().some(e => e.card.id === cardId);
}

async function fetchCard(cardId: string): Promise<PokemonCard> {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`);
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      return json.data as PokemonCard;
    } catch (err) {
      if (i === 3) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('No se pudo cargar la carta. Inténtalo de nuevo.');
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-400';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-300';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-400';
}

function translateRarity(rarity?: string): string {
  if (!rarity) return '—';
  return rarity
    .replace('Common', 'Común')
    .replace('Uncommon', 'Infrecuente')
    .replace('Double Rare', 'Doble Rara')
    .replace('Ultra Rare', 'Ultra Rara')
    .replace('Secret Rare', 'Secreta')
    .replace('Hyper Rare', 'Hiper Rara')
    .replace('Illustration Rare', 'Ilustración Rara')
    .replace('Special Illustration Rare', 'Ilustración Especial')
    .replace('Rare', 'Rara');
}

function translateLegality(status: string): string {
  if (status === 'Legal') return 'Legal';
  if (status === 'Banned') return 'Prohibida';
  if (status === 'Restricted') return 'Restringida';
  return status;
}

export function CardDetailsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<PokemonCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [inCollection, setInCollection] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    setIsLoading(true);
    fetchCard(cardId)
      .then(c => {
        setCard(c);
        setInCollection(isInCollection(cardId));
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [cardId]);

  const handleAdd = () => {
    if (!card) return;
    addToCollection(card);
    setInCollection(true);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(RoutePaths.Explorer)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold leading-tight">Detalle de carta</h1>
        </div>
      </div>

      {isLoading && (
        <div className="flex-1 px-4 space-y-4">
          <div className="mx-auto w-48 aspect-[2/3] bg-white/5 rounded-2xl animate-pulse" />
          <div className="h-7 bg-white/5 rounded animate-pulse w-2/3" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => cardId && fetchCard(cardId).then(setCard).catch(() => {})}
              className="mt-3 text-xs text-blue-400 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {card && !isLoading && (
        <div className="flex-1 px-4 space-y-5">

          {/* Card image */}
          <div className="flex justify-center">
            <img
              src={card.images.large}
              alt={card.name}
              className="w-56 rounded-2xl shadow-2xl shadow-black/50"
            />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold">{card.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{card.set.name}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {card.supertype && (
                <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  {card.supertype}
                </span>
              )}
              {card.subtypes?.map(sub => (
                <span key={sub} className="px-2.5 py-1 rounded-full bg-white/10 text-gray-300 text-xs font-medium">
                  {sub}
                </span>
              ))}
              {card.regulationMark && (
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                  Reg {card.regulationMark}
                </span>
              )}
            </div>
          </div>

          {/* Attributes grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Zap size={15} />, label: 'HP', value: card.hp ?? '—' },
              { icon: <Type size={15} />, label: 'Tipos', value: card.types?.join(' · ') || '—' },
              { icon: <Sparkles size={15} />, label: 'Rareza', value: translateRarity(card.rarity), color: getRarityColor(card.rarity) },
              { icon: <Layers size={15} />, label: 'Set', value: card.set.name },
              { icon: <Brush size={15} />, label: 'Artista', value: card.artist ?? '—' },
              { icon: <Hash size={15} />, label: 'Número', value: `${card.number} / ${card.set.printedTotal ?? '?'}` },
              ...(card.retreatCost ? [{ icon: <Shield size={15} />, label: 'Retirada', value: String(card.retreatCost.length) }] : []),
              ...(card.evolvesFrom ? [{ icon: <Scale size={15} />, label: 'Evoluciona de', value: card.evolvesFrom }] : []),
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="bg-[#111118] border border-white/8 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
                  {icon}
                  <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
                </div>
                <p className={cx('text-sm font-semibold truncate', color ?? 'text-white')} title={value}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Prices */}
          {card.cardmarket?.prices && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <h3 className="text-sm font-semibold">Precios Cardmarket</h3>
                </div>
                {card.cardmarket.url && (
                  <a
                    href={card.cardmarket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-400"
                  >
                    Ver <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {card.cardmarket.prices.averageSellPrice != null && (
                  <div className="bg-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Precio medio</p>
                    <p className="text-base font-bold text-green-400 mt-0.5">
                      €{card.cardmarket.prices.averageSellPrice.toFixed(2)}
                    </p>
                  </div>
                )}
                {card.cardmarket.prices.trendPrice != null && (
                  <div className="bg-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tendencia</p>
                    <p className="text-base font-bold text-blue-400 mt-0.5">
                      €{card.cardmarket.prices.trendPrice.toFixed(2)}
                    </p>
                  </div>
                )}
                {card.cardmarket.prices.lowPrice != null && (
                  <div className="bg-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Precio mínimo</p>
                    <p className="text-base font-bold text-yellow-400 mt-0.5">
                      €{card.cardmarket.prices.lowPrice.toFixed(2)}
                    </p>
                  </div>
                )}
                {card.cardmarket.prices.avg7 != null && (
                  <div className="bg-white/5 rounded-xl p-2.5 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Media 7 días</p>
                    <p className="text-base font-bold text-white mt-0.5">
                      €{card.cardmarket.prices.avg7.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legalities */}
          {card.legalities && Object.keys(card.legalities).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Scale size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold">Legalidades</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(card.legalities).map(([format, status]) => (
                  <div key={format} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400 capitalize">{format}</span>
                    <span className={cx(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium',
                      status === 'Legal' && 'bg-green-500/20 text-green-400',
                      status === 'Banned' && 'bg-red-500/20 text-red-400',
                      status === 'Restricted' && 'bg-yellow-500/20 text-yellow-400',
                    )}>
                      {translateLegality(status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flavor text */}
          {card.flavorText && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <p className="text-sm italic text-gray-400 leading-relaxed">"{card.flavorText}"</p>
            </div>
          )}

          {/* Add to collection */}
          <div className="pb-4">
            {justAdded ? (
              <div className="w-full bg-green-500/20 border border-green-500/30 rounded-2xl py-4 flex items-center justify-center gap-2 text-green-400 font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                ¡Añadida a tu colección!
              </div>
            ) : inCollection ? (
              <div className="w-full bg-green-500/10 border border-green-500/20 rounded-2xl py-4 flex items-center justify-center gap-2 text-green-400 font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Ya está en tu colección
              </div>
            ) : (
              <button
                onClick={handleAdd}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform"
              >
                <Heart className="w-5 h-5" />
                Añadir a Mi Colección
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}