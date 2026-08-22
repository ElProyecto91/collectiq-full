import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Package, DollarSign } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface CollectionItem {
  quantity: number;
  purchase_price: number | null;
  market_value: number | null;
  funko_items: {
    name: string;
    franchise: string | null;
  } | null;
}

export function FunkoStatsPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    supabase
      .from('funko_collection')
      .select('quantity, purchase_price, market_value, funko_items(name, franchise)')
      .eq('telegram_user_id', telegramUser.id)
      .then(({ data }) => {
        setItems((data as any) ?? []);
        setIsLoading(false);
      });
  }, [telegramUser?.id]);

  const totalFunkos = items.reduce((s, i) => s + i.quantity, 0);
  const totalInvested = items.reduce((s, i) => s + ((i.purchase_price ?? 0) * i.quantity), 0);
  const totalValue = items.reduce((s, i) => s + ((i.market_value ?? 0) * i.quantity), 0);
  const roi = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
  const profit = totalValue - totalInvested;

  // Top por valor
  const topByValue = [...items]
    .filter(i => i.market_value)
    .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
    .slice(0, 5);

  // Por franquicia
  const byFranchise: Record<string, number> = {};
  items.forEach(i => {
    const f = i.funko_items?.franchise ?? 'Otros';
    byFranchise[f] = (byFranchise[f] ?? 0) + i.quantity;
  });
  const franchiseList = Object.entries(byFranchise)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-green-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Estadísticas</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Cargando...</div>
      ) : (
        <div className="px-4 space-y-4">

          {/* Resumen */}
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

          {/* Beneficio/pérdida */}
          {totalInvested > 0 && (
            <div className={'bg-[#111118] border rounded-2xl p-4 ' + (profit >= 0 ? 'border-green-500/20' : 'border-red-500/20')}>
              <p className="text-xs text-gray-400 mb-1">Beneficio / Pérdida</p>
              <p className={'text-2xl font-bold ' + (profit >= 0 ? 'text-green-400' : 'text-red-400')}>
                {profit >= 0 ? '+' : ''}€{profit.toFixed(2)}
              </p>
            </div>
          )}

          {/* Top por valor */}
          {topByValue.length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Top por valor</p>
              {topByValue.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                    <p className="text-xs text-white truncate max-w-[180px]">{item.funko_items?.name ?? 'Funko'}</p>
                  </div>
                  <p className="text-xs text-green-400 font-bold">€{(item.market_value ?? 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Por franquicia */}
          {franchiseList.length > 0 && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por franquicia</p>
              {franchiseList.map(([franchise, count]) => (
                <div key={franchise} className="flex items-center justify-between">
                  <p className="text-xs text-white truncate max-w-[200px]">{franchise}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-white/10 rounded-full h-1.5">
                      <div className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round((count / totalFunkos) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                  </div>
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