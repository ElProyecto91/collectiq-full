import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ScanLine, Heart, BarChart2, Plus, Search } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import type { FunkoCollectionItem } from '@/types/funko';

export function FunkoHomePage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [collection, setCollection] = useState<FunkoCollectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadCollection();
  }, [telegramUser?.id]);

  const loadCollection = async () => {
    if (!telegramUser?.id) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('funko_collection')
      .select('*, funko_items(*)')
      .eq('telegram_user_id', telegramUser.id)
      .order('created_at', { ascending: false });
    setCollection(data ?? []);
    setIsLoading(false);
  };

  const totalFunkos = collection.reduce((s, f) => s + f.quantity, 0);
  const totalValue = collection.reduce((s, f) => s + ((f.market_value ?? 0) * f.quantity), 0);
  const totalInvested = collection.reduce((s, f) => s + ((f.purchase_price ?? 0) * f.quantity), 0);
  const roi = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

const exportCSV = async () => {
    if (!telegramUser?.id) return;
    const { data } = await supabase
      .from('funko_collection')
      .select('*, funko_items(name, franchise, series, number)')
      .eq('telegram_user_id', telegramUser.id);

    if (!data || data.length === 0) return;

    const headers = ['Nombre', 'Franquicia', 'Serie', 'Número', 'Cantidad', 'Condición', 'Caja', 'Precio pagado', 'Valor mercado', 'ROI%', 'Carpeta', 'Ubicación', 'En venta', 'Intercambio', 'Notas'];
    const rows = data.map((item: any) => {
      const roi = item.purchase_price && item.market_value
        ? (((item.market_value - item.purchase_price) / item.purchase_price) * 100).toFixed(1) + '%'
        : '';
      return [
        item.funko_items?.name ?? item.custom_name ?? '',
        item.funko_items?.franchise ?? '',
        item.funko_items?.series ?? '',
        item.funko_items?.number ?? '',
        item.quantity,
        item.condition ?? '',
        item.box_condition ?? '',
        item.purchase_price ?? '',
        item.market_value ?? '',
        roi,
        item.folder ?? '',
        item.location ?? '',
        item.is_for_sale ? 'Sí' : 'No',
        item.is_for_trade ? 'Sí' : 'No',
        item.notes ?? '',
      ].map(v => `"${v}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collectiq_funkos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.Home)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
          <h1 className="text-lg font-bold">Funko Pop 🎭</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Funkos', value: totalFunkos, color: 'text-purple-400' },
            { label: 'Valor', value: totalValue > 0 ? '€' + totalValue.toFixed(0) : '—', color: 'text-green-400' },
            { label: 'ROI', value: totalInvested > 0 ? (roi >= 0 ? '+' : '') + roi.toFixed(0) + '%' : '—', color: roi >= 0 ? 'text-green-400' : 'text-red-400' },
          ].map(item => (
            <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={'text-lg font-bold ' + item.color}>{item.value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate(RoutePaths.FunkoScanner)}
            className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <ScanLine size={24} className="text-purple-400" />
            <p className="text-sm font-bold text-white">Escanear</p>
            <p className="text-[10px] text-gray-400 text-center">Código de barras o foto</p>
          </button>
          <button onClick={() => navigate(RoutePaths.FunkoExplorer)}
            className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <Search size={24} className="text-blue-400" />
            <p className="text-sm font-bold text-white">Explorador</p>
            <p className="text-[10px] text-gray-400 text-center">Buscar en el catálogo</p>
          </button>
          <button onClick={() => navigate(RoutePaths.FunkoWishlist)}
            className="bg-gradient-to-r from-red-600/20 to-pink-600/20 border border-red-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <Heart size={24} className="text-red-400" />
            <p className="text-sm font-bold text-white">Wishlist</p>
            <p className="text-[10px] text-gray-400 text-center">Funkos que quieres</p>
          </button>
          <button onClick={() => navigate(RoutePaths.FunkoStats)}
            className="bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <BarChart2 size={24} className="text-green-400" />
            <p className="text-sm font-bold text-white">Estadísticas</p>
            <p className="text-[10px] text-gray-400 text-center">Valor y ROI</p>
          </button>
          <button onClick={() => navigate(RoutePaths.FunkoChecklist)}
            className="col-span-2 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <span className="text-2xl">📋</span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Checklist</p>
              <p className="text-[10px] text-gray-400">Ver qué te falta por franquicia</p>
            </div>
          </button>
          <button onClick={() => navigate(RoutePaths.FunkoFolders)}
            className="col-span-2 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <span className="text-2xl">📁</span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Mis carpetas</p>
              <p className="text-[10px] text-gray-400">Organiza tu colección</p>
            </div>
          </button>
          <button onClick={exportCSV}
            className="col-span-2 bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-95 transition-transform">
            <span className="text-2xl">📥</span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Exportar colección</p>
              <p className="text-[10px] text-gray-400">Descargar CSV</p>
            </div>
          </button>
        </div>

        {/* Colección reciente */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mi colección</p>
            <button onClick={() => navigate(RoutePaths.FunkoExplorer)}
              className="flex items-center gap-1 text-xs text-purple-400 active:scale-95">
              <Plus size={12} />Añadir
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
          ) : collection.length === 0 ? (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-6 text-center space-y-3">
              <p className="text-4xl">🎭</p>
              <p className="text-sm font-bold text-white">Tu colección Funko está vacía</p>
              <p className="text-xs text-gray-500">Escanea un Funko o búscalo en el explorador para añadirlo</p>
              <button onClick={() => navigate(RoutePaths.FunkoScanner)}
                className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-bold active:scale-95 transition-transform">
                Escanear mi primer Funko
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {collection.slice(0, 6).map(item => (
                <button key={item.id}
                  onClick={() => navigate('/funko/' + item.funko_id)}
                  className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden text-left active:scale-95 transition-transform">
                  <div className="aspect-square bg-white/5 flex items-center justify-center">
                    {item.image_url || item.funko_items?.image_url ? (
                      <img
                        src={item.image_url ?? item.funko_items?.image_url ?? ''}
                        alt={item.custom_name ?? item.funko_items?.name ?? ''}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-4xl">🎭</span>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-bold truncate">
                      {item.custom_name ?? item.funko_items?.name ?? ''}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {item.funko_items?.franchise ?? '—'}
                    </p>
                    {item.market_value && (
                      <p className="text-[10px] text-green-400 font-medium">
                        €{item.market_value.toFixed(2)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}