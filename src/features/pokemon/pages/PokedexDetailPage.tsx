import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fire:     { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30' },
  water:    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  grass:    { bg: 'bg-green-500/20',   text: 'text-green-400',   border: 'border-green-500/30' },
  electric: { bg: 'bg-yellow-500/20',  text: 'text-yellow-400',  border: 'border-yellow-500/30' },
  psychic:  { bg: 'bg-pink-500/20',    text: 'text-pink-400',    border: 'border-pink-500/30' },
  ice:      { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    border: 'border-cyan-500/30' },
  dragon:   { bg: 'bg-indigo-500/20',  text: 'text-indigo-400',  border: 'border-indigo-500/30' },
  dark:     { bg: 'bg-gray-700/40',    text: 'text-gray-300',    border: 'border-gray-600/30' },
  fairy:    { bg: 'bg-pink-300/20',    text: 'text-pink-300',    border: 'border-pink-300/30' },
  fighting: { bg: 'bg-orange-600/20',  text: 'text-orange-400',  border: 'border-orange-500/30' },
  poison:   { bg: 'bg-purple-500/20',  text: 'text-purple-400',  border: 'border-purple-500/30' },
  ground:   { bg: 'bg-yellow-700/20',  text: 'text-yellow-600',  border: 'border-yellow-700/30' },
  flying:   { bg: 'bg-sky-500/20',     text: 'text-sky-400',     border: 'border-sky-500/30' },
  bug:      { bg: 'bg-lime-500/20',    text: 'text-lime-400',    border: 'border-lime-500/30' },
  rock:     { bg: 'bg-stone-500/20',   text: 'text-stone-400',   border: 'border-stone-500/30' },
  ghost:    { bg: 'bg-violet-700/20',  text: 'text-violet-400',  border: 'border-violet-500/30' },
  steel:    { bg: 'bg-slate-500/20',   text: 'text-slate-400',   border: 'border-slate-500/30' },
  normal:   { bg: 'bg-gray-500/20',    text: 'text-gray-400',    border: 'border-gray-500/30' },
};

const STAT_LABELS: Record<string, string> = {
  hp: 'HP', attack: 'Ataque', defense: 'Defensa',
  'special-attack': 'Sp. Ataque', 'special-defense': 'Sp. Defensa', speed: 'Velocidad',
};

interface PokemonDetail {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  height: number; // dm
  weight: number; // hg
  stats: { name: string; value: number }[];
  abilities: string[];
  genus: string;
  description: string;
  evolutionChain: { id: number; name: string; sprite: string }[];
}

async function fetchPokemonDetail(id: string): Promise<PokemonDetail | null> {
  try {
    const [pokemonRes, speciesRes] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    ]);
    if (!pokemonRes.ok || !speciesRes.ok) return null;

    const pokemon = await pokemonRes.json();
    const species = await speciesRes.json();

    // Descripción en español (o inglés si no hay)
    const descEntry =
      species.flavor_text_entries?.find((e: any) => e.language.name === 'es') ??
      species.flavor_text_entries?.find((e: any) => e.language.name === 'en');
    const description = (descEntry?.flavor_text ?? '').replace(/\f|\n/g, ' ');

    const genus =
      species.genera?.find((g: any) => g.language.name === 'es')?.genus ??
      species.genera?.find((g: any) => g.language.name === 'en')?.genus ?? '';

    // Cadena de evolución
    let evolutionChain: { id: number; name: string; sprite: string }[] = [];
    try {
      const evoRes = await fetch(species.evolution_chain.url);
      const evoData = await evoRes.json();

      const extractChain = (node: any): string[] => {
        const names: string[] = [node.species.name];
        for (const next of (node.evolves_to ?? [])) names.push(...extractChain(next));
        return names;
      };

      const evoNames = extractChain(evoData.chain);
      evolutionChain = await Promise.all(
        evoNames.map(async (name) => {
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
            if (!r.ok) return null;
            const d = await r.json();
            return {
              id: d.id,
              name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
              sprite: d.sprites.other?.['official-artwork']?.front_default ?? d.sprites.front_default ?? '',
            };
          } catch { return null; }
        })
      ).then(res => res.filter((e): e is { id: number; name: string; sprite: string } => e !== null));
    } catch { /* sin cadena de evolución */ }

    return {
      id: pokemon.id,
      name: pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
      sprite: pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default ?? '',
      types: pokemon.types.map((t: any) => t.type.name as string),
      height: pokemon.height,
      weight: pokemon.weight,
      stats: pokemon.stats.map((s: any) => ({ name: s.stat.name, value: s.base_stat })),
      abilities: pokemon.abilities.map((a: any) => a.ability.name.replace('-', ' ')),
      genus,
      description,
      evolutionChain,
    };
  } catch { return null; }
}

