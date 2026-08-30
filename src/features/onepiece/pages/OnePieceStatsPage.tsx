import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Package, Star, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useCurrency } from '@/hooks/use-currency';

const API = 'https://collectiq-api.esxdinero.workers.dev';

const COLOR_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Red:    { bg: 'bg-red-500/15',    text: 'text-red-400',    dot: 'bg-red-500' },
  Blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-400',   dot: 'bg-blue-500' },
  Green:  { bg: 'bg-green-500/15',  text: 'text-green-400',  dot: 'bg-green-500' },
  Purple: { bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-500' },
  Black:  { bg: 'bg-gray-500/15',   text: 'text-gray-300',   dot: 'bg-gray-500' },
  Yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-500' },
};

interface SetStats {
  setId: string;
  setName: string;
  owned: number;
  total: number;
  missing: number;
  value: number;
  pct: number;
}

export function OnePieceStatsPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { items: cards } = useCollection('onepiece');

  const [setTotals, setSetTotals] = useState<Record<string, number>>({});
  const [loadingTotals, setLoadingTotals] = useState(false);

  // Stats básicas
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const avgPrice = uniqueCards > 0 ? totalValue / uniqueCards : 0;
  const favorites = cards.filter(c => c.favorite).length;
  const withPrice = cards.filter(c => (c.marketPrice ?? 0) > 0).length;

  // Top valiosas
  const topCards = [...cards]
    .filter(c => (c.marketPrice ?? 0) > 0)
    .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0))
    .slice(0, 10);

  // Por set
  const setMap: Record<string, { setId: string; setName: string; owned: number; value: number; cards: typeof cards }> = {};
  cards.forEach(c => {
    const key = c.cardNumber?.split('-')[0] || c.setName || 'Sin set';
    const name = c.setName || key;
    if (!setMap[key]) setMap[key] = { setId: key, setName: name, owned: 0, value: 0, cards: [] };
    setMap[key].owned += c.quantity;
    setMap[key].value += (c.marketPrice ?? 0) * c.quantity;
    setMap[key].cards.push(c);
  });

  // Por rareza
  const rarityMap: Record<string, { count: number; value: number }> = {};
  cards.forEach(c => {
    const r = c.rarity || 'Sin rareza';
    if (!rarityMap[r]) rarityMap[r] = { count: 0, value: 0 };
    rarityMap[r].count += c.quantity;
    rarityMap[r].value += (c.marketPrice ?? 0) * c.quantity;
  });
  const rarities = Object.entries(rarityMap).sort((a, b) => b[1].count - a[1].count);

  // Por color (desde metadata o campo color)
  const colorMap: Record<string, number> = {};
  cards.forEach(c => {
    const colors: string[] = Array.isArray((c as any).color) ? (c as any).color : [];
    colors.forEach(col => {
      colorMap[col] = (colorMap[col] || 0) + 1;
    });
  });
  const colors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);

  // Cargar totales de sets desde Worker para calcular cartas que faltan
  useEffect(() => {
    const setIds = Object.keys(setMap);
    if (!setIds.length || loadingTotals) return;
    setLoadingTotals(true);
    // Cargar sets para obtener total de cartas por set
    fetch(`${API}/onepiece-sets`)
      .then(r => r.json())
      .then(d => {
        const totals: Record<string, number> = {};
        (d.sets || []).forEach((s: any) => { totals[s.id] = s.total || 0; });
        setSetTotals(totals);
      })
      .catch(() => {})
      .finally(() => setLoadingTotals(false));
  }, [cards.length]);

  const setStats: SetStats[] = Object.values(setMap).map(s => {
    const total = setTotals[s.setId] || 0;
    const unique = s.cards.length;
    const missing = total > 0 ? total - unique : 0;
    const pct = total > 0 ? Math.round((unique / total) * 100) : 0;
    return { setId: s.setId, setName: s.setName, owned: s.owned, total, missing, value: s.value, pct };
  }).sort((a, b) => b.value - a.value);

  const maxSetValue = Math.max(...setStats.map(s => s.value), 1);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Estadísticas</h1>
          </div>
          <button onClick={() => navigate('/onepiece/stats')} className="ml-auto">
            <TrendingUp size={18} className="text-orange-400" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Total cartas', value: totalCards, color: 'text-red-400' },
            { label: 'Cartas únicas', value: uniqueCards, color: 'text-purple-400' },
            { label: 'Valor total', value: formatPrice(totalValue), color: 'text-green-400' },
            { label: 'Precio medio', value: formatPrice(avgPrice), color: 'text-blue-400' },
            { label: 'Sets distintos', value: setStats.length, color: 'text-yellow-400' },
            { label: 'En wishlist', value: favorites, color: 'text-pink-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Más valiosas */}
        {topCards.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white flex items-center gap-2"><Star size={13} className="text-yellow-400" /> Más valiosas</p>
            {topCards.map((card, i) => (
              <div key={card.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 font-bold w-5 text-right">#{i + 1}</span>
                {card.imageUrl
                  ? <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-8 object-cover rounded-lg shrink-0" style={{ height: '2.75rem' }} />
                  : <div className="w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-lg" style={{ height: '2.75rem' }}>☠️</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{card.cardName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{card.setName} · {card.rarity}</p>
                </div>
                <p className="text-sm font-bold text-green-400 shrink-0">{formatPrice(card.marketPrice ?? 0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Por set con cartas que faltan */}
        {setStats.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Package size={12} /> Por set
              {loadingTotals && <Loader2 size={11} className="animate-spin text-gray-600" />}
            </p>
            {setStats.map(s => (
              <div key={s.setId} className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{s.setName || s.setId}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-500">{s.cards?.length || 0}{s.total > 0 ? `/${s.total}` : ''} únicas</span>
                      {s.total > 0 && s.pct === 100 && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">✓ Completo</span>}
                      {s.missing > 0 && (
                        <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertCircle size={9} /> Faltan {s.missing}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-green-400">{formatPrice(s.value)}</p>
                    {s.total > 0 && <p className="text-[10px] text-gray-500">{s.pct}%</p>}
                  </div>
                </div>
                {/* Barra completitud */}
                {s.total > 0 && (
                  <div className="w-full bg-white/8 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${s.pct === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-red-600 to-orange-500'}`}
                      style={{ width: `${s.pct}%` }} />
                  </div>
                )}
                {/* Barra valor relativo */}
                <div className="w-full bg-white/5 rounded-full h-1">
                  <div className="h-1 rounded-full bg-blue-500/50 transition-all"
                    style={{ width: `${Math.round((s.value / maxSetValue) * 100)}%` }} />
                </div>
                {/* Botón ver faltantes */}
                {s.missing > 0 && (
                  <button onClick={() => navigate('/onepiece/collection')}
                    className="text-[10px] text-red-400 underline underline-offset-2">
                    Ver cartas que faltan en Colección →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Por rareza */}
        {rarities.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white flex items-center gap-2"><Layers size={12} /> Por rareza</p>
            {rarities.map(([rarity, { count, value }]) => {
              const maxCount = rarities[0][1].count;
              return (
                <div key={rarity} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-yellow-400 font-medium">{rarity}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">{count} cartas</span>
                      {value > 0 && <span className="text-[10px] text-green-400">{formatPrice(value)}</span>}
                    </div>
                  </div>
                  <div className="w-full bg-white/8 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-yellow-500/60 transition-all"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Por color */}
        {colors.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Por color</p>
            <div className="grid grid-cols-2 gap-2">
              {colors.map(([color, count]) => {
                const style = COLOR_STYLES[color] ?? { bg: 'bg-white/5', text: 'text-gray-400', dot: 'bg-gray-500' };
                return (
                  <div key={color} className={`${style.bg} border border-white/8 rounded-xl px-3 py-2 flex items-center gap-2`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                    <span className={`text-xs font-medium ${style.text} flex-1`}>{color}</span>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="text-5xl">☠️</div>
            <p className="text-white font-bold">Sin cartas todavía</p>
            <button onClick={() => navigate('/onepiece/explorer')} className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">Explorar cartas</button>
          </div>
        )}
      </div>
    </div>
  );
}
