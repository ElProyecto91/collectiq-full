import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';

interface FunkoItem {
  id: string;
  name: string;
  franchise: string | null;
  series: string | null;
  image_url: string | null;
  type: string | null;
}

export function FunkoExplorerPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FunkoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      const { data } = await supabase
        .from('funko_items')
        .select('id, name, franchise, series, image_url, type')
        .ilike('name', `%${query.trim()}%`)
        .limit(40);
      setResults(data ?? []);
      setIsLoading(false);
    }, 400);
  }, [query]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Explorador Funko</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">
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

        {/* Estados */}
        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">Buscando...</div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No se encontraron resultados para "{query}"
          </div>
        )}

        {!isLoading && !hasSearched && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Escribe al menos 2 caracteres para buscar entre 23.000+ Funkos
          </div>
        )}

        {/* Resultados */}
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
                    {item.series && (
                      <p className="text-[10px] text-gray-500 truncate">{item.series}</p>
                    )}
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