export function PokedexDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pokemon, setPokemon] = useState<PokemonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setPokemon(null);
    fetchPokemonDetail(id).then(data => {
      setPokemon(data);
      setLoading(false);
    });
  }, [id]);

  const primaryType = pokemon?.types[0] ?? 'normal';
  const typeStyle = TYPE_COLORS[primaryType] ?? TYPE_COLORS.normal;

  const prevId = pokemon && pokemon.id > 1 ? pokemon.id - 1 : null;
  const nextId = pokemon ? pokemon.id + 1 : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className={`relative px-4 pt-6 pb-8 ${typeStyle.bg}`}>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/pokedex')}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            {prevId && (
              <button onClick={() => navigate(`/pokedex/${prevId}`)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ChevronLeft size={18} />
              </button>
            )}
            {nextId && (
              <button onClick={() => navigate(`/pokedex/${nextId}`)}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
          </div>
        ) : pokemon ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-white/50">#{String(pokemon.id).padStart(4, '0')}</p>
            <img src={pokemon.sprite} alt={pokemon.name} className="w-40 h-40 object-contain drop-shadow-2xl" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">{pokemon.name}</h1>
              {pokemon.genus && <p className="text-sm text-white/50">{pokemon.genus}</p>}
            </div>
            <div className="flex gap-2">
              {pokemon.types.map(type => {
                const s = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
                return (
                  <span key={type} className={`${s.bg} ${s.text} border ${s.border} px-3 py-1 rounded-full text-xs font-semibold capitalize`}>
                    {type}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-10">No se encontró este Pokémon</p>
        )}
      </div>

      {pokemon && !loading && (
        <div className="px-4 pt-5 space-y-5">
          {/* Descripción */}
          {pokemon.description && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">Descripción</p>
              <p className="text-sm text-gray-300 leading-relaxed">{pokemon.description}</p>
            </div>
          )}

          {/* Info básica */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-white">{(pokemon.height / 10).toFixed(1)}m</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Altura</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-white">{(pokemon.weight / 10).toFixed(1)}kg</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Peso</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-xs font-bold text-white capitalize leading-snug">{pokemon.abilities[0] ?? '—'}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Habilidad</p>
            </div>
          </div>

          {/* Stats base */}
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Stats base</p>
            <div className="space-y-2.5">
              {pokemon.stats.map(stat => {
                const pct = Math.min(100, Math.round((stat.value / 255) * 100));
                return (
                  <div key={stat.name} className="flex items-center gap-3">
                    <p className="text-xs text-gray-500 w-24 shrink-0">{STAT_LABELS[stat.name] ?? stat.name}</p>
                    <div className="flex-1 bg-white/10 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${typeStyle.bg.replace('/20', '/60')}`}
                        style={{ width: `${pct}%`, backgroundColor: 'currentColor' }}
                      />
                    </div>
                    <p className="text-xs font-bold text-white w-8 text-right">{stat.value}</p>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 pt-1 border-t border-white/8">
                <p className="text-xs text-gray-500 w-24 shrink-0 font-semibold">Total</p>
                <div className="flex-1" />
                <p className="text-xs font-bold text-white w-8 text-right">
                  {pokemon.stats.reduce((s, st) => s + st.value, 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Cadena de evolución */}
          {pokemon.evolutionChain.length > 1 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-semibold">Evoluciones</p>
              <div className="flex items-center justify-around">
                {pokemon.evolutionChain.map((evo, i) => (
                  <div key={evo.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-gray-600 text-lg">→</span>}
                    <button
                      onClick={() => navigate(`/pokedex/${evo.id}`)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${evo.id === pokemon.id ? `${typeStyle.bg} border ${typeStyle.border}` : 'hover:bg-white/5'}`}
                    >
                      <img src={evo.sprite} alt={evo.name} className="w-14 h-14 object-contain" />
                      <p className="text-[10px] text-gray-400">#{String(evo.id).padStart(3, '0')}</p>
                      <p className="text-xs font-medium text-white">{evo.name}</p>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Habilidades */}
          {pokemon.abilities.length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">Habilidades</p>
              <div className="flex flex-wrap gap-2">
                {pokemon.abilities.map(ability => (
                  <span key={ability} className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white capitalize">
                    {ability}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}