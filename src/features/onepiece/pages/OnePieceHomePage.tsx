import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Heart, BarChart2, Layers, ChevronRight, Sparkles, ShoppingBag, Swords, ScanLine } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useCollectionList } from '@/hooks/use-collection';
import { useWishlistList } from '@/hooks/use-wishlist';
import { useCurrency } from '@/hooks/use-currency';

export function OnePieceHomePage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: allCards = [] } = useCollectionList();
  const { data: allWishlist = [] } = useWishlistList();

  const cards = allCards.filter(c => c.tcg === 'onepiece');
  const wishlist = allWishlist.filter(w => w.tcg === 'onepiece');
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const recentCards = [...cards]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 6);
  const topCards = [...cards].sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0)).slice(0, 3);

  const quickActions = [
    { icon: Search,    label: 'Explorador',   color: 'bg-red-500/15 text-red-400 border-red-500/20',     path: '/onepiece/explorer' },
    { icon: Layers,    label: 'Colección',    color: 'bg-green-500/15 text-green-400 border-green-500/20', path: '/onepiece/collection' },
    { icon: Heart,     label: 'Wishlist',     color: 'bg-pink-500/15 text-pink-400 border-pink-500/20',   path: '/onepiece/wishlist' },
    { icon: BarChart2, label: 'Stats',        color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', path: '/onepiece/stats' },
    { icon: Swords,    label: 'Deck Builder', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',   path: '/onepiece/deck-builder' },
    { icon: ScanLine,  label: 'Escáner',      color: 'bg-purple-500/15 text-purple-400 border-purple-500/20', path: '/onepiece/scanner' },
    { icon: ShoppingBag, label: 'Marketplace', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', path: RoutePaths.Marketplace },
  ];

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(180deg, #1a0505 0%, #0a0a0f 20%)' }}>
      {/* Header */}
      <div className="relative px-4 pt-6 pb-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-red-950/50 to-transparent" />
          <div className="absolute top-2 right-4 text-6xl opacity-10 select-none">☠️</div>
          <div className="absolute top-8 left-8 text-4xl opacity-5 select-none">⚓</div>
        </div>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(RoutePaths.Home)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
              <svg viewBox="0 0 220 50" xmlns="http://www.w3.org/2000/svg" className="w-36 h-8">
                <text x="2" y="30" fontFamily="Arial Black, Impact, sans-serif" fontSize="26" fontWeight="900"
                  fill="#D4AF37" stroke="#1a0a00" strokeWidth="2" paintOrder="stroke">ONE PIECE</text>
                <text x="2" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="14" fontWeight="700"
                  fill="#D4AF37" stroke="#1a0a00" strokeWidth="1" paintOrder="stroke">CARD GAME</text>
              </svg>
            </div>
          </div>
          <span className="text-4xl">☠️</span>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-red-900/30 to-orange-900/20 border border-red-800/30 rounded-2xl p-4 col-span-2">
            <p className="text-xs text-red-300/60 mb-1">Valor total colección</p>
            <p className="text-2xl font-bold text-white">{formatPrice(totalValue)}</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-red-400">{totalCards}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cartas</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-pink-400">{wishlist.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Wishlist</p>
          </div>
        </div>

        {/* Acciones rápidas — 4 columnas para 7 botones */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Accesos rápidos</p>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(({ icon: Icon, label, color, path }) => (
              <button key={label} onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-2 border rounded-2xl py-3 px-1 active:scale-95 transition-transform ${color}`}>
                <Icon size={18} />
                <span className="text-[9px] font-semibold text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top valiosas */}
        {topCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Más valiosas</p>
              <button onClick={() => navigate('/onepiece/stats')} className="text-xs text-red-400 flex items-center gap-1">
                Ver stats <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {topCards.map((card, i) => (
                <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-bold w-4">#{i + 1}</span>
                  {card.imageUrl && <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-9 object-cover rounded-lg shrink-0" style={{ height: '3.25rem' }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{card.cardName}</p>
                    <p className="text-xs text-gray-500 truncate">{card.setName}</p>
                  </div>
                  <p className="text-sm font-bold text-green-400 shrink-0">{formatPrice(card.marketPrice ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recientes */}
        {recentCards.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5 mb-3">
              <Sparkles size={12} className="text-red-400" /> Recientes
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentCards.map(card => (
                <div key={card.id} className="shrink-0 w-20">
                  {card.imageUrl && <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-20 h-28 object-cover rounded-xl" loading="lazy" />}
                  <p className="text-[9px] text-gray-500 truncate mt-1 text-center">{card.cardName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-4xl">☠️</span>
            </div>
            <div>
              <p className="text-white font-bold text-lg">Sin cartas todavía</p>
              <p className="text-sm text-gray-500 mt-1">Explora el catálogo y añade cartas a tu tripulación</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/onepiece/explorer')}
                className="bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl px-5 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
                <Search size={16} /> Explorar
              </button>
              <button onClick={() => navigate('/onepiece/scanner')}
                className="bg-purple-600/20 border border-purple-500/30 text-purple-400 rounded-2xl px-5 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
                <ScanLine size={16} /> Escanear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}