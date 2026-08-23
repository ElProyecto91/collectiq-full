import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Filter, Tag, RefreshCw,
  MessageCircle, Heart, ShoppingBag, X, Plus, Loader2,
} from 'lucide-react';
import { useUserStore } from '@/store';
import { cx } from '@/utils';

interface MarketplaceListing {
  id: string;
  telegram_user_id: number;
  tcg: string;
  name: string;
  image_url: string | null;
  set_name: string | null;
  number: string | null;
  condition: string | null;
  variant: string | null;
  listing_type: 'sale' | 'trade' | 'sale_or_trade';
  price: number | null;
  currency: string;
  description: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

const TCG_FILTERS = [
  { key: '', label: 'Todo' },
  { key: 'pokemon', label: 'Pokémon' },
  { key: 'funko', label: 'Funko' },
  { key: 'magic', label: 'Magic' },
  { key: 'yugioh', label: 'Yu-Gi-Oh!' },
];

const TYPE_FILTERS = [
  { key: '', label: 'Todo' },
  { key: 'sale', label: 'Venta' },
  { key: 'trade', label: 'Intercambio' },
  { key: 'sale_or_trade', label: 'Venta/Intercambio' },
];

function ListingTypeTag({ type }: { type: string }) {
  if (type === 'sale') return (
    <span className="text-[9px] bg-green-500/15 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full font-bold">VENTA</span>
  );
  if (type === 'trade') return (
    <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold">INTERCAMBIO</span>
  );
  return (
    <span className="text-[9px] bg-purple-500/15 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded-full font-bold">VENTA/INTER.</span>
  );
}

function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const telegramUser = useUserStore(s => s.telegramUser);
  const [tcg, setTcg] = useState('pokemon');
  const [name, setName] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'trade' | 'sale_or_trade'>('sale');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('near-mint');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !telegramUser?.id) return;
    setSaving(true);
    try {
      await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          telegramUserId: telegramUser.id,
          tcg, name: name.trim(),
          listingType,
          price: price || null,
          condition, description, location,
        }),
      });
      onCreated();
      onClose();
    } catch { /* nada */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">Publicar anuncio</p>
          <button onClick={onClose} className="text-gray-500 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Cancelar</button>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Colección</p>
          <div className="flex gap-2">
            {TCG_FILTERS.filter(t => t.key).map(t => (
              <button key={t.key} onClick={() => setTcg(t.key)}
                className={cx('px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                  tcg === t.key ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Nombre del item *</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ej: Charizard Base Set, Pikachu #25..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Tipo de anuncio</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'sale', label: '💰 Venta' },
              { key: 'trade', label: '🔄 Intercambio' },
              { key: 'sale_or_trade', label: '💰🔄 Ambos' },
            ].map(t => (
              <button key={t.key} onClick={() => setListingType(t.key as any)}
                className={cx('py-2 rounded-xl text-xs font-medium border transition-all',
                  listingType === t.key ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {(listingType === 'sale' || listingType === 'sale_or_trade') && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Precio (EUR)</p>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" min="0" step="0.01"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
          </div>
        )}

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Condición</p>
          <div className="grid grid-cols-3 gap-2">
            {['mint', 'near-mint', 'lightly-played', 'moderately-played', 'heavily-played'].map(c => (
              <button key={c} onClick={() => setCondition(c)}
                className={cx('py-1.5 rounded-xl text-[10px] font-medium border transition-all capitalize',
                  condition === c ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                {c.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Descripción</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Estado, historial, envío incluido..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none h-16" />
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">Ubicación (ciudad/país)</p>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="ej: Madrid, España"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>

        <button onClick={handleCreate} disabled={!name.trim() || saving}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {saving ? 'Publicando...' : 'Publicar anuncio'}
        </button>
      </div>
    </div>
  );
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTcg, setFilterTcg] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/marketplace?status=active&limit=50';
      if (filterTcg) url += `&tcg=${filterTcg}`;
      if (filterType) url += `&type=${filterType}`;
      const res = await fetch(url);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch { setListings([]); } finally { setLoading(false); }
  }, [filterTcg, filterType]);

  useEffect(() => { load(); }, [load]);

  const filtered = listings.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase())
  );

  const contactSeller = (listing: MarketplaceListing) => {
    // Abrir Telegram con mensaje pre-escrito
    const msg = encodeURIComponent(`Hola! Vi tu anuncio en CollectIQ sobre "${listing.name}" ${listing.price ? `a €${listing.price}` : '(intercambio)'}. ¿Sigue disponible?`);
    window.open(`https://t.me/CollectIQ_bot?start=market_${listing.id}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {showCreate && (
        <CreateListingModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {/* Header */}
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] text-green-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
              <h1 className="text-lg font-bold leading-tight">Marketplace</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFilters(!showFilters)}
              className={cx('w-9 h-9 rounded-xl border flex items-center justify-center transition-all',
                (filterTcg || filterType) ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/10 border-white/10 text-gray-400')}>
              <Filter size={16} />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
              <Plus size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Búsqueda */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cartas, Funkos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
        </div>

        {/* Filtros */}
        {showFilters && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-2">Colección</p>
              <div className="flex gap-2 flex-wrap">
                {TCG_FILTERS.map(t => (
                  <button key={t.key} onClick={() => setFilterTcg(t.key)}
                    className={cx('px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                      filterTcg === t.key ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Tipo</p>
              <div className="flex gap-2 flex-wrap">
                {TYPE_FILTERS.map(t => (
                  <button key={t.key} onClick={() => setFilterType(t.key)}
                    className={cx('px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                      filterType === t.key ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400')}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {(filterTcg || filterType) && (
              <button onClick={() => { setFilterTcg(''); setFilterType(''); }}
                className="text-xs text-red-400 flex items-center gap-1">
                <X size={12} /> Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Anuncios', value: listings.length, color: 'text-green-400' },
            { label: 'En venta', value: listings.filter(l => l.listing_type !== 'trade').length, color: 'text-yellow-400' },
            { label: 'Intercambio', value: listings.filter(l => l.listing_type !== 'sale').length, color: 'text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
              <p className={cx('text-xl font-bold', color)}>{value}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <ShoppingBag size={28} className="text-green-400" />
            </div>
            <div>
              <p className="text-white font-bold">Sin anuncios todavía</p>
              <p className="text-sm text-gray-500 mt-1">Sé el primero en publicar algo</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="bg-green-600 text-white rounded-2xl px-6 py-3 font-semibold flex items-center gap-2 active:scale-95 transition-transform">
              <Plus size={18} /> Publicar anuncio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(listing => (
              <div key={listing.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden flex flex-col">
                {/* Imagen */}
                <div className="relative aspect-square bg-white/5">
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tag size={28} className="text-gray-600" />
                    </div>
                  )}
                  <div className="absolute top-1.5 left-1.5">
                    <ListingTypeTag type={listing.listing_type} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1 space-y-1">
                  <p className="text-xs font-bold truncate text-white">{listing.name}</p>
                  {listing.set_name && <p className="text-[10px] text-gray-500 truncate">{listing.set_name}</p>}
                  {listing.condition && (
                    <p className="text-[10px] text-gray-600 capitalize">{listing.condition.replace('-', ' ')}</p>
                  )}
                  {listing.price && (
                    <p className="text-sm font-bold text-green-400">€{listing.price.toFixed(2)}</p>
                  )}
                  {!listing.price && listing.listing_type === 'trade' && (
                    <p className="text-xs text-blue-400 font-medium">Intercambio</p>
                  )}
                  {listing.location && (
                    <p className="text-[10px] text-gray-600 truncate">📍 {listing.location}</p>
                  )}
                </div>

                {/* Botón contactar */}
                <div className="px-2.5 pb-2.5">
                  <button onClick={() => contactSeller(listing)}
                    className="w-full bg-green-600/20 border border-green-500/30 text-green-400 rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                    <MessageCircle size={12} /> Contactar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mi anuncio — acceso rápido */}
        {telegramUser?.id && (
          <div className="text-center pt-2">
            <button onClick={() => setShowCreate(true)}
              className="text-xs text-green-400 flex items-center gap-1 mx-auto">
              <Plus size={12} /> Publicar nuevo anuncio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}