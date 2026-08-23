import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Search, Heart, BarChart2, BookOpen,
  Layers, TrendingUp, Star, ChevronRight, Sparkles,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { useCollectionList } from '@/hooks/use-collection';
import { useWishlistList } from '@/hooks/use-wishlist';
import { useCurrency } from '@/hooks/use-currency';
import { useUserStore } from '@/store';

export function PokemonHomePage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const telegramUser = useUserStore((s) => s.telegramUser);

  const { data: allCards = [], isLoading } = useCollectionList();
  const { data: wishlistItems = [] } = useWishlistList();

  // Solo cartas Pokémon
  const cards = allCards.filter(c => c.tcg === 'pokemon');

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity, 0);
  const totalPaid = cards.reduce((s, c) => s + (c.purchasePrice ?? 0) * c.quantity, 0);
  const roi = totalPaid > 0 ? ((totalValue - totalPaid) / totalPaid) * 100 : null;

  const sets = [...new Set(cards.map(c => c.setName))].length;
  const favorites = cards.filter(c => c.favorite);
  const recentCards = [...cards].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);
  const topCards = [...cards].sort((a, b) => (b.marketPrice ?? b.tcgplayerPrice ?? 0) - (a.marketPrice ?? a.tcgplayerPrice ?? 0)).slice(0, 3);
  const pokemonWishlist = wishlistItems.filter(w => w.tcg === 'pokemon');

  const quickActions = [
    { icon: Camera, label: 'Escanear', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', path: RoutePaths.Scanner },
    { icon: Search, label: 'Explorar', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20', path: RoutePaths.Explorer },
    { icon: Layers, label: 'Colección', color: 'bg-green-500/15 text-green-400 border-green-500/20', path: RoutePaths.Collection },
    { icon: Heart, label: 'Wishlist', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20', path: RoutePaths.Wishlist },
    { icon: BarChart2, label: 'Stats', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20', path: '/stats' },
    { icon: BookOpen, label: 'Pokédex', color: 'bg-red-500/15 text-red-400 border-red-500/20', path: '/pokedex' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(RoutePaths.Home)}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
              <h1 className="text-lg font-bold leading-tight">Pokémon TCG</h1>
            </div>
          </div>
          {/* Pokéball SVG */}
          <svg viewBox="0 0 40 40" className="w-10 h-10 opacity-60" fill="none">
            <circle cx="20" cy="20" r="19" stroke="#ef4444" strokeWidth="2" />
            <path d="M1 20h38" stroke="#ef4444" strokeWidth="2" />
            <circle cx="20" cy="20" r="6" fill="#ef4444" stroke="#ef4444" strokeWidth="2" />
            <circle cx="20" cy="20" r="3" fill="white" />
          </svg>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Stats principales */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Valor total colección</p>
                {roi !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roi >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                    ROI {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white">{formatPrice(totalValue)}</p>
              {totalPaid > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">Invertido: {formatPrice(totalPaid)}</p>
              )}
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-blue-400">{totalCards}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cartas</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-purple-400">{uniqueCards}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Únicas</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-yellow-400">{sets}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sets</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-pink-400">{pokemonWishlist.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Wishlist</p>
            </div>
          </div>
        )}

        {/* Accesos rápidos */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Accesos rápidos</p>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map(({ icon: Icon, label, color, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-2 border rounded-2xl py-4 px-2 active:scale-95 transition-transform ${color}`}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cartas más valiosas */}
        {topCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Más valiosas</p>
              <button onClick={() => navigate(RoutePaths.Collection)} className="text-xs text-blue-400 flex items-center gap-1">
                Ver todas <ChevronRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {topCards.map((card, i) => {
                const price = card.marketPrice ?? card.tcgplayerPrice ?? 0;
                const paid = card.purchasePrice;
                const cardRoi = paid && price ? ((price - paid) / paid) * 100 : null;
                return (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3">
                    <span className="text-xs text-gray-600 font-bold w-4">#{i + 1}</span>
                    <img src={card.imageUrl ?? ''} alt={card.cardName} className="w-10 h-14 object-cover rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{card.cardName}</p>
                      <p className="text-xs text-gray-500 truncate">{card.setName}</p>
                      {cardRoi !== null && (
                        <span className={`text-[10px] font-bold ${cardRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ROI {cardRoi >= 0 ? '+' : ''}{cardRoi.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-green-400 shrink-0">{formatPrice(price)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Favoritas */}
        {favorites.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Star size={12} className="text-yellow-400" /> Favoritas
              </p>
              <button onClick={() => navigate(RoutePaths.Collection)} className="text-xs text-blue-400 flex items-center gap-1">
                Ver todas <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {favorites.slice(0, 8).map(card => (
                <img
                  key={card.id}
                  src={card.imageUrl ?? ''}
                  alt={card.cardName}
                  className="h-24 w-16 object-cover rounded-xl shrink-0 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(RoutePaths.Collection)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Añadidas recientemente */}
        {recentCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Sparkles size={12} className="text-blue-400" /> Recientes
              </p>
              <button onClick={() => navigate(RoutePaths.Collection)} className="text-xs text-blue-400 flex items-center gap-1">
                Ver todas <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentCards.map(card => (
                <div key={card.id} className="shrink-0 w-20">
                  <img
                    src={card.imageUrl ?? ''}
                    alt={card.cardName}
                    className="w-20 h-28 object-cover rounded-xl cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate(RoutePaths.Collection)}
                  />
                  <p className="text-[9px] text-gray-500 truncate mt-1 text-center">{card.cardName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!isLoading && cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-10 h-10 opacity-40" fill="none">
                <circle cx="20" cy="20" r="19" stroke="#ef4444" strokeWidth="2" />
                <path d="M1 20h38" stroke="#ef4444" strokeWidth="2" />
                <circle cx="20" cy="20" r="6" fill="#ef4444" />
                <circle cx="20" cy="20" r="3" fill="white" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold">Sin cartas todavía</p>
              <p className="text-sm text-gray-500 mt-1">Escanea tu primera carta para empezar</p>
            </div>
            <button
              onClick={() => navigate(RoutePaths.Scanner)}
              className="bg-gradient-to-r from-red-600 to-red-500 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Camera size={18} /> Escanear carta
            </button>
          </div>
        )}

        {/* Trending */}
        {totalValue > 0 && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-blue-400" />
              <p className="text-sm font-bold text-white">Tu colección en cifras</p>
            </div>
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Promedio por carta</span>
                <span className="text-white font-medium">{formatPrice(uniqueCards > 0 ? totalValue / uniqueCards : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Carta más cara</span>
                <span className="text-white font-medium">
                  {topCards[0] ? formatPrice(topCards[0].marketPrice ?? topCards[0].tcgplayerPrice ?? 0) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cartas en wishlist</span>
                <span className="text-white font-medium">{pokemonWishlist.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}