import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Trash2, Search } from 'lucide-react';
import { RoutePaths } from '@/config';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface WishlistItem {
  id: string;
  funko_id: string;
  target_price: number | null;
  condition: string | null;
  priority: number | null;
  notes: string | null;
  created_at: string;
  funko_items: {
    name: string;
    franchise: string | null;
    series: string | null;
    image_url: string | null;
  } | null;
}

export function FunkoWishlistPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadWishlist();
  }, [telegramUser?.id]);

  const loadWishlist = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('funko_wishlist')
      .select(`
        id, funko_id, target_price, condition, priority, notes, created_at,
        funko_items (name, franchise, series, image_url)
      `)
      .eq('telegram_user_id', telegramUser!.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });
    setItems((data as any) ?? []);
    setIsLoading(false);
  };

  const removeFromWishlist = async (id: string) => {
    await supabase.from('funko_wishlist').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
    setStatusMsg('✅ Eliminado de la wishlist');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const priorityLabel = (p: number | null) => {
    if (p === 1) return { label: 'Alta', color: 'text-red-400' };
    if (p === 2) return { label: 'Media', color: 'text-yellow-400' };
    return { label: 'Baja', color: 'text-gray-400' };
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold">Wishlist Funko</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Heart className="w-10 h-10 text-gray-700 mx-auto" />
            <p className="text-gray-500 text-sm">Tu wishlist está vacía</p>
            <button onClick={() => navigate(RoutePaths.FunkoExplorer)}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold">
              <Search className="w-4 h-4" />
              Explorar Funkos
            </button>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{items.length} Funkos en tu wishlist</p>
            {items.map(item => {
              const funko = item.funko_items;
              const prio = priorityLabel(item.priority);
              return (
                <div key={item.id}
                  className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3">
                  <div
                    onClick={() => navigate(`/funko/${item.funko_id}`)}
                    className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer">
                    {funko?.image_url ? (
                      <img src={funko.image_url} alt={funko.name}
                        className="w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-2xl">🎭</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/funko/${item.funko_id}`)}>
                    <p className="text-sm font-bold text-white truncate">{funko?.name ?? 'Funko'}</p>
                    {funko?.franchise && (
                      <p className="text-xs text-purple-400 truncate">{funko.franchise}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold ${prio.color}`}>● {prio.label}</span>
                      {item.target_price && (
                        <span className="text-[10px] text-gray-500">Objetivo: {item.target_price}€</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => removeFromWishlist(item.id)}
                    className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 active:scale-95">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}