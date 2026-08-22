import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Folder, ChevronRight, Plus } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface FolderStats {
  name: string;
  count: number;
  value: number;
}

interface CollectionItemWithFunko {
  id: string;
  funko_id: string;
  folder: string | null;
  market_value: number | null;
  quantity: number;
  is_for_sale: boolean;
  is_for_trade: boolean;
  funko_items: {
    name: string;
    image_url: string | null;
    franchise: string | null;
  } | null;
}

export function FunkoFoldersPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [folders, setFolders] = useState<FolderStats[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<CollectionItemWithFunko[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadFolders();
  }, [telegramUser?.id]);

  const loadFolders = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('funko_collection')
      .select('folder, market_value, quantity')
      .eq('telegram_user_id', telegramUser!.id);

    const folderMap: Record<string, { count: number; value: number }> = {};
    data?.forEach(item => {
      const f = item.folder ?? 'Sin carpeta';
      if (!folderMap[f]) folderMap[f] = { count: 0, value: 0 };
      folderMap[f].count += item.quantity;
      folderMap[f].value += (item.market_value ?? 0) * item.quantity;
    });

    setFolders(Object.entries(folderMap).map(([name, stats]) => ({
      name,
      count: stats.count,
      value: stats.value,
    })).sort((a, b) => b.count - a.count));
    setIsLoading(false);
  };

  const loadFolderItems = async (folderName: string) => {
    setIsLoadingItems(true);
    setSelectedFolder(folderName);
    const query = folderName === 'Sin carpeta'
      ? supabase.from('funko_collection').select('id, funko_id, folder, market_value, quantity, is_for_sale, is_for_trade, funko_items(name, image_url, franchise)').eq('telegram_user_id', telegramUser!.id).is('folder', null)
      : supabase.from('funko_collection').select('id, funko_id, folder, market_value, quantity, is_for_sale, is_for_trade, funko_items(name, image_url, franchise)').eq('telegram_user_id', telegramUser!.id).eq('folder', folderName);
    const { data } = await query;
    setFolderItems((data as any) ?? []);
    setIsLoadingItems(false);
  };

  const folderEmoji = (name: string) => {
    if (name.includes('vender')) return '💰';
    if (name.includes('intercambiar') || name.includes('intercambio')) return '🔄';
    if (name.includes('Grail')) return '🏆';
    if (name.includes('Marvel')) return '🦸';
    if (name.includes('Disney')) return '🏰';
    if (name.includes('Star Wars')) return '⚔️';
    if (name.includes('Anime')) return '🎌';
    if (name.includes('Convention')) return '🎪';
    if (name === 'Sin carpeta') return '📦';
    return '📁';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => selectedFolder ? setSelectedFolder(null) : navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">{selectedFolder ?? 'Mis carpetas'}</h1>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {!selectedFolder ? (
          <>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : folders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Folder className="w-10 h-10 text-gray-700 mx-auto" />
                <p className="text-gray-500 text-sm">No tienes carpetas aún</p>
                <p className="text-xs text-gray-600">Edita un Funko de tu colección para asignarlo a una carpeta</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500">{folders.length} carpetas</p>
                {folders.map(folder => (
                  <button key={folder.name}
                    onClick={() => loadFolderItems(folder.name)}
                    className="w-full bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
                    <span className="text-2xl shrink-0">{folderEmoji(folder.name)}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-white truncate">{folder.name}</p>
                      <p className="text-xs text-gray-500">{folder.count} Funkos · {folder.value > 0 ? `€${folder.value.toFixed(0)}` : 'sin valor'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                  </button>
                ))}
                <div className="bg-[#111118] border border-dashed border-white/10 rounded-2xl p-4 flex items-center gap-3">
                  <Plus className="w-5 h-5 text-gray-600" />
                  <p className="text-xs text-gray-600">Edita un Funko para crear carpetas personalizadas</p>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {isLoadingItems ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{folderItems.length} Funkos</p>
                {folderItems.map(item => (
                  <div key={item.id}
                    onClick={() => navigate(`/funko/${item.funko_id}`)}
                    className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer">
                    <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.funko_items?.image_url ? (
                        <img src={item.funko_items.image_url} alt={item.funko_items.name}
                          className="w-full h-full object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : <span className="text-2xl">🎭</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.funko_items?.name ?? 'Funko'}</p>
                      {item.funko_items?.franchise && <p className="text-xs text-purple-400 truncate">{item.funko_items.franchise}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.market_value && <span className="text-[10px] text-green-400">€{item.market_value.toFixed(0)}</span>}
                        {item.is_for_sale && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">VENTA</span>}
                        {item.is_for_trade && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">INTERCAMBIO</span>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/funko/edit/${item.id}`); }}
                      className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <span className="text-xs">✏️</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}