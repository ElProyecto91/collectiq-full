import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Search, Loader2, LayoutGrid, List, BarChart2, Zap, Shield, Sword, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';
import { useCollectionList } from '@/hooks/use-collection';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  supertype: string;
  subtypes?: string[];
  types?: string[];
  rarity?: string;
  images: { small: string };
  set: { name: string; id: string };
  legalities?: { standard?: string; expanded?: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
  tcgplayer?: { prices?: { normal?: { market?: number }; holofoil?: { market?: number } } };
}

const POKEMON_API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY ?? '';

const TYPE_COLORS: Record<string, string> = {
  Fire: '#FF6B35', Water: '#3B9EE6', Grass: '#4CAF50', Lightning: '#FFD700',
  Psychic: '#9C27B0', Fighting: '#FF8C00', Darkness: '#424242', Metal: '#9E9E9E',
  Dragon: '#4A148C', Fairy: '#E91E8C', Colorless: '#BDBDBD',
};

const TYPE_EMOJIS: Record<string, string> = {
  Fire: '🔥', Water: '💧', Grass: '🌿', Lightning: '⚡', Psychic: '🔮',
  Fighting: '👊', Darkness: '🌑', Metal: '⚙️', Dragon: '🐉', Fairy: '✨', Colorless: '⭐',
};

const TYPE_LABELS: Record<string, string> = {
  Fire: 'Fuego', Water: 'Agua', Grass: 'Planta', Lightning: 'Electrico',
  Psychic: 'Psiquico', Fighting: 'Lucha', Darkness: 'Oscuridad', Metal: 'Metal',
  Dragon: 'Dragon', Fairy: 'Hada', Colorless: 'Incoloro',
};

const SUPERTYPES = [
  { key: '', label: 'Todos' },
  { key: 'Pokémon', label: 'Pokemon' },
  { key: 'Trainer', label: 'Entrenador' },
  { key: 'Energy', label: 'Energia' },
];

const SUBTYPES = [
  { key: 'Basic', label: 'Basico' },
  { key: 'Stage 1', label: 'Fase 1' },
  { key: 'Stage 2', label: 'Fase 2' },
  { key: 'ex', label: 'ex' },
  { key: 'GX', label: 'GX' },
  { key: 'V', label: 'V' },
  { key: 'VMAX', label: 'VMAX' },
  { key: 'VSTAR', label: 'VSTAR' },
  { key: 'Item', label: 'Objeto' },
  { key: 'Supporter', label: 'Seguidor' },
  { key: 'Stadium', label: 'Estadio' },
];

const FORMATS = [
  { key: '', label: 'Libre', desc: 'Todas las cartas' },
  { key: 'standard', label: 'Standard', desc: 'Marcas H, I, J' },
  { key: 'expanded', label: 'Expanded', desc: 'Desde Black & White' },
];

const TYPES = ['Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Dragon', 'Colorless'];

const PAGE_SIZES = [20, 50];

interface DeckCard {
  card: PokemonCard;
  quantity: number;
}

function getSupertypeLabel(supertype: string): string {
  if (supertype === 'Pokémon') return 'Pokemon';
  if (supertype === 'Trainer') return 'Entrenador';
  if (supertype === 'Energy') return 'Energia';
  return supertype;
}

function getCardPrice(card: PokemonCard): number | null {
  return card.cardmarket?.prices?.averageSellPrice ??
    card.tcgplayer?.prices?.holofoil?.market ??
    card.tcgplayer?.prices?.normal?.market ??
    null;
}

