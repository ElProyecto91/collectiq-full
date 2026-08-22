import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Package, DollarSign, RefreshCw, Trophy, Tag } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface CollectionItem {
  id: string;
  quantity: number;
  purchase_price: number | null;
  market_value: number | null;
  condition: string | null;
  is_for_sale: boolean;
  is_for_trade: boolean;
  funko_items: {
    name: string;
    franchise: string | null;
    is_chase: boolean;
  } | null;
}

export function FunkoStatsPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadStats();
  }, [telegramUser?.id]);

  const loadStats = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('funko_collection')
      .select('id, quantity, purchase_price, market_value, condition, is_for_sale, is_for_trade, funko_items(name, franchise, is_chase)')
      .eq('telegram_user_id', telegramUser!.id);
    setItems((data as any) ?? []);
    setIsLoading(false);
  };

  const refreshAllPrices = async () => {
    setIsRefreshing(true);
    let updated = 0;
    for (const item of items) {
      if (!item.funko_items?.name) continue;
      setRefreshProgress(`Actualizando ${updated + 1}/${items.length}...`);
      try {
        const res = await fetch(`/api/funko-price?name=${encodeURIComponent(item.funko_items.name)}`);
        const data = await res.json();
        if (data.price) {
          await supabase.from('funko_collection').update({ market_value: data.price }).eq('id', item.id);
          // Guardar en histórico
          await supabase.from('funko_price_history').insert({
            funko_id: item.id,
            price: data.price,
            source: 'ebay',
            recorded_at: new Date().toISOString(),
          });
          updated++;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    setRefreshProgress(`✅ ${updated} precios actualizados`);
    await loadStats();
    setIsRefreshing(false);
    setTimeout(() => setRefreshProgress(''), 4000);
  };

  const totalFunkos = items.reduce((s, i) => s + i.quantity, 0);
  const totalInvested = items.reduce((s, i) => s + ((i.purchase_price ?? 0) * i.quantity), 0);
  const totalValue = items.reduce((s, i) => s + ((i.market_value ?? 0) * i.quantity), 0);
  const roi = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const profit = totalValue - totalInvested;
  const chaseCount = items.filter(i => i.funko_items?.is_chase).length;
  const forSaleCount = items.filter(i => i.is_for_sale).length;
  const forTradeCount = items.filter(i => i.is_for_trade).length;

  const topByValue = [...items]
    .filter(i => i.market_value)
    .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
    .slice(0, 5);

  const byFranchise: Record<string, { count: number; value: number }> = {};
  items.forEach(i => {
    const f = i.funko_items?.franchise ?? 'Otros';
    if (!byFranchise[f]) byFranchise[f] = { count: 0, value: 0 };
    byFranchise[f].count += i.quantity;
    byFranchise[f].value += (i.market_value ?? 0) * i.quantity;
  });
  const franchiseList = Object.entries(byFranchise)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const conditionMap: Record<string, number> = {};
  items.forEach(i => {
    const c = i.condition ?? 'unknown';
    conditionMap[c] = (conditionMap[c] ?? 0) + i.quantity;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-green-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Estadísticas</h1>
        </div>
        <button onClick={refreshAllPrices} disabled={isRefreshing}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${isRefreshing ? 'bg-white/5' : 'bg-green-600/20 border border-green-500/30'}`}>
          <RefreshCw className={`w-4 h-4 text-green-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Cargando...</div>
      ) : (
        <div className="px-4 space-y-4">

          {refreshProgress && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-300 text-center">
              {refreshProgress}
            </div>
          )}

          {/* Resumen principal */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Funkos', value: totalFunkos.toString(), icon: <Package className="w-4 h-4" />, color: 'text-purple-400' },
              { label: 'Invertido', value: totalInvested > 0 ? '€' + totalInvested.toFixed(0) : '—', icon: <DollarSign className="w-4 h-4" />, color: 'text-blue-400' },
              { label: 'Valor actual', value: totalValue > 0 ? '€' + totalValue.toFixed(0) : '—', icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400' },
              {
                label: 'ROI',
                value: totalInvested > 0 ? (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%' : '—',
                icon: roi >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
                color: roi >= 0 ? 'text-green-400' : 'text-red-400',
              },
            ].map(item => (
              <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  {item.icon}
                  <p className="text-[10px] uppercase tracking-wider">{item.label}</p>
                </div>
                <p className={'text-xl font-bold ' + item.color}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Beneficio */}
          {totalInvested > 0 && (
            <div className={`bg-[#111118] border rounded-2xl p-4 ${profit >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <p className="text-xs text-gray-400 mb-1">Beneficio / Pérdida estimado</p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {profit >= 0 ? '+' : ''}€{profit.toFixed(2)}
              </p>
            </div>
          )}

          {/* Stats extras */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-yellow-400">{chaseCount}</p>
              <p className="text-[10px] text-gray-500">Chase</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-green-400">{forSaleCount}</p>
              <p className="text-[10px] text-gray-500">En venta</p>
            </div>
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-blue-400">{forTradeCount}</p>
              <p className="text-[10px] text-gray-500">Intercambio</p>
            </div>
          </div>

          {/* Top por valor */}
          {topByValue.length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Top por valor</p>
              </div>
              {topByValue.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {i + 1}
                    </span>
                    <p className="text-xs text-white truncate max-w-[170px]">{item.funko_items?.name ?? 'Funko'}</p>
                  </div>
                  <p className="text-xs text-green-400 font-bold">€{(item.market_value ?? 0).toFixed(0)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Por franquicia */}
          {franchiseList.length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por franquicia</p>
              {franchiseList.map(([franchise, stats]) => (
                <div key={franchise} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white truncate max-w-[150px]">{franchise}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">{stats.count} Funkos</span>
                      {stats.value > 0 && <span className="text-[10px] text-green-400">€{stats.value.toFixed(0)}</span>}
                    </div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="bg-purple-500 h-1 rounded-full"
                      style={{ width: `${Math.round((stats.count / totalFunkos) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Por condición */}
          {Object.keys(conditionMap).length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-400" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por condición</p>
              </div>
              {Object.entries(conditionMap).map(([condition, count]) => (
                <div key={condition} className="flex items-center justify-between">
                  <span className="text-xs text-white capitalize">{condition.replace('_', ' ')}</span>
                  <span className="text-xs text-purple-400 font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}

          {totalFunkos === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Añade Funkos a tu colección para ver estadísticas
            </div>
          )}
        </div>
      )}
    </div>
  );
}