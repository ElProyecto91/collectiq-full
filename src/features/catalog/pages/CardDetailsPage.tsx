import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, CheckCircle2, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { cx } from '@/utils';
import { useCreateCollectionItem, useCollectionItem } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { useI18n } from '@/i18n';
import { supabase } from '@/lib/supabase';

interface Attack { name: string; cost: string[]; damage: string; text: string; }
interface Ability { name: string; text: string; type: string; }
interface PokemonCardDetail {
  id: string; name: string; supertype: string; subtypes?: string[]; hp?: string;
  types?: string[]; evolvesFrom?: string; abilities?: Ability[]; attacks?: Attack[];
  weaknesses?: { type: string; value: string }[]; resistances?: { type: string; value: string }[];
  retreatCost?: string[]; number: string; rarity?: string; flavorText?: string; artist?: string;
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; total: number; releaseDate: string; images?: { symbol?: string; logo?: string } };
  cardmarket?: { prices?: { averageSellPrice?: number; lowPrice?: number; trendPrice?: number } };
  tcgplayer?: { prices?: { normal?: { market?: number }; holofoil?: { market?: number }; reverseHolofoil?: { market?: number } } };
  legalities?: { standard?: string; expanded?: string; unlimited?: string };
  nationalPokedexNumbers?: number[];
}

interface PriceHistory {
  price: number;
  date: string;
}

const TYPE_COLORS: Record<string, string> = {
  Fire: 'bg-red-500/20 text-red-400 border-red-500/30', Water: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Grass: 'bg-green-500/20 text-green-400 border-green-500/30', Lightning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Psychic: 'bg-purple-500/20 text-purple-400 border-purple-500/30', Fighting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Darkness: 'bg-gray-500/20 text-gray-400 border-gray-500/30', Metal: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Dragon: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', Fairy: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  Colorless: 'bg-white/10 text-gray-300 border-white/20',
};

function TypeBadge({ type }: { type: string }) {
  return <span className={cx('px-2 py-0.5 rounded-full text-xs font-medium border', TYPE_COLORS[type] ?? 'bg-white/10 text-gray-300 border-white/20')}>{type}</span>;
}

function EnergyCost({ cost }: { cost: string[] }) {
  return (
    <div className="flex gap-0.5 flex-wrap">
      {cost.map((c, i) => (
        <span key={i} className={cx('w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center border', TYPE_COLORS[c] ?? 'bg-white/10 text-gray-300 border-white/20')}>{c[0]}</span>
      ))}
    </div>
  );
}

