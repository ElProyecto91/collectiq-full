import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { mapCollectionItem } from '@/utils/mappers';
import type { CollectionItem } from '@/types';
import { Heart, ShoppingBag, MessageCircle, Tag } from 'lucide-react';

interface PublicUser {
  username: string | null;
  first_name: string | null;
  isPremium: boolean;
  wishlist_public: boolean;
  collection_public: boolean;
  marketplace_active: boolean;
}

interface WishlistItem {
  id: string;
  card_name: string;
  image_url: string | null;
  set_name: string | null;
  tcg: string;
}

interface MarketplaceListing {
  id: string;
  name: string;
  image_url: string | null;
  listing_type: string;
  price: number | null;
  condition: string | null;
  tcg: string;
}

interface FunkoItem {
  id: string;
  funko_items: {
    name: string;
    image_url: string | null;
    franchise: string | null;
  } | null;
}

type Tab = 'collection' | 'wishlist' | 'market';

export function PublicProfilePage() {
  const { telegramId } = useParams<{ telegramId: string }>();
  const [cards, setCards] = useState<CollectionItem[]>([]);
  const [funkos, setFunkos] = useState<FunkoItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceListing[]>([]);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedCard, setZoomedCard] = useState<CollectionItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('collection');

  useEffect(() => {
    if (!telegramId) return;
    load();
  }, [telegramId]);

  const load = async () => {
    setIsLoading(true);
    try {
      const userId = parseInt(telegramId!);

      const [
        { data: sessionData },
        { data: premiumData },
        { data: profileData },
        { data: cardsData },
        { data: funkosData },
        { data: wishlistData },
        { data: marketData },
      ] = await Promise.all([
        supabase.from('user_sessions').select('user_data')
          .eq('telegram_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('user_premium').select('plan, expires_at')
          .eq('telegram_user_id', userId).maybeSingle(),
        supabase.from('public_profiles').select('wishlist_public, collection_public, marketplace_active')
          .eq('telegram_user_id', userId).maybeSingle(),
        supabase.from('collection_items').select('*')
          .eq('telegram_user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('funko_collection').select('id, funko_items(name, image_url, franchise)')
          .eq('telegram_user_id', userId)
          .limit(20),
        supabase.from('wishlist_items').select('id, card_name, image_url, set_name, tcg')
          .eq('telegram_user_id', userId)
          .limit(30),
        supabase.from('marketplace_listings')
          .select('id, name, image_url, listing_type, price, condition, tcg')
          .eq('telegram_user_id', userId)
          .eq('status', 'active'),
      ]);

      const ud = sessionData?.user_data ?? {};
      const isExpired = premiumData?.expires_at ? new Date(premiumData.expires_at) < new Date() : true;
      const isPremium = premiumData?.plan === 'go' && !isExpired;

      setUser({
        username: ud.username ?? null,
        first_name: ud.first_name ?? null,
        isPremium,
        wishlist_public: profileData?.wishlist_public ?? false,
        collection_public: profileData?.collection_public ?? true,
        marketplace_active: profileData?.marketplace_active ?? false,
      });

      setCards((cardsData ?? []).map(mapCollectionItem));
      setFunkos((funkosData ?? []) as unknown as FunkoItem[]);
      setWishlist((wishlistData ?? []) as WishlistItem[]);
      setMarketplace((marketData ?? []) as MarketplaceListing[]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const displayName = user?.username ? '@' + user.username : user?.first_name ?? 'Coleccionista';
  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const totalValue = cards.reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);

  const tabs = [
    { key: 'collection', label: 'Colección', count: totalCards, show: user?.collection_public ?? true },
    { key: 'wishlist', label: 'Wishlist', count: wishlist.length, show: user?.wishlist_public ?? false },
    { key: 'market', label: 'Venta/Inter.', count: marketplace.length, show: marketplace.length > 0 },
  ].filter(t => t.show);

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-12">
      {zoomedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          onClick={() => setZoomedCard(null)}>
          <img src={zoomedCard.imageUrl ?? ''} alt={zoomedCard.cardName ?? ''} className="w-full max-w-xs rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* Header perfil */}
      <div className="px-4 pt-8 pb-6 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
          user?.isPremium ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : 'bg-blue-600/20 border border-blue-500/30'
        }`}>
          <span className={`text-2xl font-bold ${user?.isPremium ? 'text-yellow-400' : 'text-blue-400'}`}>
            {displayName[0].toUpperCase()}
          </span>
        </div>
        <div className="flex items-center justify-center gap-2">
          {user?.isPremium ? (
            <h1 className="text-xl font-bold" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{displayName}</h1>
          ) : (
            <h1 className="text-xl font-bold">{displayName}</h1>
          )}
          {user?.isPremium && <span className="text-[9px] bg-yellow-500 text-black font-black px-1.5 py-0.5 rounded-full">GO</span>}
        </div>
        <p className={`text-xs mt-1 ${user?.isPremium ? 'text-yellow-500/80' : 'text-blue-400'}`}>
          {user?.isPremium ? '✨ CollectIQ GO · Coleccion publica' : 'CollectIQ · Coleccion publica'}
        </p>
      </div>

      {/* Stats */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cartas', value: totalCards, color: user?.isPremium ? 'text-yellow-400' : 'text-blue-400' },
            { label: 'Funkos', value: funkos.length, color: 'text-red-400' },
            { label: 'Valor est.', value: totalValue > 0 ? totalValue.toFixed(0) + '€' : '—', color: 'text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-[#111118] rounded-2xl p-3 text-center border ${user?.isPremium ? 'border-yellow-500/20' : 'border-white/8'}`}>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="px-4 mb-4">
          <div className="flex gap-2 bg-white/5 rounded-xl p-1">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as Tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400'
                }`}>
                {tab.label}
                {tab.count > 0 && <span className="ml-1 opacity-70">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Colección */}
      {activeTab === 'collection' && (
        <div className="px-4">
          {/* Pokémon */}
          {cards.length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Pokémon TCG</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {cards.map(card => (
                  <div key={card.id} className="cursor-pointer" onClick={() => setZoomedCard(card)}>
                    <img src={card.imageUrl ?? ''} alt={card.cardName ?? ''}
                      className={`w-full aspect-[2/3] object-cover rounded-xl ${user?.isPremium ? 'ring-1 ring-yellow-500/20' : ''}`}
                      loading="lazy" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Funko */}
          {funkos.length > 0 && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Funko Pop</p>
              <div className="grid grid-cols-3 gap-2">
                {funkos.map(f => (
                  <div key={f.id} className="bg-[#111118] border border-white/8 rounded-xl p-2 flex flex-col items-center gap-1">
                    {f.funko_items?.image_url ? (
                      <img src={f.funko_items.image_url} alt={f.funko_items.name}
                        className="w-full aspect-square object-contain rounded-lg" loading="lazy" />
                    ) : (
                      <div className="w-full aspect-square bg-white/5 rounded-lg flex items-center justify-center">
                        <Tag size={20} className="text-gray-600" />
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 text-center truncate w-full">{f.funko_items?.name ?? '—'}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {cards.length === 0 && funkos.length === 0 && (
            <div className="text-center py-16 text-gray-500"><p>Esta colección está vacía</p></div>
          )}
        </div>
      )}

      {/* Tab: Wishlist */}
      {activeTab === 'wishlist' && (
        <div className="px-4">
          {wishlist.length === 0 ? (
            <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-3">
              <Heart size={32} className="text-gray-700" />
              <p>La wishlist está vacía</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {wishlist.map(item => (
                <div key={item.id} className="bg-[#111118] border border-white/8 rounded-xl overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.card_name}
                      className="w-full aspect-[2/3] object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center">
                      <Heart size={20} className="text-gray-600" />
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="text-[9px] text-white truncate font-medium">{item.card_name}</p>
                    {item.set_name && <p className="text-[8px] text-gray-500 truncate">{item.set_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Marketplace */}
      {activeTab === 'market' && (
        <div className="px-4">
          {marketplace.length === 0 ? (
            <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-3">
              <ShoppingBag size={32} className="text-gray-700" />
              <p>Sin anuncios activos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {marketplace.map(listing => (
                <div key={listing.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                  <div className="relative aspect-square bg-white/5">
                    {listing.image_url ? (
                      <img src={listing.image_url} alt={listing.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Tag size={24} className="text-gray-600" />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      {listing.listing_type === 'sale' && <span className="text-[9px] bg-green-500/90 text-white px-1.5 py-0.5 rounded-full font-bold">VENTA</span>}
                      {listing.listing_type === 'trade' && <span className="text-[9px] bg-blue-500/90 text-white px-1.5 py-0.5 rounded-full font-bold">INTERCAMBIO</span>}
                      {listing.listing_type === 'sale_or_trade' && <span className="text-[9px] bg-purple-500/90 text-white px-1.5 py-0.5 rounded-full font-bold">VENTA/INTER.</span>}
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-bold truncate text-white">{listing.name}</p>
                    {listing.price && <p className="text-sm font-bold text-green-400">€{listing.price.toFixed(2)}</p>}
                    <button onClick={() => window.open(`https://t.me/CollectIQ_bot?start=market_${listing.id}`, '_blank')}
                      className="w-full bg-green-600/20 border border-green-500/30 text-green-400 rounded-xl py-1.5 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                      <MessageCircle size={11} /> Contactar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 px-4">
        <p className="text-xs text-gray-600">Powered by</p>
        <p className="text-sm font-bold text-blue-400 mt-0.5">CollectIQ</p>
        <a href="https://t.me/CollectIQ_bot"
          className={`mt-3 inline-block text-white rounded-xl px-5 py-2.5 text-sm font-medium ${
            user?.isPremium ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-blue-600'
          }`}>
          Crea tu colección gratis
        </a>
      </div>
    </div>
  );
}