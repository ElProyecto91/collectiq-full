import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X, Filter, ChevronDown } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';

interface FunkoItem {
  id: string;
  name: string;
  franchise: string | null;
  series: string | null;
  image_url: string | null;
  type: string | null;
  is_chase: boolean;
  is_flocked: boolean;
  is_glow: boolean;
  exclusivity: string | null;
}

const FILTER_TYPES = [
  { key: 'all', label: 'Todos' },
  { key: 'chase', label: '⭐ Chase' },
  { key: 'flocked', label: '🧸 Flocked' },
  { key: 'glow', label: '✨ Glow' },
  { key: 'exclusive', label: '🏪 Exclusivo' },
];

export function FunkoExplorerPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FunkoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [franchiseFilter, setFranchiseFilter] = useState('');
  const [franchises, setFranchises] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar franquicias populares
  useEffect(() => {
    supabase
      .from('funko_items')
      .select('franchise')
      .not('franchise', 'is', null)
      .limit(500)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        data?.forEach(d => {
          if (d.franchise) counts[d.franchise] = (counts[d.franchise] ?? 0) + 1;
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([f]) => f);
        setFranchises(sorted);
      });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2 && !franchiseFilter) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      let q = supabase
        .from('funko_items')
        .select('id, name, franchise, series, image_url, type, is_chase, is_flocked, is_glow, exclusivity');

      if (query.trim().length >= 2) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      if (franchiseFilter) {
        q = q.eq('franchise', franchiseFilter);
      }
      if (activeFilter === 'chase') q = q.eq('is_chase', true);
      if (activeFilter === 'flocked') q = q.eq('is_flocked', true);
      if (activeFilter === 'glow') q = q.eq('is_glow', true);
      if (activeFilter === 'exclusive') q = q.not('exclusivity', 'is', null);

      const { data } = await q.limit(40);
      setResults(data ?? []);
      setIsLoading(false);
    }, 400);
  }, [query, activeFilter, franchiseFilter]);

  const handleFranchiseFilter = (f: string) => {
    setFranchiseFilter(prev => prev === f ? '' : f);
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Explorador Funko</h1>
        </div>
        <button onClick={() => setShowFilters(p => !p)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${showFilters ? 'bg-purple-600' : 'bg-white/10'}`}>
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 space-y-3">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar Funko Pop..."
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          {query.length > 0 && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_TYPES.map(f => (
            <button key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeFilter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-gray-400'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtro por franquicia */}
        {showFilters && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Franquicia</p>
            <div className="flex flex-wrap gap-2">
              {franchises.map(f => (
                <button key={f}
                  onClick={() => handleFranchiseFilter(f)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                    franchiseFilter === f
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            {franchiseFilter && (
              <button onClick={() => setFranchiseFilter('')}
                className="text-xs text-red-400">
                ✕ Quitar filtro
              </button>
            )}
          </div>
        )}

        {/* Filtro activo */}
        {franchiseFilter && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
            <span className="text-xs text-purple-300">Franquicia: <strong>{franchiseFilter}</strong></span>
            <button onClick={() => setFranchiseFilter('')} className="ml-auto">
              <X className="w-3 h-3 text-purple-400" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">Buscando...</div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No se encontraron resultados
          </div>
        )}

        {!isLoading && !hasSearched && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Escribe al menos 2 caracteres para buscar entre 23.000+ Funkos
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{results.length} resultados</p>
            <div className="grid grid-cols-1 gap-2">
              {results.map(item => (
                <div key={item.id}
                  onClick={() => navigate(`/funko/${item.id}`)}
                  className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name}
                        className="w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-2xl">🎭</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                    {item.franchise && (
                      <p className="text-xs text-purple-400 truncate">{item.franchise}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {item.is_chase && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">CHASE</span>}
                      {item.is_flocked && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">FLOCKED</span>}
                      {item.is_glow && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">GLOW</span>}
                      {item.exclusivity && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">{item.exclusivity}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}