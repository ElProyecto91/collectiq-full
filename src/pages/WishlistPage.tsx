import { Heart, Trash2, BookmarkX } from 'lucide-react';
import { useState } from 'react';
import { useWishlistList, useDeleteWishlistItem } from '@/hooks/use-wishlist';

export function WishlistPage() {
  const [search, setSearch] = useState('');
  const { data: items = [], isLoading } = useWishlistList(search);
  const { mutate: deleteItem } = useDeleteWishlistItem();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-gray-500 text-sm">Cargando wishlist...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      <div>
        <h1 className="text-2xl font-bold text-white">Wishlist</h1>
        <p className="text-sm text-gray-500">Cartas que quieres conseguir.</p>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Busca en tu wishlist"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Heart size={28} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold">Tu wishlist está vacía</p>
            <p className="text-sm text-gray-500 mt-1">Añade cartas desde el Explorador.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
              <div className="relative">
                <img
                  src={item.imageUrl ?? ''}
                  alt={item.cardName}
                  className="w-full aspect-[2/3] object-cover"
                  loading="lazy"
                />
                <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-pink-500/90 flex items-center justify-center">
                  <Heart size={12} className="fill-white text-white" />
                </div>
              </div>

              <div className="p-2.5 flex-1 space-y-1">
                <p className="text-xs font-bold truncate text-white">{item.cardName}</p>
                <p className="text-[10px] text-gray-500 truncate">{item.setName}</p>
                {item.rarity && (
                  <p className="text-[10px] text-blue-400 truncate">{item.rarity}</p>
                )}
              </div>

              <div className="px-2.5 pb-2.5">
                <button
                  onClick={() => deleteItem(item.id)}
                  className="w-full py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}