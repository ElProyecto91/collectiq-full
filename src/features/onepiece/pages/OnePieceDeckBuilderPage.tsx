import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Trash2, Search, BarChart2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCollectionList } from '@/hooks/use-collection';
import { useCurrency } from '@/hooks/use-currency';

const API = 'https://collectiq-api.esxdinero.workers.dev';
const DECK_SIZE = 50; // One Piece deck: 1 líder + 50 cartas

interface DeckCard {
  id: string;
  name: string;
  number: string;
  type: string;
  color: string[];
  power?: number | null;
  cost?: number | null;
  image_url: string;
  set_name: string;
  rarity: string;
  quantity: number;
  owned: number;
}

const COLOR_LABEL: Record<string, string> = {
  Red: '🔴', Blue: '🔵', Green: '🟢', Purple: '🟣', Black: '⚫', Yellow: '🟡',
};

export function OnePieceDeckBuilderPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: collection = [] } = useCollectionList();

  const [leader, setLeader] = useState<DeckCard | null>(null);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deckName, setDeckName] = useState('Mi mazo');
  const [view, setView] = useState<'build' | 'stats' | 'list'>('build');
  const [showLeaderSearch, setShowLeaderSearch] = useState(false);

  const opCollection = collection.filter(c => c.tcg === 'onepiece');
  const ownedMap = new Map(opCollection.map(c => [c.cardId ?? '', c.quantity]));

  const deckTotal = deck.reduce((s, c) => s + c.quantity, 0);
  const remaining = DECK_SIZE - deckTotal;

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const r = await fetch(`${API}/onepiece-cards?q=${encodeURIComponent(q)}&page=1`);
      const d = await r.json();
      setSearchResults(d.cards || []);
    } catch { setSearchResults([]); }
    finally { setIsSearching(false); }
  }, []);

  const addCard = (card: any, asLeader = false) => {
    const owned = ownedMap.get(card.id) ?? 0;
    const deckCard: DeckCard = {
      id: card.id, name: card.name, number: card.number,
      type: card.type, color: card.color || [], power: card.power,
      cost: card.cost, image_url: card.image_url, set_name: card.set_name,
      rarity: card.rarity, quantity: 1, owned,
    };
    if (asLeader) { setLeader(deckCard); setShowLeaderSearch(false); return; }
    if (deckTotal >= DECK_SIZE) return;
    setDeck(prev => {
      const existing = prev.find(c => c.id === card.id);
      if (existing) {
        if (existing.quantity >= 4) return prev; // máx 4 copias
        return prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, deckCard];
    });
  };

  const removeCard = (id: string, all = false) => {
    setDeck(prev => {
      const existing = prev.find(c => c.id === id);
      if (!existing) return prev;
      if (all || existing.quantity <= 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  // Stats del mazo
  const colorDist = deck.reduce((acc, c) => {
    (c.color || []).forEach(col => { acc[col] = (acc[col] || 0) + c.quantity; });
    return acc;
  }, {} as Record<string, number>);

  const costCurve = deck.reduce((acc, c) => {
    const cost = c.cost ?? 0;
    acc[cost] = (acc[cost] || 0) + c.quantity;
    return acc;
  }, {} as Record<number, number>);

  const maxCostCount = Math.max(...Object.values(costCurve), 1);
  const ownedInDeck = deck.filter(c => c.owned > 0).reduce((s, c) => s + Math.min(c.quantity, c.owned), 0);
  const missingCount = deck.reduce((s, c) => s + Math.max(0, c.quantity - c.owned), 0);

  const saveDeck = () => {
    const data = { name: deckName, leader, cards: deck, total: deckTotal, createdAt: new Date().toISOString() };
    const saved = JSON.parse(localStorage.getItem('op_decks') || '[]');
    saved.push(data);
    localStorage.setItem('op_decks', JSON.stringify(saved));
    alert(`Mazo "${deckName}" guardado.`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <input value={deckName} onChange={e => setDeckName(e.target.value)}
            className="flex-1 text-lg font-bold bg-transparent outline-none text-white placeholder-gray-500"
            placeholder="Nombre del mazo..." />
          <button onClick={saveDeck}
            className="w-9 h-9 rounded-xl bg-green-600/20 border border-green-500/30 flex items-center justify-center text-green-400">
            <Save size={16} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1">
          {[
            { key: 'build', label: 'Construir' },
            { key: 'stats', label: 'Estadísticas' },
            { key: 'list', label: 'Lista' },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === t.key ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contador */}
      <div className="px-4 mb-3">
        <div className={`rounded-2xl p-3 flex items-center justify-between border ${deckTotal >= DECK_SIZE ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/8'}`}>
          <p className="text-xs text-gray-400">Cartas en el mazo</p>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${deckTotal >= DECK_SIZE ? 'text-green-400' : 'text-white'}`}>{deckTotal}</span>
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{DECK_SIZE}</span>
            {deckTotal >= DECK_SIZE && <span className="text-green-400 text-xs">✓ Completo</span>}
          </div>
        </div>
      </div>

      {/* VIEW: BUILD */}
      {view === 'build' && (
        <div className="px-4 space-y-4">
          {/* Líder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">👑 Líder</p>
              <button onClick={() => setShowLeaderSearch(!showLeaderSearch)}
                className="text-xs text-blue-400 flex items-center gap-1">
                {showLeaderSearch ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {leader ? 'Cambiar' : 'Seleccionar'}
              </button>
            </div>

            {leader ? (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3">
                <img src={leader.image_url} alt={leader.name} className="w-12 h-16 object-cover rounded-xl shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold">{leader.name}</p>
                  <p className="text-xs text-gray-400">{leader.set_name}</p>
                  <div className="flex gap-1 mt-1">
                    {leader.color.map(c => <span key={c}>{COLOR_LABEL[c] ?? '⚪'}</span>)}
                  </div>
                </div>
                <button onClick={() => setLeader(null)} className="text-gray-500"><X size={16} /></button>
              </div>
            ) : (
              <div className="border border-dashed border-yellow-500/30 rounded-2xl p-4 text-center">
                <p className="text-yellow-400/60 text-sm">Sin líder seleccionado</p>
              </div>
            )}

            {showLeaderSearch && (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={search} onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
                    placeholder="Buscar líder..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
                </div>
                {isSearching && <p className="text-xs text-gray-500 text-center">Buscando...</p>}
                {searchResults.filter(c => c.type === 'Leader' || c.rarity === 'Leader').slice(0, 8).map(card => (
                  <div key={card.id} className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl p-2">
                    <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500">{card.set_name}</p>
                    </div>
                    <button onClick={() => addCard(card, true)}
                      className="px-3 py-1.5 rounded-xl bg-yellow-500 text-black text-xs font-bold active:scale-95">
                      Líder
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Búsqueda de cartas */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">Añadir cartas</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
                placeholder="Buscar carta para añadir..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none" />
            </div>
            {isSearching && <p className="text-xs text-gray-500 text-center mt-2">Buscando...</p>}
            {searchResults.filter(c => c.type !== 'Leader' && c.rarity !== 'Leader').slice(0, 10).map(card => {
              const inDeck = deck.find(c => c.id === card.id);
              const owned = ownedMap.get(card.id) ?? 0;
              return (
                <div key={card.id} className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl p-2 mt-2">
                  <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{card.name}</p>
                    <p className="text-[10px] text-gray-500">{card.number}</p>
                    {owned > 0 && <p className="text-[10px] text-green-400">Tienes: {owned}</p>}
                    {owned === 0 && <p className="text-[10px] text-red-400">No tienes</p>}
                  </div>
                  {inDeck && (
                    <span className="text-xs text-blue-400 font-bold">x{inDeck.quantity}</span>
                  )}
                  <button onClick={() => addCard(card)}
                    disabled={deckTotal >= DECK_SIZE || (inDeck?.quantity ?? 0) >= 4}
                    className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-40">
                    <Plus size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Cartas de mi colección */}
          {search === '' && opCollection.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-400">De tu colección</p>
              <div className="space-y-2">
                {opCollection.slice(0, 10).map(card => {
                  const inDeck = deck.find(c => c.id === (card.cardId ?? ''));
                  return (
                    <div key={card.id} className="flex items-center gap-2 bg-[#111118] border border-white/8 rounded-xl p-2">
                      <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-8 h-11 object-cover rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{card.cardName}</p>
                        <p className="text-[10px] text-green-400">Tienes: {card.quantity}</p>
                      </div>
                      {inDeck && <span className="text-xs text-blue-400 font-bold">x{inDeck.quantity}</span>}
                      <button onClick={() => addCard({ id: card.cardId, name: card.cardName, number: card.cardNumber, type: '', color: [], image_url: card.imageUrl, set_name: card.setName, rarity: card.rarity }, false)}
                        disabled={deckTotal >= DECK_SIZE || (inDeck?.quantity ?? 0) >= 4}
                        className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-40">
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: STATS */}
      {view === 'stats' && (
        <div className="px-4 space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-blue-400">{deckTotal}</p>
              <p className="text-[10px] text-gray-500">Cartas</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-green-400">{ownedInDeck}</p>
              <p className="text-[10px] text-gray-500">Tienes</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-red-400">{missingCount}</p>
              <p className="text-[10px] text-gray-500">Faltan</p>
            </div>
          </div>

          {/* Distribución de colores */}
          {Object.keys(colorDist).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold">Distribución de colores</p>
              {Object.entries(colorDist).sort(([,a],[,b]) => b - a).map(([color, count]) => (
                <div key={color} className="flex items-center gap-2 text-xs">
                  <span className="w-4">{COLOR_LABEL[color] ?? '⚪'}</span>
                  <span className="text-gray-400 w-16">{color}</span>
                  <div className="flex-1 bg-white/8 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.round((count / deckTotal) * 100)}%` }} />
                  </div>
                  <span className="text-white font-bold w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Curva de coste */}
          {Object.keys(costCurve).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold">Curva de coste</p>
              <div className="flex items-end gap-1 h-20">
                {Object.entries(costCurve).sort(([a],[b]) => Number(a) - Number(b)).map(([cost, count]) => (
                  <div key={cost} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-white font-bold">{count}</span>
                    <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm"
                      style={{ height: `${Math.round((count / maxCostCount) * 60)}px` }} />
                    <span className="text-[9px] text-gray-500">{cost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cartas que faltan */}
          {missingCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-400">Cartas que te faltan ({missingCount})</p>
              {deck.filter(c => c.quantity > c.owned).map(c => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate max-w-[60%]">{c.name}</span>
                  <span className="text-red-400 font-bold">Necesitas {c.quantity - c.owned} más</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: LIST */}
      {view === 'list' && (
        <div className="px-4 space-y-2">
          {leader && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-3">
              <img src={leader.image_url} alt={leader.name} className="w-10 h-14 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="text-[10px] text-yellow-400 font-bold">LÍDER</p>
                <p className="text-sm font-bold">{leader.name}</p>
              </div>
            </div>
          )}
          {deck.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">El mazo está vacío</p>
          ) : (
            deck.map(card => (
              <div key={card.id} className="flex items-center gap-2 bg-[#111118] border border-white/8 rounded-xl p-2">
                <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{card.name}</p>
                  <p className="text-[10px] text-gray-500">{card.number}</p>
                  {card.owned < card.quantity && (
                    <p className="text-[10px] text-red-400">Faltan {card.quantity - card.owned}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => removeCard(card.id)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Minus size={11} className="text-gray-400" />
                  </button>
                  <span className="text-sm font-bold text-white w-5 text-center">x{card.quantity}</span>
                  <button onClick={() => addCard(card)} disabled={card.quantity >= 4 || deckTotal >= DECK_SIZE}
                    className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center disabled:opacity-40">
                    <Plus size={11} className="text-gray-400" />
                  </button>
                  <button onClick={() => removeCard(card.id, true)} className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center ml-1">
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
