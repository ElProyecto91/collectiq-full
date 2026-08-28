import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Minus, Trash2, Search, Save, X,
  ChevronDown, ChevronUp, Shuffle, AlertTriangle, CheckCircle2,
  Eye, Loader2
} from 'lucide-react';
import { useCollection } from '@/hooks/use-collection';
import { useCurrency } from '@/hooks/use-currency';

const API = 'https://collectiq-api.esxdinero.workers.dev';
const DECK_SIZE = 50;
const MAX_COPIES = 4;

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

const COLOR_LABEL: Record<string, { emoji: string; bg: string; text: string }> = {
  Red:    { emoji: '🔴', bg: 'bg-red-500/20',    text: 'text-red-400' },
  Blue:   { emoji: '🔵', bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  Green:  { emoji: '🟢', bg: 'bg-green-500/20',  text: 'text-green-400' },
  Purple: { emoji: '🟣', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  Black:  { emoji: '⚫', bg: 'bg-gray-500/20',   text: 'text-gray-300' },
  Yellow: { emoji: '🟡', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
};

// Reglas del juego One Piece TCG
function validateDeck(leader: DeckCard | null, deck: DeckCard[]): string[] {
  const errors: string[] = [];
  const total = deck.reduce((s, c) => s + c.quantity, 0);

  if (!leader) errors.push('❌ Falta el líder (obligatorio)');
  if (total < DECK_SIZE) errors.push(`❌ El mazo tiene ${total}/50 cartas`);
  if (total > DECK_SIZE) errors.push(`❌ El mazo tiene ${total}/50 cartas (demasiadas)`);

  // Máx 4 copias
  const over4 = deck.filter(c => c.quantity > MAX_COPIES);
  over4.forEach(c => errors.push(`❌ ${c.name}: máximo 4 copias (tienes ${c.quantity})`));

  // Colores del líder deben coincidir con el mazo
  if (leader) {
    const leaderColors = new Set(leader.color || []);
    const deckColors = new Set(deck.flatMap(c => c.color || []));
    const invalidColors = [...deckColors].filter(col => !leaderColors.has(col));
    if (invalidColors.length > 0) {
      errors.push(`⚠️ Colores no compatibles con el líder: ${invalidColors.join(', ')}`);
    }
  }

  return errors;
}

// Simulador de robo de cartas
function simulateDraw(leader: DeckCard | null, deck: DeckCard[], handSize: number = 5): DeckCard[] {
  // Crear pool de cartas expandido por cantidad
  const pool: DeckCard[] = [];
  deck.forEach(card => {
    for (let i = 0; i < card.quantity; i++) {
      pool.push(card);
    }
  });

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, handSize);
}

export function OnePieceDeckBuilderPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { items: collection } = useCollection('onepiece');

  const [leader, setLeader] = useState<DeckCard | null>(null);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deckName, setDeckName] = useState('Mi mazo');
  const [view, setView] = useState<'build' | 'validate' | 'simulate' | 'list'>('build');
  const [showLeaderSearch, setShowLeaderSearch] = useState(false);
  const [savedDecks, setSavedDecks] = useState<any[]>([]);
  const [simulatedHand, setSimulatedHand] = useState<DeckCard[]>([]);
  const [simCount, setSimCount] = useState(0);

  const ownedMap = new Map(collection.map(c => [c.cardId ?? '', c.quantity]));
  const deckTotal = deck.reduce((s, c) => s + c.quantity, 0);
  const errors = validateDeck(leader, deck);
  const isValid = errors.length === 0;

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('op_decks') || '[]');
    setSavedDecks(saved);
  }, []);

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

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 400);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  const addCard = (card: any, asLeader = false) => {
    const owned = ownedMap.get(card.id) ?? 0;
    const deckCard: DeckCard = {
      id: card.id, name: card.name || card.card_name || '',
      number: card.number || card.card_id || '',
      type: card.type || '', color: card.color || [],
      power: card.power, cost: card.cost,
      image_url: card.image_url || card.imageUrl || '',
      set_name: card.set_name || card.setName || '',
      rarity: card.rarity || '', quantity: 1, owned,
    };
    if (asLeader) { setLeader(deckCard); setShowLeaderSearch(false); setSearch(''); return; }
    if (deckTotal >= DECK_SIZE) return;
    setDeck(prev => {
      const existing = prev.find(c => c.id === card.id);
      if (existing) {
        if (existing.quantity >= MAX_COPIES) return prev;
        return prev.map(c => c.id === card.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, deckCard];
    });
  };

  const removeCard = (id: string, delta = 1) => {
    setDeck(prev => {
      const card = prev.find(c => c.id === id);
      if (!card) return prev;
      if (delta >= card.quantity) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, quantity: c.quantity - delta } : c);
    });
  };

  const saveDeck = () => {
    const data = { id: Date.now(), name: deckName, leader, cards: deck, total: deckTotal, savedAt: new Date().toISOString() };
    const saved = JSON.parse(localStorage.getItem('op_decks') || '[]');
    saved.push(data);
    localStorage.setItem('op_decks', JSON.stringify(saved));
    setSavedDecks(saved);
    alert(`✅ Mazo "${deckName}" guardado`);
  };

  const loadDeck = (saved: any) => {
    setLeader(saved.leader);
    setDeck(saved.cards || []);
    setDeckName(saved.name);
  };

  const deleteSavedDeck = (id: number) => {
    const updated = savedDecks.filter(d => d.id !== id);
    localStorage.setItem('op_decks', JSON.stringify(updated));
    setSavedDecks(updated);
  };

  const simulate = () => {
    const hand = simulateDraw(leader, deck, 5);
    setSimulatedHand(hand);
    setSimCount(c => c + 1);
  };

  // Stats
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
  const ownedInDeck = deck.reduce((s, c) => s + Math.min(c.quantity, c.owned), 0);
  const missingCount = deck.reduce((s, c) => s + Math.max(0, c.quantity - c.owned), 0);

  const tabs = [
    { key: 'build', label: '🔧 Construir' },
    { key: 'validate', label: `${isValid ? '✅' : '⚠️'} Validar` },
    { key: 'simulate', label: '🎴 Simular' },
    { key: 'list', label: '📋 Lista' },
  ];

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

        {/* Contador */}
        <div className={`mt-3 rounded-2xl px-4 py-2.5 flex items-center justify-between border ${deckTotal >= DECK_SIZE && leader ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/8'}`}>
          <p className="text-xs text-gray-400">
            {leader ? `👑 ${leader.name}` : '⚠️ Sin líder'}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${deckTotal >= DECK_SIZE ? 'text-green-400' : 'text-white'}`}>{deckTotal}</span>
            <span className="text-gray-500 text-sm">/50</span>
            {deckTotal >= DECK_SIZE && leader && <CheckCircle2 size={14} className="text-green-400" />}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 bg-white/5 rounded-xl p-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${view === t.key ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BUILD */}
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
                    {(leader.color || []).map(c => <span key={c}>{COLOR_LABEL[c]?.emoji ?? '⚪'}</span>)}
                  </div>
                  {leader.power && <p className="text-[10px] text-orange-400">Poder: {leader.power}</p>}
                </div>
                <button onClick={() => setLeader(null)} className="text-gray-500"><X size={16} /></button>
              </div>
            ) : (
              <div className="border border-dashed border-yellow-500/30 rounded-2xl p-4 text-center">
                <p className="text-yellow-400/60 text-sm">Busca un líder para empezar</p>
              </div>
            )}
          </div>

          {/* Búsqueda */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">
              {showLeaderSearch ? 'Buscar líder' : 'Añadir cartas'}
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={showLeaderSearch ? 'Buscar líder...' : 'Buscar carta...'}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none" />
            </div>

            {isSearching && <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-gray-500" /></div>}

            {searchResults.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {searchResults
                  .filter(c => showLeaderSearch ? (c.rarity === 'Leader' || c.type === 'Leader') : (c.rarity !== 'Leader' && c.type !== 'Leader'))
                  .slice(0, 8)
                  .map(card => {
                    const inDeck = deck.find(c => c.id === card.id);
                    const owned = ownedMap.get(card.id) ?? 0;
                    return (
                      <div key={card.id} className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-xl p-2">
                        <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded-lg shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{card.name}</p>
                          <div className="flex gap-1 items-center">
                            <p className="text-[10px] text-gray-500">{card.number}</p>
                            {(card.color || []).map((c: string) => (
                              <span key={c} className={`text-[8px] px-1 py-0.5 rounded-full ${COLOR_LABEL[c]?.bg ?? ''} ${COLOR_LABEL[c]?.text ?? ''}`}>{c[0]}</span>
                            ))}
                          </div>
                          <p className={`text-[10px] ${owned > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {owned > 0 ? `Tienes: ${owned}` : 'No tienes'}
                          </p>
                        </div>
                        {inDeck && <span className="text-xs text-blue-400 font-bold">x{inDeck.quantity}</span>}
                        <button
                          onClick={() => addCard(card, showLeaderSearch)}
                          disabled={!showLeaderSearch && (deckTotal >= DECK_SIZE || (inDeck?.quantity ?? 0) >= MAX_COPIES)}
                          className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center active:scale-95 disabled:opacity-40">
                          {showLeaderSearch ? '👑' : <Plus size={14} />}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Cartas de mi colección */}
          {search === '' && !showLeaderSearch && collection.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">Tu colección</p>
              <div className="grid grid-cols-4 gap-1.5">
                {collection.slice(0, 20).map(card => {
                  const inDeck = deck.find(c => c.id === (card.cardId ?? ''));
                  return (
                    <div key={card.id} className="relative">
                      <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''} className="w-full aspect-[3/4] object-cover rounded-xl" loading="lazy" />
                      {inDeck && (
                        <span className="absolute top-0.5 right-0.5 bg-blue-600/90 text-white text-[8px] font-bold px-1 rounded">x{inDeck.quantity}</span>
                      )}
                      <button
                        onClick={() => addCard({ id: card.cardId, name: card.cardName, number: card.cardNumber, type: '', color: [], image_url: card.imageUrl, set_name: card.setName, rarity: card.rarity }, false)}
                        disabled={deckTotal >= DECK_SIZE || (inDeck?.quantity ?? 0) >= MAX_COPIES}
                        className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-red-600/90 rounded-full flex items-center justify-center disabled:opacity-40 active:scale-90">
                        <Plus size={10} className="text-white" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mazos guardados */}
          {savedDecks.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-bold">Mazos guardados</p>
              {savedDecks.map(d => (
                <div key={d.id} className="flex items-center gap-3 bg-[#111118] border border-white/8 rounded-xl p-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.total} cartas · {new Date(d.savedAt).toLocaleDateString('es')}</p>
                  </div>
                  <button onClick={() => loadDeck(d)} className="px-3 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-medium">Cargar</button>
                  <button onClick={() => deleteSavedDeck(d.id)} className="w-7 h-7 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VALIDATE */}
      {view === 'validate' && (
        <div className="px-4 space-y-4">
          <div className={`rounded-2xl p-4 border ${isValid ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {isValid ? <CheckCircle2 size={18} className="text-green-400" /> : <AlertTriangle size={18} className="text-red-400" />}
              <p className={`text-sm font-bold ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                {isValid ? 'Mazo válido ✓' : `${errors.length} problema${errors.length > 1 ? 's' : ''} encontrado${errors.length > 1 ? 's' : ''}`}
              </p>
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 mt-1">{e}</p>
            ))}
          </div>

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

          {/* Distribución colores */}
          {Object.keys(colorDist).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold">Distribución de colores</p>
              {Object.entries(colorDist).sort(([,a],[,b]) => b - a).map(([color, count]) => {
                const info = COLOR_LABEL[color];
                return (
                  <div key={color} className="flex items-center gap-2 text-xs">
                    <span className="w-4">{info?.emoji ?? '⚪'}</span>
                    <span className="text-gray-400 w-16">{color}</span>
                    <div className="flex-1 bg-white/8 rounded-full h-2">
                      <div className={`h-2 rounded-full ${info?.bg.replace('/20', '') ?? 'bg-gray-500'}`} style={{ width: `${Math.round((count / deckTotal) * 100)}%` }} />
                    </div>
                    <span className="text-white font-bold w-8 text-right">{count} ({Math.round((count / deckTotal) * 100)}%)</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Curva de coste */}
          {Object.keys(costCurve).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold">Curva de coste</p>
              <div className="flex items-end gap-1 h-24">
                {Object.entries(costCurve).sort(([a],[b]) => Number(a) - Number(b)).map(([cost, count]) => (
                  <div key={cost} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-white font-bold">{count}</span>
                    <div className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm transition-all"
                      style={{ height: `${Math.round((count / maxCostCount) * 70)}px` }} />
                    <span className="text-[9px] text-gray-500">{cost}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cartas que faltan */}
          {missingCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-400">Te faltan {missingCount} cartas para completar el mazo</p>
              {deck.filter(c => c.quantity > c.owned).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <img src={c.image_url} alt={c.name} className="w-7 h-9 object-cover rounded-lg" />
                  <span className="text-gray-300 flex-1 truncate">{c.name}</span>
                  <span className="text-red-400 font-bold shrink-0">Faltan {c.quantity - c.owned}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIMULATE */}
      {view === 'simulate' && (
        <div className="px-4 space-y-4">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold">🎴 Simulador de mano inicial</p>
            <p className="text-xs text-gray-400">
              Simula qué cartas robarías al inicio de una partida (5 cartas). El líder siempre está en juego.
            </p>
            <button onClick={simulate} disabled={deckTotal === 0}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform">
              <Shuffle size={16} /> Robar mano {simCount > 0 ? `(#${simCount + 1})` : ''}
            </button>
          </div>

          {/* Mano actual */}
          {simulatedHand.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-bold">
                Mano #{simCount} — {simulatedHand.length} cartas
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {simulatedHand.map((card, i) => (
                  <div key={`${card.id}-${i}`} className="space-y-1">
                    <img src={card.image_url} alt={card.name}
                      className="w-full aspect-[3/4] object-cover rounded-xl shadow-lg" loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x280/111118/666?text=OP'; }} />
                    <p className="text-[8px] text-gray-400 text-center truncate">{card.name}</p>
                  </div>
                ))}
              </div>

              {/* Análisis de la mano */}
              <div className="mt-3 bg-[#111118] border border-white/8 rounded-2xl p-3 space-y-2">
                <p className="text-xs font-bold">Análisis</p>
                <div className="text-xs space-y-1 text-gray-400">
                  <p>⚡ Coste medio: <span className="text-white font-bold">
                    {simulatedHand.filter(c => c.cost != null).length > 0
                      ? (simulatedHand.reduce((s, c) => s + (c.cost ?? 0), 0) / simulatedHand.filter(c => c.cost != null).length).toFixed(1)
                      : '—'}
                  </span></p>
                  <p>💪 Poder total: <span className="text-white font-bold">
                    {simulatedHand.reduce((s, c) => s + (c.power ?? 0), 0).toLocaleString()}
                  </span></p>
                  <p>🎨 Colores: <span className="text-white font-bold">
                    {[...new Set(simulatedHand.flatMap(c => c.color || []))].join(', ') || '—'}
                  </span></p>
                </div>
              </div>

              {/* Historial resumido */}
              {simCount > 1 && (
                <button onClick={simulate} className="w-full mt-2 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-center justify-center gap-2 active:scale-95">
                  <Shuffle size={12} /> Robar otra mano
                </button>
              )}
            </div>
          )}

          {deckTotal === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Añade cartas al mazo para simular</p>
            </div>
          )}
        </div>
      )}

      {/* LIST */}
      {view === 'list' && (
        <div className="px-4 space-y-2">
          {leader && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-3">
              <img src={leader.image_url} alt={leader.name} className="w-10 h-14 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="text-[10px] text-yellow-400 font-bold">LÍDER</p>
                <p className="text-sm font-bold">{leader.name}</p>
                <div className="flex gap-1">{(leader.color || []).map(c => <span key={c}>{COLOR_LABEL[c]?.emoji ?? '⚪'}</span>)}</div>
              </div>
            </div>
          )}

          {deck.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">El mazo está vacío</p>
          ) : (
            <>
              {/* Agrupar por coste */}
              {Object.entries(costCurve).sort(([a],[b]) => Number(a) - Number(b)).map(([cost]) => {
                const costCards = deck.filter(c => (c.cost ?? 0) === Number(cost));
                if (costCards.length === 0) return null;
                return (
                  <div key={cost}>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 mt-2">⚡ Coste {cost}</p>
                    {costCards.map(card => (
                      <div key={card.id} className="flex items-center gap-2 bg-[#111118] border border-white/8 rounded-xl p-2 mb-1">
                        <img src={card.image_url} alt={card.name} className="w-8 h-11 object-cover rounded-lg shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{card.name}</p>
                          <p className="text-[10px] text-gray-500">{card.number}</p>
                          {card.owned < card.quantity && <p className="text-[10px] text-red-400">Faltan {card.quantity - card.owned}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => removeCard(card.id)} className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            <Minus size={10} className="text-gray-400" />
                          </button>
                          <span className="text-sm font-bold text-white w-5 text-center">x{card.quantity}</span>
                          <button onClick={() => addCard(card)} disabled={card.quantity >= MAX_COPIES || deckTotal >= DECK_SIZE}
                            className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center disabled:opacity-40">
                            <Plus size={10} className="text-gray-400" />
                          </button>
                          <button onClick={() => removeCard(card.id, card.quantity)} className="w-6 h-6 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center ml-1">
                            <Trash2 size={10} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
