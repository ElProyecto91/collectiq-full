import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Star } from 'lucide-react';
import { useCollectionList } from '@/hooks/use-collection';
import { useWishlistList } from '@/hooks/use-wishlist';
import { useCurrency } from '@/hooks/use-currency';

const COLOR_EMOJI: Record<string, string> = {
  Red: '🔴', Blue: '🔵', Green: '🟢', Purple: '🟣', Black: '⚫', Yellow: '🟡',
};

export function OnePieceStatsPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: allCards = [] } = useCollectionList();
  const { data: allWishlist = [] } = useWishlistList();

  const cards = allCards.filter(c => c.tcg === 'onepiece');
  const wishlist = allWishlist.filter(w => w.tcg === 'onepiece');

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const avgPrice = uniqueCards > 0 ? totalValue / uniqueCards : 0;

  // Por set
  const bySets = Object.values(cards.reduce((acc, c) => {
    const key = c.setName ?? 'Sin set';
    if (!acc[key]) acc[key] = { name: key, count: 0, value: 0 };
    acc[key].count += c.quantity;
    acc[key].value += (c.marketPrice ?? 0) * c.quantity;
    return acc;
  }, {} as Record<string, { name: string; count: number; value: number }>))
    .sort((a, b) => b.count - a.count);

  // Por rareza
  const byRarity = Object.values(cards.reduce((acc, c) => {
    const key = c.rarity ?? 'Desconocida';
    if (!acc[key]) acc[key] = { name: key, count: 0, value: 0 };
    acc[key].count += c.quantity;
    acc[key].value += (c.marketPrice ?? 0) * c.quantity;
    return acc;
  }, {} as Record<string, { name: string; count: number; value: number }>))
    .sort((a, b) => b.count - a.count);

  // Por color
  const byColor = Object.values(cards.reduce((acc, c) => {
    const colors = (c as any).colors || [(c as any).color] || [];
    colors.filter(Boolean).forEach((color: string) => {
      if (!acc[color]) acc[color] = { name: color, count: 0, value: 0 };
      acc[color].count += c.quantity;
      acc[color].value += (c.marketPrice ?? 0) * c.quantity;
    });
    return acc;
  }, {} as Record<string, { name: string; count: number; value: number }>))
    .sort((a, b) => b.count - a.count);

  // Top cartas por valor
  const topCards = [...cards].sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0)).slice(0, 5);

  const maxCount = bySets.length > 0 ? bySets[0].count : 1;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-950/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Estadísticas</h1>
          </div>
          <TrendingUp size={20} className="ml-auto text-orange-400" />
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
            { label: 'Sets distintos', value: bySets.length, color: 'text-yellow-400' },
            { label: 'En wishlist', value: wishlist.length, color: 'text-pink-400' },
          ].map(item => (
            <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Top por valor */}
        {topCards.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <Star size={14} className="text-yellow-400" /> Más valiosas
            </p>
            {topCards.map((card, i) => (
              <div key={card.id} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-4">#{i + 1}</span>
                {card.imageUrl && <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-8 h-11 object-cover rounded-lg shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{card.cardName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
                </div>
                <p className="text-xs font-bold text-green-400 shrink-0">{formatPrice(card.marketPrice ?? 0)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Por set */}
        {bySets.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-white">Por set</p>
            {bySets.map(s => (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate max-w-[60%]">{s.name}</span>
                  <span className="text-white font-bold">{s.count} cartas</span>
                </div>
                <div className="w-full bg-white/8 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-red-600 to-orange-500 h-1.5 rounded-full"
                    style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }} />
                </div>
                {s.value > 0 && <p className="text-[10px] text-green-400 text-right">{formatPrice(s.value)}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Por rareza */}
        {byRarity.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-white">Por rareza</p>
            {byRarity.map(r => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{r.name || 'Desconocida'}</span>
                <div className="flex items-center gap-3">
                  {r.value > 0 && <span className="text-green-400">{formatPrice(r.value)}</span>}
                  <span className="text-white font-bold w-8 text-right">{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Por color */}
        {byColor.length > 0 && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-white">Por color</p>
            {byColor.map(c => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span>{COLOR_EMOJI[c.name] ?? '⚪'}</span>
                <span className="text-gray-400 flex-1">{c.name}</span>
                <span className="text-white font-bold">{c.count}</span>
              </div>
            ))}
          </div>
        )}

        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <TrendingUp size={40} className="text-gray-600" />
            <p className="text-white font-bold">Sin datos todavía</p>
            <p className="text-sm text-gray-500">Añade cartas para ver tus estadísticas</p>
          </div>
        )}
      </div>
    </div>
  );
}
