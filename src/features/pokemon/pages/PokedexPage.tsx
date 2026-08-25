import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';
import { useCollectionList } from '@/hooks/use-collection';

interface PokedexEntry {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  cardCount: number;
}

const TYPE_COLORS: Record<string, string> = {
  fire: 'bg-red-500/20 text-red-400',
  water: 'bg-blue-500/20 text-blue-400',
  grass: 'bg-green-500/20 text-green-400',
  electric: 'bg-yellow-500/20 text-yellow-400',
  psychic: 'bg-pink-500/20 text-pink-400',
  ice: 'bg-cyan-500/20 text-cyan-400',
  dragon: 'bg-indigo-500/20 text-indigo-400',
  dark: 'bg-gray-700/40 text-gray-300',
  fairy: 'bg-pink-300/20 text-pink-300',
  fighting: 'bg-orange-600/20 text-orange-400',
  poison: 'bg-purple-500/20 text-purple-400',
  ground: 'bg-yellow-700/20 text-yellow-600',
  flying: 'bg-sky-500/20 text-sky-400',
  bug: 'bg-lime-500/20 text-lime-400',
  rock: 'bg-stone-500/20 text-stone-400',
  ghost: 'bg-violet-700/20 text-violet-400',
  steel: 'bg-slate-500/20 text-slate-400',
  normal: 'bg-gray-500/20 text-gray-400',
};

// Extrae el nombre "base" de un Pokémon (sin sufijos de cartas)
function extractPokemonName(cardName: string): string {
  // Elimina "ex", "GX", "V", "VMAX", "VSTAR", "EX", "Mega", "M " al final
  return cardName
    .replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|Mega|BREAK|TAG TEAM|Prime|Legend)$/i, '')
    .replace(/^(M\s+|Mega\s+)/i, '')
    .trim();
}

export function PokedexPage() {
  const navigate = useNavigate();
  const { data: allCards = [], isLoading: cardsLoading } = useCollectionList();
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Pokémon únicos de la colección
  const pokemonNames = useMemo(() => {
    const cards = allCards.filter(c => c.tcg === 'pokemon');
    const nameMap = new Map<string, number>(); // nombre → cantidad de cartas
    cards.forEach(card => {
      const baseName = extractPokemonName(card.cardName ?? '');
      nameMap.set(baseName, (nameMap.get(baseName) ?? 0) + card.quantity);
    });
    return nameMap;
  }, [allCards]);

  useEffect(() => {
    if (pokemonNames.size === 0 || cardsLoading) return;

    setLoading(true);
    const names = Array.from(pokemonNames.keys());

    // Consulta PokéAPI para cada Pokémon único
    Promise.allSettled(
      names.map(async (name) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/-$/, '');
        try {
          const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(slug)}`);
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.id,
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            sprite: data.sprites.other?.['official-artwork']?.front_default ?? data.sprites.front_default ?? '',
            types: data.types.map((t: any) => t.type.name as string),
            cardCount: pokemonNames.get(name) ?? 1,
          } as PokedexEntry;
        } catch { return null; }
      })
    ).then(results => {
      const entries = results
        .filter((r): r is PromiseFulfilledResult<PokedexEntry | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((e): e is PokedexEntry => e !== null)
        .sort((a, b) => a.id - b.id);
      setPokedex(entries);
      setLoading(false);
    });
  }, [pokemonNames, cardsLoading]);

  const filtered = pokedex.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    String(p.id).padStart(4, '0').includes(search)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => navigate('/pokemon')}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">POKÉMON TCG</p>
            <h1 className="text-lg font-bold leading-tight">Pokédex</h1>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            {pokedex.length} obtenidos
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o número…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
          />
        </div>

        {/* Estados de carga */}
        {(cardsLoading || loading) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
            <p className="text-sm text-gray-500">
              {cardsLoading ? 'Cargando colección…' : `Consultando PokéAPI (${pokedex.length}/${pokemonNames.size})…`}
            </p>
          </div>
        )}

        {/* Vacío */}
        {!cardsLoading && !loading && pokedex.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
              📕
            </div>
            <div>
              <p className="text-white font-bold">Pokédex vacía</p>
              <p className="text-sm text-gray-500 mt-1">Añade cartas Pokémon a tu colección para verlos aquí</p>
            </div>
          </div>
        )}

        {/* Grid Pokédex */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {filtered.map(entry => (
              <button
                key={entry.id}
                onClick={() => navigate(`/pokedex/${entry.id}`)}
                className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex flex-col items-center gap-2 active:scale-95 transition-transform"
              >
                {entry.sprite ? (
                  <img src={entry.sprite} alt={entry.name} className="w-16 h-16 object-contain" loading="lazy" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-2xl">?</div>
                )}
                <div className="text-center w-full">
                  <p className="text-[10px] text-gray-600">#{String(entry.id).padStart(4, '0')}</p>
                  <p className="text-xs font-bold text-white truncate">{entry.name}</p>
                  <div className="flex justify-center gap-1 mt-1 flex-wrap">
                    {entry.types.map(type => (
                      <span key={type} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[type] ?? 'bg-white/10 text-gray-400'}`}>
                        {type}
                      </span>
                    ))}
                  </div>
                  {entry.cardCount > 1 && (
                    <p className="text-[9px] text-blue-400 mt-1">{entry.cardCount} cartas</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Sin resultados de búsqueda */}
        {!loading && filtered.length === 0 && pokedex.length > 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            No hay resultados para "{search}"
          </div>
        )}
      </div>
    </div>
  );
}