import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Search, Heart, BarChart2, Layers, TrendingUp, ChevronRight, Sparkles } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useCollectionList } from '@/hooks/use-collection';
import { useWishlistList } from '@/hooks/use-wishlist';
import { useCurrency } from '@/hooks/use-currency';

export function OnePieceHomePage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: allCards = [] } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();

  const cards = allCards.filter(c => c.tcg === 'onepiece');
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const wishlist = wishlistItems.filter(w => w.tcg === 'onepiece');
  const recentCards = [...cards].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 6);
  const topCards = [...cards].sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0)).slice(0, 3);

  const quickActions = [
    { icon: Search, label: 'Explorar', color: 'bg-red-500/15 text-red-400 border-red-500/20', path: '/onepiece/explorer' },
    { icon: Layers, label: 'Colección', color: 'bg-green-500/15 text-green-400 border-green-500/20', path: RoutePaths.Collection },
    { icon: Heart, label: 'Wishlist', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20', path: RoutePaths.Wishlist },
    { icon: BarChart2, label: 'Stats', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', path: '/stats' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(RoutePaths.Home)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
              <h1 className="text-lg font-bold leading-tight">One Piece TCG</h1>
            </div>
          </div>
          <span className="text-3xl">☠️</span>
        </div>
      </div>

      <div className="px-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 col-span-2">
            <p className="text-xs text-gray-500 mb-1">Valor total colección</p>
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

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Accesos rápidos</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ icon: Icon, label, color, path }) => (
              <button key={label} onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-2 border rounded-2xl py-4 px-2 active:scale-95 transition-transform ${color}`}>
                <Icon size={22} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {topCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Más valiosas</p>
              <button onClick={() => navigate(RoutePaths.Collection)} className="text-xs text-blue-400 flex items-center gap-1">
                Ver todas <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {topCards.map((card, i) => (
                <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-bold w-4">#{i + 1}</span>
                  <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-10 h-14 object-cover rounded-lg shrink-0" />
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

        {recentCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Sparkles size={12} className="text-red-400" /> Recientes
              </p>
              <button onClick={() => navigate(RoutePaths.Collection)} className="text-xs text-blue-400 flex items-center gap-1">
                Ver todas <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentCards.map(card => (
                <div key={card.id} className="shrink-0 w-20">
                  <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''}
                    className="w-20 h-28 object-cover rounded-xl cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate(RoutePaths.Collection)} />
                  <p className="text-[9px] text-gray-500 truncate mt-1 text-center">{card.cardName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-4xl">☠️</span>
            </div>
            <div>
              <p className="text-white font-bold">Sin cartas todavía</p>
              <p className="text-sm text-gray-500 mt-1">Explora el catálogo para añadir cartas</p>
            </div>
            <button onClick={() => navigate('/onepiece/explorer')}
              className="bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
              <Search size={18} /> Explorar cartas
            </button>
          </div>
        )}

        {totalValue > 0 && (
          <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-red-400" />
              <p className="text-sm font-bold text-white">Tu colección en cifras</p>
            </div>
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Únicas</span>
                <span className="text-white font-medium">{uniqueCards}</span>
              </div>
              <div className="flex justify-between">
                <span>Promedio por carta</span>
                <span className="text-white font-medium">{formatPrice(uniqueCards > 0 ? totalValue / uniqueCards : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>En wishlist</span>
                <span className="text-white font-medium">{wishlist.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}