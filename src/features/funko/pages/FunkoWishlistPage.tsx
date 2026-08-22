import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Trash2, Search, Edit2, Check, X } from 'lucide-react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editPriority, setEditPriority] = useState('1');
  const [editNotes, setEditNotes] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'price'>('priority');

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadWishlist();
  }, [telegramUser?.id]);

  const loadWishlist = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('funko_wishlist')
      .select(`id, funko_id, target_price, condition, priority, notes, created_at,
        funko_items (name, franchise, series, image_url)`)
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

  const startEdit = (item: WishlistItem) => {
    setEditingId(item.id);
    setEditPrice(item.target_price?.toString() ?? '');
    setEditPriority(item.priority?.toString() ?? '1');
    setEditNotes(item.notes ?? '');
  };

  const saveEdit = async (id: string) => {
    await supabase.from('funko_wishlist').update({
      target_price: editPrice ? parseFloat(editPrice) : null,
      priority: parseInt(editPriority),
      notes: editNotes || null,
    }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? {
      ...i,
      target_price: editPrice ? parseFloat(editPrice) : null,
      priority: parseInt(editPriority),
      notes: editNotes || null,
    } : i));
    setEditingId(null);
    setStatusMsg('✅ Wishlist actualizada');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const priorityLabel = (p: number | null) => {
    if (p === 1) return { label: 'Alta', color: 'text-red-400', bg: 'bg-red-500/20' };
    if (p === 2) return { label: 'Media', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { label: 'Baja', color: 'text-gray-400', bg: 'bg-gray-500/20' };
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'priority') return (a.priority ?? 3) - (b.priority ?? 3);
    if (sortBy === 'price') return (a.target_price ?? 999) - (b.target_price ?? 999);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.FunkoHome)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
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

        {!isLoading && items.length > 0 && (
          <div className="flex gap-2">
            {[
              { key: 'priority', label: 'Prioridad' },
              { key: 'date', label: 'Fecha' },
              { key: 'price', label: 'Precio' },
            ].map(s => (
              <button key={s.key}
                onClick={() => setSortBy(s.key as any)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  sortBy === s.key ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {isLoading && <div className="text-center py-8 text-gray-500 text-sm">Cargando...</div>}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <Heart className="w-10 h-10 text-gray-700 mx-auto" />
            <p className="text-gray-500 text-sm">Tu wishlist está vacía</p>
            <button onClick={() => navigate(RoutePaths.FunkoExplorer)}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold">
              <Search className="w-4 h-4" />Explorar Funkos
            </button>
          </div>
        )}

        {!isLoading && sortedItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{items.length} Funkos en tu wishlist</p>
            {sortedItems.map(item => {
              const funko = item.funko_items;
              const prio = priorityLabel(item.priority);
              const isEditing = editingId === item.id;
              return (
                <div key={item.id}
                  className={`bg-[#111118] border rounded-2xl p-3 space-y-2 ${
                    isEditing ? 'border-purple-500/40' : 'border-white/8'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => !isEditing && navigate(`/funko/${item.funko_id}`)}
                      className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer">
                      {funko?.image_url ? (
                        <img src={funko.image_url} alt={funko.name}
                          className="w-full h-full object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : <span className="text-2xl">🎭</span>}
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => !isEditing && navigate(`/funko/${item.funko_id}`)}>
                      <p className="text-sm font-bold text-white truncate">{funko?.name ?? 'Funko'}</p>
                      {funko?.franchise && <p className="text-xs text-purple-400 truncate">{funko.franchise}</p>}
                      {!isEditing && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${prio.color} ${prio.bg}`}>
                            {prio.label}
                          </span>
                          {item.target_price && (
                            <span className="text-[10px] text-gray-500">Objetivo: €{item.target_price}</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isEditing ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEdit(item)}
                          className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                          <Edit2 className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                        <button onClick={() => removeFromWishlist(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => saveEdit(item.id)}
                          className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Precio objetivo (€)</p>
                          <input
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            type="number"
                            placeholder="0.00"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Prioridad</p>
                          <select
                            value={editPriority}
                            onChange={e => setEditPriority(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50">
                            <option value="1">Alta</option>
                            <option value="2">Media</option>
                            <option value="3">Baja</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1">Notas</p>
                        <input
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          placeholder="Notas opcionales..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {!isEditing && item.notes && (
                    <p className="text-[10px] text-gray-500 italic">{item.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}