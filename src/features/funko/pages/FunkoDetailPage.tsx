import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, Plus, Check, ShoppingBag, TrendingUp, AlertTriangle } from 'lucide-react';
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

interface PriceData {
  price: number;
  avg: number;
  min: number;
  max: number;
  count: number;
  confidence: string;
  currency: string;
}

interface CollectionEntry {
  id: string;
  quantity: number;
  purchase_price: number | null;
  market_value: number | null;
  condition: string | null;
}

export function FunkoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [funko, setFunko] = useState<FunkoItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inCollection, setInCollection] = useState(false);
  const [collectionEntry, setCollectionEntry] = useState<CollectionEntry | null>(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadFunko();
  }, [id]);

  const loadFunko = async () => {
    setIsLoading(true);
    const [{ data: funkoData }, { data: colData }, { data: wishData }] = await Promise.all([
      supabase.from('funko_items').select('*').eq('id', id).single(),
      telegramUser?.id
        ? supabase.from('funko_collection').select('id, quantity, purchase_price, market_value, condition').eq('funko_id', id).eq('telegram_user_id', telegramUser.id).maybeSingle()
        : Promise.resolve({ data: null }),
      telegramUser?.id
        ? supabase.from('funko_wishlist').select('id').eq('funko_id', id).eq('telegram_user_id', telegramUser.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setFunko(funkoData);
    setInCollection(!!colData);
    setCollectionEntry(colData ?? null);
    setInWishlist(!!wishData);
    setIsLoading(false);

    if (funkoData?.name) {
      setLoadingPrice(true);
      fetch(`/api/funko-price?name=${encodeURIComponent(funkoData.name)}`)
        .then(r => r.json())
        .then(async data => {
          if (data.price) {
            setPriceData(data);
            // Guardar market_value automáticamente si está en colección
            if (colData?.id) {
              await supabase
                .from('funko_collection')
                .update({ market_value: data.price })
                .eq('id', colData.id);
            }
          }
          setLoadingPrice(false);
        })
        .catch(() => setLoadingPrice(false));
    }
  };

  const addToCollection = async () => {
    if (!telegramUser?.id || !funko) return;
    const { data, error } = await supabase.from('funko_collection').insert({
      telegram_user_id: telegramUser.id,
      funko_id: funko.id,
      quantity: 1,
    }).select('id, quantity, purchase_price, market_value, condition').single();
    if (error) {
      setStatusMsg('❌ Error al añadir');
      setTimeout(() => setStatusMsg(''), 3000);
    } else {
      setInCollection(true);
      setCollectionEntry(data);
      setStatusMsg('✅ Añadido a tu colección');
      setTimeout(() => setStatusMsg(''), 3000);
      // Guardar precio de mercado si ya lo tenemos
      if (priceData?.price && data?.id) {
        await supabase.from('funko_collection').update({ market_value: priceData.price }).eq('id', data.id);
      }
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

  const confidenceConfig = {
    high: { label: '🟢 Alta confianza', color: 'bg-green-500/20 text-green-400' },
    medium: { label: '🟡 Media confianza', color: 'bg-yellow-500/20 text-yellow-400' },
    low: { label: '🔴 Baja confianza', color: 'bg-red-500/20 text-red-400' },
  };

  const roi = collectionEntry?.purchase_price && priceData?.price
    ? ((priceData.price - collectionEntry.purchase_price) / collectionEntry.purchase_price) * 100
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
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

        {/* Sistema ¿Lo tengo? */}
        {inCollection && (
  <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-green-400" />
        <p className="text-sm font-bold text-green-400">✅ Ya lo tienes</p>
      </div>
      <button
        onClick={async () => {
          if (!collectionEntry?.id) return;
          const { error } = await supabase
            .from('funko_collection')
            .delete()
            .eq('id', collectionEntry.id);
          if (!error) {
            setInCollection(false);
            setCollectionEntry(null);
            setStatusMsg('🗑️ Eliminado de tu colección');
            setTimeout(() => setStatusMsg(''), 3000);
          }
        }}
        className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center active:scale-95">
        <span className="text-red-400 text-xs">✕</span>
      </button>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div className="text-center">
        <p className="text-lg font-bold text-white">{collectionEntry?.quantity ?? 1}</p>
        <p className="text-[10px] text-gray-500">Cantidad</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-white">
          {collectionEntry?.purchase_price ? `€${collectionEntry.purchase_price}` : '—'}
        </p>
        <p className="text-[10px] text-gray-500">Pagado</p>
      </div>
      <div className="text-center">
        <p className={`text-lg font-bold ${roi !== null ? (roi >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
          {roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%` : '—'}
        </p>
        <p className="text-[10px] text-gray-500">ROI</p>
      </div>
    </div>
  </div>
)}

        {inWishlist && !inCollection && (
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-2xl p-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
            <p className="text-sm text-pink-400">❤️ Está en tu wishlist</p>
          </div>
        )}

        {/* Imagen */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-6 flex items-center justify-center min-h-48">
          {funko.image_url ? (
            <img src={funko.image_url} alt={funko.name}
              className="max-h-48 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <span className="text-6xl">🎭</span>
          )}
        </div>

        {/* Info */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <h2 className="text-base font-bold text-white">{funko.name}</h2>
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

        {/* Precio de mercado */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Precio de mercado</p>
          </div>
          {loadingPrice && <p className="text-xs text-gray-500">Consultando eBay...</p>}
          {!loadingPrice && priceData && (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-green-400">€{priceData.price}</p>
                <p className="text-xs text-gray-500 mb-1">estimado</p>
              </div>
              <p className="text-xs text-gray-500">
                Rango: <span className="text-white">€{priceData.min} — €{priceData.max}</span>
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Media: <span className="text-white">€{priceData.avg}</span></span>
                <span>·</span>
                <span>{priceData.count} anuncios en eBay</span>
              </div>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                confidenceConfig[priceData.confidence as keyof typeof confidenceConfig]?.color ?? confidenceConfig.low.color
              }`}>
                {confidenceConfig[priceData.confidence as keyof typeof confidenceConfig]?.label ?? '🔴 Baja confianza'}
              </span>
            </div>
          )}
          {!loadingPrice && !priceData && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-500">Sin datos de precio disponibles en eBay</p>
            </div>
          )}
        </div>

        {/* Acciones */}
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
        {inCollection && collectionEntry?.id && (
          <button onClick={() => navigate(`/funko/edit/${collectionEntry.id}`)}
            className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
            ✏️ Editar en colección
          </button>
        )}
      </div>
    </div>
  );
}