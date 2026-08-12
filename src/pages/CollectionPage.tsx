import { Heart, Layers, Minus, Plus, Trash2, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pokemon-collection';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
}

interface CollectionEntry {
  card: PokemonCard;
  quantity: number;
  favorite: boolean;
  addedAt: number;
}

function loadCollection(): CollectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    // Support both old format (array of cards) and new format (array of entries)
    if (Array.isArray(data)) {
      if (data.length === 0) return [];
      if ('card' in data[0]) return data as CollectionEntry[];
      // Old format — migrate
      return data.map((card: PokemonCard) => ({
        card,
        quantity: 1,
        favorite: false,
        addedAt: Date.now(),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function saveCollection(entries: CollectionEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

type SortOption = 'recent' | 'name' | 'rarity' | 'value';

export function CollectionPage() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('recent');

  useEffect(() => {
    setEntries(loadCollection());
  }, []);

  const updateEntry = useCallback((id: string, update: Partial<CollectionEntry>) => {
    setEntries(prev => {
      const next = prev.map(e => e.card.id === id ? { ...e, ...update } : e);
      saveCollection(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.card.id !== id);
      saveCollection(next);
      return next;
    });
  }, []);

  const filtered = entries
    .filter(e => e.card.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'recent') return b.addedAt - a.addedAt;
      if (sort === 'name') return a.card.name.localeCompare(b.card.name);
      if (sort === 'value') {
        const va = a.card.cardmarket?.prices?.averageSellPrice ?? 0;
        const vb = b.card.cardmarket?.prices?.averageSellPrice ?? 0;
        return vb - va;
      }
      return 0;
    });

  const totalCards = entries.reduce((s, e) => s + e.quantity, 0);
  const uniqueCards = entries.length;
  const favorites = entries.filter(e => e.favorite).length;

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Colección</h1>
        <p className="text-sm text-gray-500">Todas tus cartas, en un solo lugar.</p>
      </div>

      {/* Debug button - temporary */}
      <button
        onClick={() => {
          const raw = localStorage.getItem('pokemon-collection');
          alert(raw ? raw.substring(0, 200) : 'VACÍO - No hay nada guardado');
        }}
        className="w-full bg-yellow-500/20 border border-yellow-500/30 rounded-xl py-2 text-xs text-yellow-400"
      >
        🔍 Ver localStorage (debug)
      </button>

      {/* Stats */}
      {totalCards > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cartas', value: totalCards, color: 'text-blue-400' },
            { label: 'Únicas', value: uniqueCards, color: 'text-purple-400' },
            { label: 'Favoritas', value: favorites, color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Busca en tu colección"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-gray-500">Ordenar</span>
        {(['recent', 'name', 'value'] as SortOption[]).map(opt => (
          <button
            key={opt}
            onClick={() => setSort(opt)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sort === opt ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            {opt === 'recent' ? 'Recientes' : opt === 'name' ? 'Nombre' : 'Valor'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Layers size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Aún no tienes cartas</p>
            <p className="text-sm text-gray-500 mt-1">Escanea cartas para empezar tu colección.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No hay cartas que coincidan con "{search}"
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(entry => (
            <CollectionCard
              key={entry.card.id}
              entry={entry}
              onUpdate={updateEntry}
              onRemove={removeEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionCard({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: CollectionEntry;
  onUpdate: (id: string, update: Partial<CollectionEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { card } = entry;

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    onRemove(card.id);
  };

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative">
        <img
          src={card.images.small}
          alt={card.name}
          className="w-full aspect-[2/3] object-cover"
          loading="lazy"
        />
        <button
          onClick={() => onUpdate(card.id, { favorite: !entry.favorite })}
          className="absolute right-1.5 top-1.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <Heart
            size={15}
            className={entry.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
          />
        </button>
        {entry.favorite && (
          <div className="absolute left-1.5 top-1.5 w-6 h-6 rounded-full bg-yellow-400/90 flex items-center justify-center">
            <Star size={12} className="fill-black text-black" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex-1 space-y-1">
        <p className="text-xs font-bold truncate text-white">{card.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
        {card.rarity && <p className="text-[10px] text-blue-400 truncate">{card.rarity}</p>}
        {card.cardmarket?.prices?.averageSellPrice && (
          <p className="text-[10px] text-green-400 font-medium">
            €{card.cardmarket.prices.averageSellPrice.toFixed(2)}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-1 px-2.5 pb-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => entry.quantity > 1 && onUpdate(card.id, { quantity: entry.quantity - 1 })}
            disabled={entry.quantity <= 1}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 disabled:opacity-40"
          >
            <Minus size={13} />
          </button>
          <span className="text-sm font-bold text-white min-w-[1.5rem] text-center">
            {entry.quantity}
          </span>
          <button
            onClick={() => onUpdate(card.id, { quantity: entry.quantity + 1 })}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400"
          >
            <Plus size={13} />
          </button>
        </div>
        <button
          onClick={handleRemove}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
            confirmDelete
              ? 'border-red-500 bg-red-500/10 text-red-400'
              : 'border-white/10 bg-white/5 text-gray-500'
          }`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}