function MiniPriceChart({ history }: { history: PriceHistory[] }) {
  if (history.length < 2) return null;
  const values = history.map(h => h.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 50;
  const pad = 4;
  const points = history.map((h, i) => {
    const x = pad + (i / (history.length - 1)) * (width - pad * 2);
    const y = height - pad - ((h.price - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const diff = values[values.length - 1] - values[0];
  const pct = values[0] > 0 ? ((diff / values[0]) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Historial de precio</p>
        <div className={'flex items-center gap-1 text-xs font-bold ' + (isUp ? 'text-green-400' : 'text-red-400')}>
          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {isUp ? '+' : ''}{pct}%
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
        <polyline points={points} fill="none"
          stroke={isUp ? '#22c55e' : '#ef4444'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{new Date(history[0].date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
        <span>{new Date(history[history.length - 1].date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
      </div>
    </div>
  );
}

const POKEMON_API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY ?? '';

export function CardDetailsPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<PokemonCardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);

  const { mutate: createItem } = useCreateCollectionItem();
  const { data: existingItem } = useCollectionItem(cardId);
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { formatPrice } = useCurrency();
  const { t } = useI18n();

  useEffect(() => {
    if (!cardId) return;
    setIsLoading(true);
    fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, { headers: { 'X-Api-Key': POKEMON_API_KEY } })
      .then(r => r.json())
      .then(json => { setCard(json.data); setIsLoading(false); })
      .catch(() => { setError('No se pudo cargar esta carta.'); setIsLoading(false); });

    // Cargar historial de precio
    supabase.from('card_price_history')
      .select('price, date')
      .eq('card_id', cardId)
      .order('date', { ascending: true })
      .limit(30)
      .then(({ data }) => setPriceHistory(data ?? []));
  }, [cardId]);

  useEffect(() => {
    // Guardar precio actual en historial si tenemos datos
    if (!card || !cardId) return;
    const price = card.cardmarket?.prices?.averageSellPrice ?? card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market;
    if (!price) return;
    const today = new Date().toISOString().split('T')[0];
    supabase.from('card_price_history')
      .select('id').eq('card_id', cardId).eq('date', today).maybeSingle()
      .then(({ data }) => {
        if (!data) {
          supabase.from('card_price_history').insert({ card_id: cardId, price, date: today });
        }
      });
  }, [card, cardId]);

  const handleAdd = () => {
    if (!card || !telegramUser?.id) return;
    const price = card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market ?? null;
    createItem({
      cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set.name, cardNumber: card.number,
      rarity: card.rarity ?? null, imageUrl: card.images.small, quantity: 1,
      favorite: false, setTotal: card.set.total ?? null,
      marketPrice: card.cardmarket?.prices?.averageSellPrice ?? null,
      tcgplayerPrice: price, currency: 'EUR',
    });
    setAdded(true);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !card) return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 px-4">
      <p className="text-red-400 text-sm text-center">{error}</p>
      <button onClick={() => navigate(-1)} className="text-blue-400 text-sm underline">{t.common.tryAgain}</button>
    </div>
  );

  const isInCollection = existingItem || added;
  const cardmarketPrice = card.cardmarket?.prices?.averageSellPrice;
  const tcgPrice = card.tcgplayer?.prices?.holofoil?.market ?? card.tcgplayer?.prices?.normal?.market;
  const trendPrice = card.cardmarket?.prices?.trendPrice;
  const lowPrice = card.cardmarket?.prices?.lowPrice;
  const cardmarketUrl = `https://www.cardmarket.com/en/Pokemon/Products/Singles?searchString=${encodeURIComponent(card.name)}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 to-transparent pointer-events-none" />
        <button onClick={() => navigate(-1)} className="relative z-10 w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center px-8 pb-6">
        <img src={card.images.large} alt={card.name} className="w-full max-w-xs rounded-2xl shadow-2xl shadow-black/50" />
      </div>

      <div className="px-4 space-y-4">

        {/* Nombre + info básica */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-white">{card.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {card.subtypes?.map(s => <span key={s} className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">{s}</span>)}
                {card.evolvesFrom && <span className="text-xs text-gray-500">Evoluciona de <span className="text-blue-400">{card.evolvesFrom}</span></span>}
              </div>
            </div>
            {card.hp && <div className="shrink-0 text-right"><p className="text-xs text-gray-500">PS</p><p className="text-2xl font-bold text-red-400">{card.hp}</p></div>}
          </div>
          {card.types && <div className="flex gap-2 flex-wrap">{card.types.map(t => <TypeBadge key={t} type={t} />)}</div>}
          {card.flavorText && <p className="text-xs text-gray-400 italic border-t border-white/8 pt-3">"{card.flavorText}"</p>}
        </div>

        {/* Habilidades */}
        {card.abilities && card.abilities.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">Habilidad</p>
            {card.abilities.map((ability, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-bold text-purple-300">{ability.name}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{ability.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Ataques */}
        {card.attacks && card.attacks.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-4">
            <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">Ataques</p>
            {card.attacks.map((attack, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <EnergyCost cost={attack.cost} />
                    <p className="text-sm font-bold text-white truncate">{attack.name}</p>
                  </div>
                  {attack.damage && <span className="text-lg font-bold text-white shrink-0">{attack.damage}</span>}
                </div>
                {attack.text && <p className="text-xs text-gray-400 leading-relaxed">{attack.text}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Debilidad / Resistencia / Retirada */}
        {(card.weaknesses || card.resistances || card.retreatCost) && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Debilidad</p>
                {card.weaknesses?.map((w, i) => (
                  <div key={i} className="flex items-center justify-center gap-1"><TypeBadge type={w.type} /><span className="text-xs text-red-400 font-bold">{w.value}</span></div>
                )) ?? <span className="text-gray-600 text-xs">—</span>}
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Resistencia</p>
                {card.resistances?.map((r, i) => (
                  <div key={i} className="flex items-center justify-center gap-1"><TypeBadge type={r.type} /><span className="text-xs text-green-400 font-bold">{r.value}</span></div>
                )) ?? <span className="text-gray-600 text-xs">—</span>}
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Retirada</p>
                {card.retreatCost && card.retreatCost.length > 0
                  ? <div className="flex justify-center"><EnergyCost cost={card.retreatCost} /></div>
                  : <span className="text-gray-600 text-xs">—</span>}
              </div>
            </div>
          </div>
        )}

        {/* Precios + historial */}
        {(cardmarketPrice || tcgPrice || priceHistory.length > 0) && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-green-400 font-bold uppercase tracking-wider">Precios de mercado</p>
            {(cardmarketPrice || tcgPrice) && (
              <div className="grid grid-cols-2 gap-3">
                {cardmarketPrice && (
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">Cardmarket</p>
                    <p className="text-lg font-bold text-green-400">{formatPrice(cardmarketPrice)}</p>
                  </div>
                )}
                {tcgPrice && (
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">TCGPlayer</p>
                    <p className="text-lg font-bold text-green-400">{formatPrice(tcgPrice)}</p>
                  </div>
                )}
                {trendPrice && (
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">Tendencia</p>
                    <p className="text-lg font-bold text-blue-400">{formatPrice(trendPrice)}</p>
                  </div>
                )}
                {lowPrice && (
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">Precio mínimo</p>
                    <p className="text-lg font-bold text-yellow-400">{formatPrice(lowPrice)}</p>
                  </div>
                )}
              </div>
            )}
            {priceHistory.length >= 2 && (
              <div className="border-t border-white/8 pt-3">
                <MiniPriceChart history={priceHistory} />
              </div>
            )}
          </div>
        )}

        {/* Comprar en Cardmarket */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Comprar carta</p>
          <a href={cardmarketUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between w-full bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 active:scale-95 transition-transform">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛒</span>
              <div>
                <p className="text-sm font-bold text-white">Cardmarket</p>
                <p className="text-[10px] text-gray-500">Mayor mercado europeo</p>
              </div>
            </div>
            <ExternalLink size={14} className="text-gray-500" />
          </a>
        </div>

        {/* Información */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Información</p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            {card.rarity && <><p className="text-xs text-gray-500">Rareza</p><p className="text-xs text-white font-medium">{card.rarity}</p></>}
            <p className="text-xs text-gray-500">Número</p><p className="text-xs text-white font-medium">{card.number}/{card.set.total}</p>
            <p className="text-xs text-gray-500">Set</p><p className="text-xs text-white font-medium">{card.set.name}</p>
            <p className="text-xs text-gray-500">Serie</p><p className="text-xs text-white font-medium">{card.set.series}</p>
            {card.artist && <><p className="text-xs text-gray-500">Ilustrador</p><p className="text-xs text-white font-medium">{card.artist}</p></>}
            {card.nationalPokedexNumbers && card.nationalPokedexNumbers.length > 0 && (
              <><p className="text-xs text-gray-500">Nº Pokédex</p><p className="text-xs text-white font-medium">#{card.nationalPokedexNumbers.join(', #')}</p></>
            )}
          </div>
        </div>

        {/* Legalidades */}
        {card.legalities && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Legalidades</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(card.legalities).map(([format, status]) => (
                <div key={format} className={cx('px-3 py-1.5 rounded-xl text-xs font-medium border',
                  status === 'Legal' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  status === 'Banned' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-gray-500/10 text-gray-400 border-gray-500/20')}>
                  <span className="text-gray-500 capitalize">{format}: </span>{status}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Añadir a colección */}
        <button onClick={handleAdd} disabled={!!isInCollection}
          className={cx('w-full rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 transition-all',
            isInCollection ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-blue-600 text-white active:scale-95')}>
          {isInCollection ? <><CheckCircle2 size={20} /> En tu colección</> : <><Plus size={20} /> Añadir a mi colección</>}
        </button>

      </div>
    </div>
  );
}