import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

// Mapeo de líneas a tipo legible
const LINE_LABELS: Record<string, string> = {
  pop: '🎭 Pop',
  soda: '🥤 Soda',
  rides: '🚗 Rides',
  moments: '🎬 Moments',
  gold: '✨ Gold',
  bitty: '🔬 Bitty Pop',
  deluxe: '📦 Deluxe',
  digital: '💻 Digital',
  '8bit': '🕹️ 8-Bit',
  albums: '🎵 Albums',
  rewind: '📼 Rewind',
  otros: '❓ Otros',
};

interface FranchiseStats {
  franchise: string;
  total: number;
  owned: number;
  funko_type: string;
}

interface FunkoInSeries {
  id: string;
  name: string;
  image_url: string | null;
  number: string | null;
  is_chase: boolean;
  funko_type: string;
  owned: boolean;
}

export function FunkoChecklistPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [franchises, setFranchises] = useState<FranchiseStats[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [series, setSeries] = useState<FunkoInSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadFranchises();
  }, [telegramUser?.id]);

  const loadFranchises = async () => {
    setIsLoading(true);

    // Obtener franquicias desde catalog_items (nuevo catálogo completo)
    const { data: catalogItems } = await supabase
      .from('catalog_items')
      .select('franchise, funko_type')
      .eq('tcg', 'funko')
      .not('franchise', 'is', null);

    // Contar por franquicia + tipo
    const franchiseMap: Record<string, { total: number; funko_type: string }> = {};
    catalogItems?.forEach(item => {
      const f = item.franchise ?? 'Otros';
      const key = `${f}|||${item.funko_type ?? 'pop'}`;
      if (!franchiseMap[key]) franchiseMap[key] = { total: 0, funko_type: item.funko_type ?? 'pop' };
      franchiseMap[key].total++;
    });

    // También contar desde funko_items (catálogo legacy)
    const { data: legacyItems } = await supabase
      .from('funko_items')
      .select('franchise')
      .not('franchise', 'is', null);

    legacyItems?.forEach(item => {
      const f = item.franchise ?? 'Otros';
      const key = `${f}|||pop`;
      if (!franchiseMap[key]) franchiseMap[key] = { total: 0, funko_type: 'pop' };
      franchiseMap[key].total++;
    });

    // Obtener colección del usuario (funko_collection legacy)
    const { data: collection } = await supabase
      .from('funko_collection')
      .select('funko_id, funko_items(franchise)')
      .eq('telegram_user_id', telegramUser!.id);

    const ownedByFranchise: Record<string, number> = {};
    collection?.forEach((item: any) => {
      const f = item.funko_items?.franchise ?? 'Otros';
      const key = `${f}|||pop`;
      ownedByFranchise[key] = (ownedByFranchise[key] ?? 0) + 1;
    });

    // También colección desde user_collection (nuevo sistema)
    const { data: newCollection } = await supabase
      .from('user_collection')
      .select('catalog_item_id, catalog_items(franchise, funko_type)')
      .eq('telegram_user_id', telegramUser!.id)
      .eq('catalog_items.tcg', 'funko');

    newCollection?.forEach((item: any) => {
      const f = item.catalog_items?.franchise ?? 'Otros';
      const t = item.catalog_items?.funko_type ?? 'pop';
      const key = `${f}|||${t}`;
      ownedByFranchise[key] = (ownedByFranchise[key] ?? 0) + 1;
    });

    const result = Object.entries(franchiseMap)
      .map(([key, { total, funko_type }]) => {
        const [franchise] = key.split('|||');
        return {
          franchise: franchise || 'Otros',
          funko_type,
          total,
          owned: ownedByFranchise[key] ?? 0,
        };
      })
      .filter(f => f.total >= 2)
      .sort((a, b) => b.owned - a.owned || b.total - a.total);

    setFranchises(result);
    setIsLoading(false);
  };

  const loadSeries = async (franchise: string, funko_type: string) => {
    setIsLoadingSeries(true);
    setSelected(franchise);
    setSelectedType(funko_type);
    setSeries([]);

    // Cargar desde catalog_items
    const { data: catalogItems } = await supabase
      .from('catalog_items')
      .select('id, name, image_url, number, is_chase, funko_type')
      .eq('tcg', 'funko')
      .eq('franchise', franchise)
      .eq('funko_type', funko_type)
      .order('number', { ascending: true });

    // Cargar desde funko_items (legacy) si tipo es pop
    let legacyItems: any[] = [];
    if (funko_type === 'pop') {
      const { data } = await supabase
        .from('funko_items')
        .select('id, name, image_url, number, is_chase')
        .eq('franchise', franchise)
        .order('number', { ascending: true });
      legacyItems = data ?? [];
    }

    // Combinar y deduplicar por nombre
    const allItems = [...(catalogItems ?? []), ...legacyItems];
    const seen = new Set<string>();
    const unique = allItems.filter(item => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Colección del usuario
    const { data: collection } = await supabase
      .from('funko_collection')
      .select('funko_id')
      .eq('telegram_user_id', telegramUser!.id);
    const { data: newCollection } = await supabase
      .from('user_collection')
      .select('catalog_item_id')
      .eq('telegram_user_id', telegramUser!.id);

    const ownedIds = new Set([
      ...(collection?.map(c => c.funko_id) ?? []),
      ...(newCollection?.map(c => c.catalog_item_id) ?? []),
    ]);

    setSeries(unique.map(item => ({
      id: item.id,
      name: item.name,
      image_url: item.image_url,
      number: item.number ?? null,
      is_chase: item.is_chase ?? false,
      funko_type: item.funko_type ?? funko_type,
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

  // Tipos únicos disponibles
  const availableTypes = [...new Set(franchises.map(f => f.funko_type))].sort();

  const filtered = franchises.filter(f => {
    const matchSearch = f.franchise.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || f.funko_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => selected ? setSelected(null) : navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">
            {selected ? `${selected} · ${LINE_LABELS[selectedType] ?? selectedType}` : 'Checklist'}
          </h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {!selected && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar franquicia..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50" />
            </div>

            {/* Filtro por tipo */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              <button onClick={() => setTypeFilter('')}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  !typeFilter ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/5 border-white/10 text-gray-400'
                }`}>
                Todos
              </button>
              {availableTypes.map(type => (
                <button key={type} onClick={() => setTypeFilter(type)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    typeFilter === type ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/5 border-white/10 text-gray-400'
                  }`}>
                  {LINE_LABELS[type] ?? type}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{filtered.length} franquicias</p>
                {filtered.map(f => {
                  const pct = Math.round((f.owned / f.total) * 100);
                  return (
                    <button key={`${f.franchise}-${f.funko_type}`}
                      onClick={() => loadSeries(f.franchise, f.funko_type)}
                      className="w-full bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{f.franchise}</p>
                          <span className="text-[9px] text-gray-500 shrink-0">
                            {LINE_LABELS[f.funko_type] ?? f.funko_type}
                          </span>
                        </div>
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

        {selected && (
          <>
            {isLoadingSeries ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : (
              <>
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
                          <span className="text-[9px] text-gray-600">{LINE_LABELS[item.funko_type] ?? item.funko_type}</span>
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
