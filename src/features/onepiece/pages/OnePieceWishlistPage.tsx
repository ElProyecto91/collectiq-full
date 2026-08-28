import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Search, Trash2, ExternalLink } from 'lucide-react';
import { useWishlistList, useDeleteWishlistItem } from '@/hooks/use-wishlist';
import { useCurrency } from '@/hooks/use-currency';

export function OnePieceWishlistPage() {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { data: allWishlist = [] } = useWishlistList();
  const { mutate: deleteItem } = useDeleteWishlistItem();
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const wishlist = allWishlist.filter(w => w.tcg === 'onepiece');
  const filtered = wishlist.filter(w => (w.cardName ?? '').toLowerCase().includes(search.toLowerCase()));
  const totalValue = wishlist.reduce((s, w) => s + (w.maxPrice ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-950/20 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/onepiece')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-[10px] text-pink-400 font-bold uppercase tracking-[0.2em]">ONE PIECE TCG</p>
            <h1 className="text-lg font-bold">Wishlist</h1>
          </div>
          <span className="ml-auto text-2xl">❤️</span>
        </div>
      </div>

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-pink-400">{wishlist.length}</p>
            <p className="text-[10px] text-gray-500">Cartas buscadas</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-green-400">{totalValue > 0 ? formatPrice(totalValue) : '—'}</p>
            <p className="text-[10px] text-gray-500">Precio máx total</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en wishlist..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </div>

        {wishlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Heart size={40} className="text-gray-600" />
            <p className="text-white font-bold">Wishlist vacía</p>
            <p className="text-sm text-gray-500">Añade cartas desde el Explorador</p>
            <button onClick={() => navigate('/onepiece/explorer')}
              className="bg-red-600 text-white rounded-2xl px-6 py-3 font-semibold active:scale-95">
              Explorar cartas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(item => (
              <div key={item.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                <div className="relative">
                  <img src={item.imageUrl ?? ''} alt={item.cardName ?? ''}
                    className="w-full aspect-[3/4] object-cover" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x280/111118/666?text=OP'; }} />
                  <div className="absolute top-1.5 right-1.5">
                    <Heart size={14} className="text-pink-400 fill-pink-400" />
                  </div>
                </div>
                <div className="p-2.5 space-y-1.5">
                  <p className="text-xs font-bold truncate">{item.cardName}</p>
                  <p className="text-[10px] text-gray-500 truncate">{item.setName}</p>
                  {item.maxPrice != null && (
                    <p className="text-[10px] text-green-400">Máx: {formatPrice(item.maxPrice)}</p>
                  )}
                </div>
                <div className="flex gap-1.5 px-2.5 pb-2.5">
                  <button onClick={() => navigate('/onepiece/explorer')}
                    className="flex-1 py-1.5 rounded-xl text-[10px] font-medium bg-red-600/10 border border-red-500/20 text-red-400 flex items-center justify-center gap-1 active:scale-95">
                    <ExternalLink size={10} /> Buscar
                  </button>
                  <button onClick={() => {
                    if (confirmId === item.id) { deleteItem(item.id); setConfirmId(null); }
                    else { setConfirmId(item.id); setTimeout(() => setConfirmId(null), 2500); }
                  }}
                    className={`w-7 h-7 rounded-xl border flex items-center justify-center transition-all ${confirmId === item.id ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
