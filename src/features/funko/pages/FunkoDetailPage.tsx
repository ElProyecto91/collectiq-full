import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Plus, Check, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

interface FunkoItem {
  id: string;
  name: string;
  franchise: string | null;
  series: string | null;
  image_url: string | null;
  type: string | null;
  exclusivity: string | null;
  is_chase: boolean;
  is_flocked: boolean;
  is_glow: boolean;
  is_metallic: boolean;
  is_limited: boolean;
}

export function FunkoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [funko, setFunko] = useState<FunkoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inCollection, setInCollection] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    loadFunko();
  }, [id]);

  const loadFunko = async () => {
    setIsLoading(true);
    const [{ data: funkoData }, { data: colData }, { data: wishData }] = await Promise.all([
      supabase.from('funko_items').select('*').eq('id', id).single(),
      telegramUser?.id
        ? supabase.from('funko_collection').select('id').eq('funko_id', id).eq('telegram_user_id', telegramUser.id).maybeSingle()
        : Promise.resolve({ data: null }),
      telegramUser?.id
        ? supabase.from('funko_wishlist').select('id').eq('funko_id', id).eq('telegram_user_id', telegramUser.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setFunko(funkoData);
    setInCollection(!!colData);
    setInWishlist(!!wishData);
    setIsLoading(false);
  };

  const addToCollection = async () => {
    if (!telegramUser?.id || !funko) return;
    const { error } = await supabase.from('funko_collection').insert({
      telegram_user_id: telegramUser.id,
      funko_id: funko.id,
      quantity: 1,
    });
    if (!error) {
      setInCollection(true);
      setStatusMsg('✅ Añadido a tu colección');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const addToWishlist = async () => {
    if (!telegramUser?.id || !funko) return;
    const { error } = await supabase.from('funko_wishlist').insert({
      telegram_user_id: telegramUser.id,
      funko_id: funko.id,
      priority: 1,
    });
    if (!error) {
      setInWishlist(true);
      setStatusMsg('✅ Añadido a tu wishlist');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">Cargando...</p>
    </div>
  );

  if (!funko) return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">Funko no encontrado</p>
    </div>
  );

  const badges = [
    funko.is_chase && { label: 'Chase', color: 'bg-yellow-500/20 text-yellow-400' },
    funko.is_flocked && { label: 'Flocked', color: 'bg-blue-500/20 text-blue-400' },
    funko.is_glow && { label: 'Glow', color: 'bg-green-500/20 text-green-400' },
    funko.is_metallic && { label: 'Metallic', color: 'bg-purple-500/20 text-purple-400' },
    funko.is_limited && { label: 'Limited', color: 'bg-red-500/20 text-red-400' },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-[0.2em]">FUNKO</p>
          <h1 className="text-lg font-bold truncate">{funko.name}</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        <div className="bg-[#111118] border border-white/8 rounded-2xl p-6 flex items-center justify-center min-h-48">
          {funko.image_url ? (
            <img src={funko.image_url} alt={funko.name}
              className="max-h-48 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-6xl">🎭</span>
          )}
        </div>

        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <h2 className="text-base font-bold">{funko.name}</h2>
          {funko.franchise && <p className="text-sm text-purple-400">{funko.franchise}</p>}
          {funko.series && <p className="text-xs text-gray-500">{funko.series}</p>}
          {funko.exclusivity && (
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-3 h-3 text-gray-500" />
              <p className="text-xs text-gray-400">{funko.exclusivity}</p>
            </div>
          )}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {badges.map(b => (
                <span key={b.label} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.color}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={addToCollection} disabled={inCollection}
            className={'py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ' +
              (inCollection ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-purple-600 text-white')}>
            {inCollection ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {inCollection ? 'En colección' : 'Añadir'}
          </button>
          <button onClick={addToWishlist} disabled={inWishlist}
            className={'py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ' +
              (inWishlist ? 'bg-pink-500/10 border border-pink-500/30 text-pink-400' : 'bg-white/10 text-white')}>
            <Heart className={`w-4 h-4 ${inWishlist ? 'fill-pink-400' : ''}`} />
            {inWishlist ? 'En wishlist' : 'Wishlist'}
          </button>
        </div>
      </div>
    </div>
  );
}