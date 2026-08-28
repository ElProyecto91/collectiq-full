import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Heart, Minus, Plus, Trash2, ShoppingBag,
  Search, SlidersHorizontal, X, Layers, Package, CheckCircle2,
  AlertCircle, Loader2
} from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useWishlist } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';
import { useCurrency } from '@/hooks/use-currency';
import { RoutePaths } from '@/config';
import type { CollectionItem } from '@/types';

const API = 'https://collectiq-api.esxdinero.workers.dev';

interface SetCompletion {
  setId: string;
  setName: string;
  owned: number;
  total: number;
  cards: CollectionItem[];
  totalValue: number;
  allSetCards?: any[];
  missingCards?: any[];
}

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
            <p className="text-xs text-gray-400">{card.setName}</p>
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
                navigate(RoutePaths.Marketplace, { state: { prefill: { listing_type: opt.type, tcg: 'onepiece', item_name: card.cardName || '', set_name: card.setName || '', card_number: card.cardNumber || '', image_url: card.imageUrl || '', price: card.marketPrice ? card.marketPrice.toFixed(2) : '', contact_telegram: telegramUser?.username || '' }, tab: 'create' } });
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

function SetCompletionPanel({ group, onAddToWishlist }: { group: SetCompletion; onAddToWishlist: (cards: any[]) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loadingMissing, setLoadingMissing] = useState(false);
  const [missingCards, setMissingCards] = useState<any[]>([]);
  const { formatPrice } = useCurrency();
  const pct = group.total > 0 ? Math.round((group.owned / group.total) * 100) : 0;
  const missing = group.total - group.cards.length;

  const loadMissingCards = async () => {
    if (missingCards.length > 0 || group.total === 0) return;
    setLoadingMissing(true);
    try {
      // Cargar todas las cartas del set
      const r = await fetch(`${API}/onepiece-cards?set=${encodeURIComponent(group.setId)}&page=1`);
      const d = await r.json();
      const allCards = d.cards || [];
      const ownedIds = new Set(group.cards.map(c => c.cardId ?? ''));
      const missing = allCards.filter((c: any) => !ownedIds.has(c.id));
      setMissingCards(missing);
    } catch {}
    setLoadingMissing(false);
  };

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
      <button onClick={() => { setExpanded(!expanded); if (!expanded) loadMissingCards(); }}
        className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{group.setName || group.setId}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {group.cards.length}{group.total > 0 ? `/${group.total}` : ''} únicas · {group.owned} total
            </p>
          </div>
          <div className="text-right shrink-0">
            {pct === 100 && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium block mb-1">✓ Completo</span>}
            {group.totalValue > 0 && <p className="text-xs text-green-400 font-bold">{formatPrice(group.totalValue)}</p>}
          </div>
        </div>
        {group.total > 0 && (
          <div className="w-full bg-white/8 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-red-600 to-orange-500'}`}
              style={{ width: `${pct}%` }} />
          </div>
        )}
        {/* Preview de cartas */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {group.cards.slice(0, 6).map(c => (
            <img key={c.id} src={c.imageUrl ?? ''} alt={c.cardName ?? ''} className="h-12 w-8 object-cover rounded-lg shrink-0" />
          ))}
          {group.cards.length > 6 && (
            <div className="h-12 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <span className="text-[9px] text-gray-400">+{group.cards.length - 6}</span>
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/8 p-4 space-y-3">
          {/* Cartas que tengo */}
          <p className="text-xs font-bold text-green-400 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> Tienes ({group.cards.length})
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {group.cards.map(c => (
              <div key={c.id} className="relative">
                <img src={c.imageUrl ?? ''} alt={c.cardName ?? ''} className="w-full aspect-[3/4] object-cover rounded-lg" />
                {c.quantity > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] font-bold px-1 rounded">x{c.quantity}</span>
                )}
              </div>
            ))}
          </div>

          {/* Cartas que faltan */}
          {group.total > 0 && missing > 0 && (
            <>
              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5 mt-2">
                <AlertCircle size={12} /> Faltan ({missing})
              </p>
              {loadingMissing ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-500" /></div>
              ) : missingCards.length > 0 ? (
                <>
                  <div className="grid grid-cols-4 gap-1.5">
                    {missingCards.slice(0, 16).map((c: any) => (
                      <div key={c.id} className="relative opacity-50">
                        <img src={c.image_url} alt={c.name} className="w-full aspect-[3/4] object-cover rounded-lg grayscale" />
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                          <X size={12} className="text-red-400" />
                        </div>
                      </div>
                    ))}
                    {missingCards.length > 16 && (
                      <div className="h-full aspect-[3/4] rounded-lg bg-white/5 flex items-center justify-center">
                        <span className="text-[9px] text-gray-400 text-center">+{missingCards.length - 16}<br/>más</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onAddToWishlist(missingCards)}
                    className="w-full py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95">
                    <Heart size={12} /> Añadir {missingCards.length} a Wishlist
                  </button>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">Cargando cartas que faltan...</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function OnePieceCollectionPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { items: cards, updateItem, removeItem } = useCollection('onepiece');
  const { addItem: addToWishlist } = useWishlist('onepiece');

  const [view, setView] = useState<'cards' | 'sets'>('cards');
  const [search, setSearch] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [marketCard, setMarketCard] = useState<CollectionItem | null>(null);

  const filtered = cards.filter(c =>
    (!search || (c.cardName ?? '').toLowerCase().includes(search.toLowerCase())) &&
    (!filterRarity || c.rarity === filterRarity)
  );

  const rarities = [...new Set(cards.map(c => c.rarity ?? '').filter(Boolean))].sort();
  const totalValue = cards.reduce((s, c) => s + (c.marketPrice ?? 0) * c.quantity, 0);
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const activeFilters = [filterRarity].filter(Boolean).length;

  // Agrupar por set
  const setGroups: SetCompletion[] = Object.values(
    cards.reduce((acc, c) => {
      const key = c.cardNumber?.split('-')[0] || c.setName || 'Sin set';
      if (!acc[key]) acc[key] = { setId: key, setName: c.setName || key, owned: 0, total: 0, cards: [], totalValue: 0 };
      acc[key].owned += c.quantity;
      acc[key].cards.push(c);
      acc[key].totalValue += (c.marketPrice ?? 0) * c.quantity;
      return acc;
    }, {} as Record<string, SetCompletion>)
  ).sort((a, b) => b.owned - a.owned);

  const handleAddMissingToWishlist = async (missingCards: any[]) => {
    for (const card of missingCards.slice(0, 50)) {
      try {
        await addToWishlist({
          tcg: 'onepiece',
          card_id: card.id,
          card_name: card.name,
          set_name: card.set_name,
          card_number: card.number,
          rarity: card.rarity,
          image_url: card.image_url,
        } as any);
      } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {marketCard && <MarketModal card={marketCard} onClose={() => setMarketCard(null)} />}

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

        {/* Vista tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          <button onClick={() => setView('cards')} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${view === 'cards' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>
            <Layers size={12} /> Cartas
          </button>
          <button onClick={() => setView('sets')} className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${view === 'sets' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>
            <Package size={12} /> Sets ({setGroups.length})
          </button>
        </div>

        {/* Vista Sets */}
        {view === 'sets' && (
          <div className="space-y-3">
            {setGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="text-5xl">☠️</div>
                <p className="text-white font-bold">Sin cartas todavía</p>
                <button onClick={() => navigate('/onepiece/explorer')} className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">Explorar cartas</button>
              </div>
            ) : setGroups.map(group => (
              <SetCompletionPanel key={group.setId} group={group} onAddToWishlist={handleAddMissingToWishlist} />
            ))}
          </div>
        )}

        {/* Vista Cartas */}
        {view === 'cards' && (
          <>
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
                {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilters}</span>}
              </button>
            </div>

            {showFilters && rarities.length > 0 && (
              <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Rareza</p>
                  {filterRarity && <button onClick={() => setFilterRarity('')} className="text-xs text-red-400 flex items-center gap-1"><X size={11} />Limpiar</button>}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {rarities.map(r => (
                    <button key={r} onClick={() => setFilterRarity(filterRarity === r ? '' : r)}
                      className={`px-2.5 py-1 rounded-full text-[10px] border ${filterRarity === r ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {cards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="text-5xl">☠️</div>
                <p className="text-white font-bold">Sin cartas todavía</p>
                <button onClick={() => navigate('/onepiece/explorer')} className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">Explorar cartas</button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">Sin resultados</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map(card => (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="relative">
                      <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-full aspect-[3/4] object-cover" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x280/111118/666?text=OP'; }} />
                      <button onClick={() => updateItem(card.id, { favorite: !card.favorite })}
                        className="absolute right-1.5 top-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                        <Heart size={13} className={card.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
                      </button>
                    </div>
                    <div className="p-2.5 space-y-1">
                      <p className="text-xs font-bold truncate">{card.cardName}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.cardNumber}</p>
                      {card.rarity && <p className="text-[10px] text-yellow-400">{card.rarity}</p>}
                      {card.marketPrice != null && <p className="text-[10px] text-green-400 font-medium">{formatPrice(card.marketPrice)}</p>}
                    </div>
                    <div className="flex items-center justify-between px-2.5 pb-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => card.quantity > 1 && updateItem(card.id, { quantity: card.quantity - 1 })} disabled={card.quantity <= 1}
                          className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center disabled:opacity-40">
                          <Minus size={11} className="text-gray-400" />
                        </button>
                        <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">{card.quantity}</span>
                        <button onClick={() => updateItem(card.id, { quantity: card.quantity + 1 })}
                          className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                          <Plus size={11} className="text-gray-400" />
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setMarketCard(card)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-green-400">
                          <ShoppingBag size={11} />
                        </button>
                        <button onClick={() => removeItem(card.id)} className="w-6 h-6 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-gray-500">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