export function CreateDeckPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: collectionCards = [] } = useCollectionList();
  const collectionIds = new Set(collectionCards.map(c => c.cardId));

  const [step, setStep] = useState<'info' | 'cards' | 'stats'>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [query, setQuery] = useState('');
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedSubtype, setSelectedSubtype] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [onlyMyCollection, setOnlyMyCollection] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [searchResults, setSearchResults] = useState<PokemonCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [deckCards, setDeckCards] = useState<Map<string, DeckCard>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [zoomedCard, setZoomedCard] = useState<PokemonCard | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const totalCards = Array.from(deckCards.values()).reduce((s, c) => s + c.quantity, 0);
  const pokemonCount = Array.from(deckCards.values()).filter(c => c.card.supertype === 'Pokémon').reduce((s, c) => s + c.quantity, 0);
  const trainerCount = Array.from(deckCards.values()).filter(c => c.card.supertype === 'Trainer').reduce((s, c) => s + c.quantity, 0);
  const energyCount = Array.from(deckCards.values()).filter(c => c.card.supertype === 'Energy').reduce((s, c) => s + c.quantity, 0);

  const deckTotalValue = Array.from(deckCards.values()).reduce((s, { card, quantity }) => {
    const price = getCardPrice(card);
    return s + (price ?? 0) * quantity;
  }, 0);

  const typeDistribution = Array.from(deckCards.values())
    .filter(c => c.card.supertype === 'Pokémon' && c.card.types)
    .reduce((acc, { card, quantity }) => {
      (card.types ?? []).forEach(type => { acc[type] = (acc[type] ?? 0) + quantity; });
      return acc;
    }, {} as Record<string, number>);

  const activeFilterCount = [selectedSupertype, selectedType, selectedSubtype, selectedFormat, onlyMyCollection ? 'x' : ''].filter(Boolean).length;

  const doSearch = useCallback(async (
    q: string, supertype: string, type: string, subtype: string,
    format: string, all: boolean, pg: number, pgSize: number, myCollection: boolean
  ) => {
    setIsSearching(true);
    try {
      let queryStr = '';
      if (q.trim()) queryStr += 'name:"*' + q.trim() + '*"';
      if (supertype) queryStr += (queryStr ? ' ' : '') + 'supertype:' + supertype;
      if (type) queryStr += (queryStr ? ' ' : '') + 'types:' + type;
      if (subtype) queryStr += (queryStr ? ' ' : '') + 'subtypes:"' + subtype + '"';
      if (format === 'standard') queryStr += (queryStr ? ' ' : '') + 'legalities.standard:Legal';
      if (format === 'expanded') queryStr += (queryStr ? ' ' : '') + 'legalities.expanded:Legal';

      if (!queryStr) {
        if (all || supertype || type || subtype || format) {
          queryStr = 'set.series:Scarlet*';
        } else {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
      }

      const res = await fetch(
        'https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(queryStr) +
        '&pageSize=' + pgSize + '&page=' + pg + '&orderBy=-set.releaseDate',
        { headers: { 'X-Api-Key': POKEMON_API_KEY } }
      );
      const json = await res.json();
      setTotalResults(json.totalCount ?? 0);

      let results = json.data ?? [];
      if (myCollection) {
        results = results.filter((c: PokemonCard) => collectionIds.has(c.id));
      }
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [collectionIds]);

  useEffect(() => {
    if (step === 'cards') {
      doSearch(query, selectedSupertype, selectedType, selectedSubtype, selectedFormat, showAll, page, pageSize, onlyMyCollection);
    }
  }, [showAll, step, pageSize]);

  const triggerSearch = (overrides: Partial<{
    q: string; supertype: string; type: string; subtype: string;
    format: string; all: boolean; pg: number; myCollection: boolean;
  }> = {}) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      doSearch(
        overrides.q ?? query,
        overrides.supertype ?? selectedSupertype,
        overrides.type ?? selectedType,
        overrides.subtype ?? selectedSubtype,
        overrides.format ?? selectedFormat,
        overrides.all ?? showAll,
        overrides.pg ?? 1,
        pageSize,
        overrides.myCollection ?? onlyMyCollection,
      );
      setPage(overrides.pg ?? 1);
    }, overrides.q !== undefined ? 600 : 0);
  };

  const addCard = (card: PokemonCard) => {
    const existing = deckCards.get(card.id);
    const qty = existing?.quantity ?? 0;
    if (qty >= 4) return;
    const newMap = new Map(deckCards);
    newMap.set(card.id, { card, quantity: qty + 1 });
    setDeckCards(newMap);
  };

  const removeCard = (cardId: string) => {
    const existing = deckCards.get(cardId);
    if (!existing) return;
    const newMap = new Map(deckCards);
    if (existing.quantity <= 1) newMap.delete(cardId);
    else newMap.set(cardId, { ...existing, quantity: existing.quantity - 1 });
    setDeckCards(newMap);
  };

  const handleSave = async () => {
    if (!telegramUser?.id || !name.trim()) return;
    setIsSaving(true);
    try {
      const coverImage = Array.from(deckCards.values())[0]?.card.images.small ?? null;
      const { data: deck, error } = await supabase
        .from('decks')
        .insert({
          telegram_user_id: telegramUser.id,
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          cover_card_image: coverImage,
        })
        .select('id')
        .single();

      if (error || !deck) throw error;

      const cardRows = Array.from(deckCards.values()).map(({ card, quantity }) => ({
        deck_id: deck.id,
        card_id: card.id,
        card_name: card.name,
        card_number: card.number,
        set_name: card.set.name,
        image_url: card.images.small,
        quantity,
        supertype: card.supertype,
        market_price: getCardPrice(card),
      }));

      await supabase.from('deck_cards').insert(cardRows);
      navigate('/decks');
    } catch {
      alert('Error al guardar el mazo');
    } finally {
      setIsSaving(false);
    }
  };

  const totalPages = Math.ceil(totalResults / pageSize);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-8">
{zoomedCard && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" onClick={() => setZoomedCard(null)}>
    <img src={zoomedCard.images.small} alt={zoomedCard.name} className="w-full max-w-xs rounded-2xl shadow-2xl" />
    <p className="absolute bottom-8 text-white text-center font-bold">{zoomedCard.name}</p>
  </div>
)}

      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => step === 'cards' ? setStep('info') : step === 'stats' ? setStep('cards') : navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">
            {step === 'info' ? 'Nuevo mazo' : step === 'cards' ? 'Añadir cartas' : 'Estadisticas'}
          </h1>
        </div>
        {step === 'cards' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('stats')}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <BarChart2 size={16} className="text-gray-400" />
            </button>
            <p className={'text-sm font-bold ' + (totalCards === 60 ? 'text-green-400' : totalCards > 60 ? 'text-red-400' : 'text-white')}>
              {totalCards}/60
            </p>
          </div>
        )}
      </div>

      {step === 'info' && (
        <div className="px-4 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Nombre del mazo *</p>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="ej: Charizard ex Control"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Descripcion</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Estrategia, combos principales, guia de juego..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none h-24" />
          </div>
          <button onClick={() => setIsPublic(!isPublic)}
            className={'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ' + (isPublic ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/8')}>
            <div className="text-left">
              <p className="text-sm font-medium text-white">{isPublic ? 'Mazo publico' : 'Mazo privado'}</p>
              <p className="text-xs text-gray-500">{isPublic ? 'Visible en la Comunidad — otros pueden copiarlo y votarlo' : 'Solo tu puedes verlo'}</p>
            </div>
            <div className={'w-5 h-5 rounded-full border-2 flex items-center justify-center ' + (isPublic ? 'border-blue-400 bg-blue-400' : 'border-gray-600')}>
              {isPublic && <span className="text-[10px] text-white font-bold">✓</span>}
            </div>
          </button>
          <button onClick={() => { if (name.trim()) setStep('cards'); }}
            disabled={!name.trim()}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-40 active:scale-95 transition-transform">
            Siguiente — Añadir cartas →
          </button>
        </div>
      )}

      {step === 'cards' && (
        <div className="px-4 space-y-3">

          <div className="bg-[#111118] border border-white/8 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{'🎴 ' + pokemonCount + ' Pokemon'}</span>
              <span>{'🎓 ' + trainerCount + ' Entrenadores'}</span>
              <span>{'⚡ ' + energyCount + ' Energias'}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 flex overflow-hidden">
              <div className="bg-blue-500 h-2 transition-all" style={{ width: (pokemonCount / 60 * 100) + '%' }} />
              <div className="bg-yellow-500 h-2 transition-all" style={{ width: (trainerCount / 60 * 100) + '%' }} />
              <div className="bg-red-500 h-2 transition-all" style={{ width: (energyCount / 60 * 100) + '%' }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {totalCards === 60 ? '✅ Mazo completo' : (60 - totalCards) + ' cartas restantes'}
              </p>
              {deckTotalValue > 0 && (
                <p className="text-xs text-green-400 font-bold">
                  {'~' + deckTotalValue.toFixed(2) + ' EUR'}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {FORMATS.map(f => (
              <button key={f.key}
                onClick={() => { setSelectedFormat(f.key); triggerSearch({ format: f.key }); }}
                className={'flex-1 py-2 rounded-xl text-xs font-medium border transition-all text-center ' + (
                  selectedFormat === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-gray-400 border-white/10'
                )}>
                <p className="font-bold">{f.label}</p>
                <p className="text-[9px] opacity-70">{f.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={query}
                onChange={e => { setQuery(e.target.value); triggerSearch({ q: e.target.value }); }}
                placeholder="Buscar por nombre..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />}
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={'relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all ' + (showFilters || activeFilterCount > 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400')}>
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-[#111118] border border-white/8 rounded-xl p-3 space-y-3">

              <div className="flex items-center justify-between">
                <p className="text-xs text-white font-medium">Mostrar todas las cartas</p>
                <button onClick={() => setShowAll(!showAll)}
                  className={'w-10 h-5 rounded-full transition-all flex items-center px-0.5 ' + (showAll ? 'bg-blue-500 justify-end' : 'bg-white/10 justify-start')}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white font-medium">Solo mi coleccion</p>
                  <p className="text-[10px] text-gray-500">Cartas que ya tienes fisicamente</p>
                </div>
                <button onClick={() => { setOnlyMyCollection(!onlyMyCollection); triggerSearch({ myCollection: !onlyMyCollection }); }}
                  className={'w-10 h-5 rounded-full transition-all flex items-center px-0.5 ' + (onlyMyCollection ? 'bg-green-500 justify-end' : 'bg-white/10 justify-start')}>
                  <div className="w-4 h-4 rounded-full bg-white shadow" />
                </button>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Tipo de carta</p>
                <div className="flex gap-1.5 flex-wrap">
                  {SUPERTYPES.map(st => (
                    <button key={st.key}
                      onClick={() => { setSelectedSupertype(st.key); triggerSearch({ supertype: st.key }); }}
                      className={'px-3 py-1 rounded-full text-xs font-medium border transition-all ' + (
                        selectedSupertype === st.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-gray-400 border-white/10'
                      )}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Tipo elemental</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button onClick={() => { setSelectedType(''); triggerSearch({ type: '' }); }}
                    className={'shrink-0 px-2.5 py-1 rounded-full text-xs border transition-all ' + (
                      selectedType === '' ? 'bg-white/20 text-white border-white/20' : 'bg-white/5 text-gray-400 border-white/10'
                    )}>
                    Todos
                  </button>
                  {TYPES.map(type => (
                    <button key={type}
                      onClick={() => { setSelectedType(type); triggerSearch({ type }); }}
                      className={'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all ' + (
                        selectedType === type ? 'text-white' : 'bg-white/5 text-gray-400 border-white/10'
                      )}
                      style={selectedType === type ? { backgroundColor: TYPE_COLORS[type] + '33', borderColor: TYPE_COLORS[type] } : {}}>
                      <span>{TYPE_EMOJIS[type]}</span>
                      <span>{TYPE_LABELS[type]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Subtipo</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <button onClick={() => { setSelectedSubtype(''); triggerSearch({ subtype: '' }); }}
                    className={'shrink-0 px-2.5 py-1 rounded-full text-xs border transition-all ' + (
                      selectedSubtype === '' ? 'bg-white/20 text-white border-white/20' : 'bg-white/5 text-gray-400 border-white/10'
                    )}>
                    Todos
                  </button>
                  {SUBTYPES.map(st => (
                    <button key={st.key}
                      onClick={() => { setSelectedSubtype(st.key); triggerSearch({ subtype: st.key }); }}
                      className={'shrink-0 px-2.5 py-1 rounded-full text-xs border transition-all ' + (
                        selectedSubtype === st.key ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 text-gray-400 border-white/10'
                      )}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-500 mb-1.5">Resultados por pagina</p>
                <div className="flex gap-2">
                  {PAGE_SIZES.map(ps => (
                    <button key={ps} onClick={() => setPageSize(ps)}
                      className={'flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all ' + (
                        pageSize === ps ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400'
                      )}>
                      {ps} cartas
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={() => {
                  setSelectedSupertype(''); setSelectedType(''); setSelectedSubtype('');
                  setSelectedFormat(''); setOnlyMyCollection(false);
                  triggerSearch({ supertype: '', type: '', subtype: '', format: '', myCollection: false });
                }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <X size={12} />
                  Limpiar {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {searchResults.length > 0
                ? totalResults.toLocaleString() + ' resultados · pag ' + page + '/' + Math.max(1, totalPages)
                : showAll || selectedSupertype || selectedType ? 'Cargando...' : 'Busca o ajusta los filtros'}
            </p>
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              <button onClick={() => setViewMode('grid')}
                className={'p-1.5 rounded ' + (viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500')}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setViewMode('list')}
                className={'p-1.5 rounded ' + (viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500')}>
                <List size={14} />
              </button>
            </div>
          </div>

          {viewMode === 'grid' && searchResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {searchResults.map(card => {
                const qty = deckCards.get(card.id)?.quantity ?? 0;
                const inCollection = collectionIds.has(card.id);
                const price = getCardPrice(card);
                return (
                  <div key={card.id} className={'bg-[#111118] border rounded-xl overflow-hidden ' + (inCollection ? 'border-blue-500/30' : 'border-white/8')}>
                    <div className="relative">
                      <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover cursor-pointer" onClick={() => setZoomedCard(card)} />
                      {inCollection && (
                        <div className="absolute top-1 right-1 bg-blue-500/90 rounded-full px-1.5 py-0.5">
                          <span className="text-[8px] text-white font-bold">Tengo</span>
                        </div>
                      )}
                      {qty > 0 && (
                        <div className="absolute top-1 left-1 bg-black/70 rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">{qty}</span>
                        </div>
                      )}
                      {price && (
                        <div className="absolute bottom-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5">
                          <span className="text-[8px] text-green-400 font-bold">{price.toFixed(2)}€</span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 space-y-1">
                      <p className="text-[10px] font-bold truncate">{card.name}</p>
                      <div className="flex gap-1">
                        <button onClick={() => removeCard(card.id)} disabled={qty === 0}
                          className="flex-1 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-30">
                          <Minus size={10} />
                        </button>
                        <button onClick={() => addCard(card)} disabled={qty >= 4}
                          className="flex-1 h-6 rounded bg-blue-600 flex items-center justify-center text-white disabled:opacity-30">
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'list' && searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(card => {
                const qty = deckCards.get(card.id)?.quantity ?? 0;
                const inCollection = collectionIds.has(card.id);
                const price = getCardPrice(card);
                return (
                  <div key={card.id} className={'flex items-center gap-3 bg-[#111118] border rounded-xl px-3 py-2 ' + (inCollection ? 'border-blue-500/20' : 'border-white/8')}>
                    <img src={card.images.small} alt={card.name} className="w-10 h-14 object-cover rounded" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={'text-[9px] px-1.5 py-0.5 rounded-full ' + (
                          card.supertype === 'Pokémon' ? 'bg-blue-500/20 text-blue-400' :
                          card.supertype === 'Trainer' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        )}>
                          {getSupertypeLabel(card.supertype)}
                        </span>
                        {card.types && card.types[0] && (
                          <span className="text-[9px] text-gray-500">{TYPE_EMOJIS[card.types[0]]} {TYPE_LABELS[card.types[0]] ?? card.types[0]}</span>
                        )}
                        {price && <span className="text-[9px] text-green-400">{price.toFixed(2)}EUR</span>}
                        {inCollection && <span className="text-[9px] text-blue-400">✓ Tengo</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => removeCard(card.id)} disabled={qty === 0}
                        className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-30">
                        <Minus size={12} />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{qty}</span>
                      <button onClick={() => addCard(card)} disabled={qty >= 4}
                        className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white disabled:opacity-30">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && searchResults.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); doSearch(query, selectedSupertype, selectedType, selectedSubtype, selectedFormat, showAll, p, pageSize, onlyMyCollection); }}
                disabled={page === 1}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 disabled:opacity-30 active:scale-95 transition-transform">
                Anterior
              </button>
              <span className="text-xs text-gray-500 shrink-0">{page}/{totalPages}</span>
              <button onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); doSearch(query, selectedSupertype, selectedType, selectedSubtype, selectedFormat, showAll, p, pageSize, onlyMyCollection); }}
                disabled={page >= totalPages}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white disabled:opacity-30 active:scale-95 transition-transform">
                Siguiente
              </button>
            </div>
          )}

          {!isSearching && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Busca una carta o ajusta los filtros</p>
              <p className="text-xs mt-1">Activa "Mostrar todas" para ver el catalogo completo</p>
            </div>
          )}

          {deckCards.size > 0 && (
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">En el mazo ({totalCards}/60)</p>
                {deckTotalValue > 0 && (
                  <p className="text-xs text-green-400 font-bold">{'~' + deckTotalValue.toFixed(2) + ' EUR'}</p>
                )}
              </div>
              {['Pokémon', 'Trainer', 'Energy'].map(supertype => {
                const group = Array.from(deckCards.values()).filter(c => c.card.supertype === supertype);
                if (group.length === 0) return null;
                const groupTotal = group.reduce((s, c) => s + c.quantity, 0);
                return (
                  <div key={supertype}>
                    <p className="text-[10px] text-gray-600 mb-1">
                      {supertype === 'Pokémon' ? '🎴 Pokemon' : supertype === 'Trainer' ? '🎓 Entrenadores' : '⚡ Energias'} ({groupTotal})
                    </p>
                    {group.map(({ card, quantity }) => {
                      const price = getCardPrice(card);
                      return (
                        <div key={card.id} className="flex items-center gap-2 py-1 border-b border-white/5">
                          <span className="text-xs text-gray-400 w-5 text-center font-bold">{quantity}x</span>
                          <p className="flex-1 text-xs truncate">{card.name}</p>
                          {price && <span className="text-[10px] text-green-400">{(price * quantity).toFixed(2)}EUR</span>}
                          <div className="flex gap-1">
                            <button onClick={() => removeCard(card.id)}
                              className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-gray-500">
                              <Minus size={9} />
                            </button>
                            <button onClick={() => addCard(card)} disabled={quantity >= 4}
                              className="w-5 h-5 rounded bg-blue-600/50 flex items-center justify-center text-white disabled:opacity-30">
                              <Plus size={9} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={handleSave} disabled={isSaving || totalCards === 0}
            className={'w-full rounded-xl py-3 font-semibold active:scale-95 transition-transform disabled:opacity-40 mt-2 ' + (totalCards === 60 ? 'bg-green-600 text-white' : 'bg-blue-600 text-white')}>
            {isSaving ? 'Guardando...' : totalCards === 60 ? '✅ Guardar mazo completo' : 'Guardar mazo (' + totalCards + '/60)'}
          </button>
        </div>
      )}

      {step === 'stats' && (
        <div className="px-4 space-y-4">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Composicion del mazo</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pokemon', value: pokemonCount, color: 'text-blue-400', bg: 'bg-blue-500', icon: <Sword size={14} /> },
                { label: 'Entrenadores', value: trainerCount, color: 'text-yellow-400', bg: 'bg-yellow-500', icon: <Shield size={14} /> },
                { label: 'Energias', value: energyCount, color: 'text-red-400', bg: 'bg-red-500', icon: <Zap size={14} /> },
              ].map(item => (
                <div key={item.label} className="text-center bg-white/5 rounded-xl p-3">
                  <p className={'text-2xl font-bold ' + item.color}>{item.value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
                  <div className="w-full bg-white/10 rounded-full h-1 mt-2">
                    <div className={item.bg + ' h-1 rounded-full'} style={{ width: (item.value / 60 * 100) + '%' }} />
                  </div>
                </div>
              ))}
            </div>
            {deckTotalValue > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Valor estimado del mazo</p>
                <p className="text-xl font-bold text-green-400 mt-0.5">{'~' + deckTotalValue.toFixed(2) + ' EUR'}</p>
              </div>
            )}
          </div>

          {Object.keys(typeDistribution).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tipos de Pokemon</p>
              {Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-base">{TYPE_EMOJIS[type] ?? '⭐'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">{TYPE_LABELS[type] ?? type}</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full"
                        style={{ width: (count / pokemonCount * 100) + '%', backgroundColor: TYPE_COLORS[type] ?? '#6366f1' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deckCards.size > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Cartas de tu coleccion</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/10 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full"
                    style={{ width: (Array.from(deckCards.keys()).filter(id => collectionIds.has(id)).length / deckCards.size * 100) + '%' }} />
                </div>
                <span className="text-sm font-bold text-green-400">
                  {Array.from(deckCards.keys()).filter(id => collectionIds.has(id)).length}/{deckCards.size}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {Array.from(deckCards.keys()).filter(id => collectionIds.has(id)).length} de {deckCards.size} cartas unicas ya las tienes fisicamente
              </p>
            </div>
          )}

          <button onClick={() => setStep('cards')}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold active:scale-95 transition-transform">
            Volver al editor
          </button>
        </div>
      )}
    </div>
  );
}