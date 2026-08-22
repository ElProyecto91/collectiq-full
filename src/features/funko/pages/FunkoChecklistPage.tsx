import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface FranchiseStats {
  franchise: string;
  total: number;
  owned: number;
}

interface FunkoInSeries {
  id: string;
  name: string;
  image_url: string | null;
  number: string | null;
  is_chase: boolean;
  owned: boolean;
}

export function FunkoChecklistPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [franchises, setFranchises] = useState<FranchiseStats[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [series, setSeries] = useState<FunkoInSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadFranchises();
  }, [telegramUser?.id]);

  const loadFranchises = async () => {
    setIsLoading(true);

    // Obtener todas las franquicias del catálogo
    const { data: allFranchises } = await supabase
      .from('funko_items')
      .select('franchise')
      .not('franchise', 'is', null);

    // Contar por franquicia
    const franchiseCount: Record<string, number> = {};
    allFranchises?.forEach(item => {
      const f = item.franchise ?? 'Otros';
      franchiseCount[f] = (franchiseCount[f] ?? 0) + 1;
    });

    // Obtener colección del usuario
    const { data: collection } = await supabase
      .from('funko_collection')
      .select('funko_id, funko_items(franchise)')
      .eq('telegram_user_id', telegramUser!.id);

    const ownedByFranchise: Record<string, number> = {};
    collection?.forEach((item: any) => {
      const f = item.funko_items?.franchise ?? 'Otros';
      ownedByFranchise[f] = (ownedByFranchise[f] ?? 0) + 1;
    });

    const result = Object.entries(franchiseCount)
      .map(([franchise, total]) => ({
        franchise,
        total,
        owned: ownedByFranchise[franchise] ?? 0,
      }))
      .filter(f => f.total >= 3)
      .sort((a, b) => b.owned - a.owned || b.total - a.total);

    setFranchises(result);
    setIsLoading(false);
  };

  const loadSeries = async (franchise: string) => {
    setIsLoadingSeries(true);
    setSelected(franchise);
    setSeries([]);

    const { data: items } = await supabase
      .from('funko_items')
      .select('id, name, image_url, number, is_chase')
      .eq('franchise', franchise)
      .order('number', { ascending: true });

    const { data: collection } = await supabase
      .from('funko_collection')
      .select('funko_id')
      .eq('telegram_user_id', telegramUser!.id);

    const ownedIds = new Set(collection?.map(c => c.funko_id) ?? []);

    setSeries((items ?? []).map(item => ({
      ...item,
      owned: ownedIds.has(item.id),
    })));
    setIsLoadingSeries(false);
  };

  const addToWishlist = async (funkoId: string) => {
    if (!telegramUser?.id) return;
    await supabase.from('funko_wishlist').upsert({
      telegram_user_id: telegramUser.id,
      funko_id: funkoId,
      priority: 2,
    }, { onConflict: 'telegram_user_id,funko_id' });
  };

  const filtered = franchises.filter(f =>
    f.franchise.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => selected ? setSelected(null) : navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">{selected ?? 'Checklist'}</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Lista de franquicias */}
        {!selected && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar franquicia..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50" />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{filtered.length} franquicias</p>
                {filtered.map(f => {
                  const pct = Math.round((f.owned / f.total) * 100);
                  return (
                    <button key={f.franchise} onClick={() => loadSeries(f.franchise)}
                      className="w-full bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-white truncate">{f.franchise}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-white/10 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0">{f.owned}/{f.total}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${pct === 100 ? 'text-green-400' : pct > 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {pct}%
                        </p>
                        <ChevronRight className="w-4 h-4 text-gray-600 ml-auto mt-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Detalle de franquicia */}
        {selected && (
          <>
            {isLoadingSeries ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : (
              <>
                {/* Resumen */}
                {series.length > 0 && (
                  <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-white">
                        {series.filter(s => s.owned).length}/{series.length} completados
                      </p>
                      <p className="text-sm font-bold text-purple-400">
                        {Math.round((series.filter(s => s.owned).length / series.length) * 100)}%
                      </p>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.round((series.filter(s => s.owned).length / series.length) * 100)}%` }} />
                    </div>
                    {series.some(s => !s.owned) && (
                      <button
                        onClick={async () => {
                          const missing = series.filter(s => !s.owned);
                          await Promise.all(missing.map(s => addToWishlist(s.id)));
                          alert(`✅ ${missing.length} Funkos añadidos a tu wishlist`);
                        }}
                        className="w-full py-2 rounded-xl bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-bold active:scale-95">
                        ❤️ Añadir {series.filter(s => !s.owned).length} faltantes a Wishlist
                      </button>
                    )}
                  </div>
                )}

                {/* Lista */}
                <div className="space-y-2">
                  {series.map(item => (
                    <div key={item.id}
                      onClick={() => navigate(`/funko/${item.id}`)}
                      className={`bg-[#111118] border rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer ${
                        item.owned ? 'border-green-500/20' : 'border-white/8'
                      }`}>
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name}
                            className="w-full h-full object-contain"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-xl">🎭</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.number && <span className="text-[10px] text-gray-500">#{item.number}</span>}
                          {item.is_chase && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">CHASE</span>}
                        </div>
                      </div>
                      {item.owned
                        ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        : <Circle className="w-5 h-5 text-gray-700 shrink-0" />
                      }
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}