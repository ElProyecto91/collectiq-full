import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Minus, Plus, Trash2, ShoppingBag, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCollectionList, useUpdateCollectionItem, useDeleteCollectionItem } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { RoutePaths } from '@/config';
import type { CollectionItem } from '@/types';

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  Red:    { bg: 'bg-red-500/20',    text: 'text-red-400' },
  Blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  Green:  { bg: 'bg-green-500/20',  text: 'text-green-400' },
  Purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  Black:  { bg: 'bg-gray-500/20',   text: 'text-gray-300' },
  Yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
};

function MarketModal({ card, onClose }: { card: CollectionItem; onClose: () => void }) {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">Vender en Marketplace</p>
          <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
        </div>
        <div className="flex gap-3 bg-white/5 rounded-xl p-3">
          {card.imageUrl && <img src={card.imageUrl} alt={card.cardName ?? ''} className="w-12 h-16 object-cover rounded-lg shrink-0" />}
          <div>
            <p className="text-sm font-bold">{card.cardName}</p>
            <p className="text-xs text-gray-400">{card.setName} · {card.cardNumber}</p>
            {card.marketPrice && <p className="text-sm font-bold text-green-400 mt-1">€{card.marketPrice.toFixed(2)}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { type: 'sell', label: '💚 Vender', color: 'bg-green-500/15 border-green-500/25 text-green-400' },
            { type: 'trade', label: '🔄 Cambiar', color: 'bg-blue-500/15 border-blue-500/25 text-blue-400' },
            { type: 'want', label: '🔍 Buscar', color: 'bg-purple-500/15 border-purple-500/25 text-purple-400' },
          ].map(opt => (
            <button key={opt.type}
              onClick={() => {
                navigate(RoutePaths.Marketplace, {
                  state: {
                    prefill: { listing_type: opt.type, tcg: 'onepiece', item_name: card.cardName || '', set_name: card.setName || '', card_number: card.cardNumber || '', image_url: card.imageUrl || '', price: card.marketPrice ? card.marketPrice.toFixed(2) : '', contact_telegram: telegramUser?.username || '' },
                    tab: 'create',
                  }
                });
                onClose();
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold border active:scale-95 transition-all ${opt.color}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OnePieceCollectionPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: allCards = [] } = useCollectionList();
  const { mutate: updateItem } = useUpdateCollectionItem();
  const { mutate: deleteItem } = useDeleteCollectionItem();

  const [search, setSearch] = useState('');
  const [filterSet, setFilterSet] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [marketCard, setMarketCard] = useState<CollectionItem | null>(null);

  const cards = allCards.filter(c => c.tcg === 'onepiece');
  const filtered = cards.filter(c =>
    (!search || (c.cardName ?? '').toLowerCase().includes(search.toLowerCase())) &&
    (!filterSet || c.setName === filterSet) &&
    (!filterRarity || c.rarity === filterRarity) &&
    (!filterColor || (c as any).color === filterColor)
  );

  const sets = [...new Set(cards.map(c => c.setName ?? '').filter(Boolean))].sort();
  const rarities = [...new Set(cards.map(c => c.rarity ?? '').filter(Boolean))].sort();
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const activeFilters = [filterSet, filterRarity, filterColor].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {marketCard && <MarketModal card={marketCard} onClose={() => setMarketCard(null)} />}

      {/* Header */}
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/25 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Mi Colección</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-red-400">{totalCards}</p>
            <p className="text-[10px] text-gray-500">Cartas</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-purple-400">{cards.length}</p>
            <p className="text-[10px] text-gray-500">Únicas</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-green-400">{formatPrice(totalValue)}</p>
            <p className="text-[10px] text-gray-500">Valor</p>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en tu colección..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`relative w-12 rounded-2xl border flex items-center justify-center ${showFilters || activeFilters > 0 ? 'bg-red-600/20 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
            <SlidersHorizontal size={16} />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilters}</span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">Filtros</p>
              {activeFilters > 0 && (
                <button onClick={() => { setFilterSet(''); setFilterRarity(''); setFilterColor(''); }}
                  className="text-xs text-red-400 flex items-center gap-1"><X size={11} />Limpiar</button>
              )}
            </div>
            {sets.length > 1 && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Set</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button onClick={() => setFilterSet('')} className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] border ${!filterSet ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'}`}>Todos</button>
                  {sets.map(s => <button key={s} onClick={() => setFilterSet(filterSet === s ? '' : s)} className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] border truncate max-w-[100px] ${filterSet === s ? 'bg-red-600 text-white border-red-600' : 'bg-white/5 border-white/10 text-gray-400'}`}>{s}</button>)}
                </div>
              </div>
            )}
            {rarities.length > 1 && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Rareza</p>
                <div className="flex gap-1.5 flex-wrap">
                  {rarities.map(r => <button key={r} onClick={() => setFilterRarity(filterRarity === r ? '' : r)} className={`px-2.5 py-1 rounded-full text-[10px] border ${filterRarity === r ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 border-white/10 text-gray-400'}`}>{r}</button>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="text-5xl">☠️</div>
            <p className="text-white font-bold">Sin cartas todavía</p>
            <p className="text-sm text-gray-500">Explora el catálogo para añadir cartas</p>
            <button onClick={() => navigate('/onepiece/explorer')}
              className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">
              Explorar cartas
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">Sin resultados con estos filtros</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(card => (
              <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                <div className="relative">
                  <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''}
                    className="w-full aspect-[3/4] object-cover" loading="lazy" />
                  <button onClick={() => updateItem({ id: card.id, update: { favorite: !card.favorite } })}
                    className="absolute right-1.5 top-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                    <Heart size={13} className={card.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
                  </button>
                </div>
                <div className="p-2.5 space-y-1.5">
                  <p className="text-xs font-bold truncate">{card.cardName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{card.setName}</p>
                  {card.marketPrice != null && <p className="text-[10px] text-green-400 font-medium">{formatPrice(card.marketPrice)}</p>}
                </div>
                <div className="flex items-center justify-between px-2.5 pb-2.5">
                  <div className="flex items-center gap-1">
                    <button onClick={() => card.quantity > 1 && updateItem({ id: card.id, update: { quantity: card.quantity - 1 } })} disabled={card.quantity <= 1}
                      className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-40">
                      <Minus size={11} />
                    </button>
                    <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">{card.quantity}</span>
                    <button onClick={() => updateItem({ id: card.id, update: { quantity: card.quantity + 1 } })}
                      className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                      <Plus size={11} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setMarketCard(card)}
                      className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-green-400">
                      <ShoppingBag size={11} />
                    </button>
                    <button onClick={() => deleteItem(card.id)}
                      className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-gray-500">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
