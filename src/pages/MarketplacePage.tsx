import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Search, Plus, X, Loader2,
  MessageCircle, ShoppingBag, TrendingDown, TrendingUp,
  Trash2, CheckCircle,
} from 'lucide-react';
import { useUserStore } from '@/store';
import { cx } from '@/utils';

// ── TYPES ──────────────────────────────────────────────────────
type ListingType = 'sell' | 'trade' | 'want';
type SortType = 'newest' | 'price_asc' | 'price_desc' | 'recent_change';
type TabType = 'browse' | 'my_listings' | 'create';

interface PriceChange {
  direction: 'up' | 'down';
  from: number;
  to: number;
  pct: number;
}

interface Listing {
  id: string;
  telegram_user_id: number;
  username?: string;
  listing_type: ListingType;
  tcg: string;
  item_name: string;
  set_name?: string;
  card_number?: string;
  rarity?: string;
  condition?: string;
  variant?: string;
  language?: string;
  image_url?: string;
  price?: number;
  currency: string;
  accepts_trade: boolean;
  description?: string;
  contact_telegram: string;
  status: string;
  views: number;
  offers_count: number;
  original_price?: number;
  price_history: { price: number; date: string }[];
  created_at: string;
  updated_at: string;
  expires_at: string;
  price_change?: PriceChange | null;
}

// ── CONSTANTS ─────────────────────────────────────────────────
const API = 'https://collectiq-api.esxdinero.workers.dev';
const FREE_LIMIT = 3;

const TCG_OPTIONS = [
  { value: '', label: '🌐 Todos' },
  { value: 'pokemon', label: '⚡ Pokémon' },
  { value: 'funko', label: '🎭 Funko Pop' },
  { value: 'onepiece', label: '⚓ One Piece' },
  { value: 'magic', label: '🔮 Magic' },
  { value: 'yugioh', label: '👁️ Yu-Gi-Oh!' },
  { value: 'lorcana', label: '✨ Lorcana' },
  { value: 'digimon', label: '🦕 Digimon' },
];

const CONDITION_LABELS: Record<string, string> = {
  mint: 'Mint', near_mint: 'NM', excellent: 'EX',
  good: 'Good', played: 'PL', poor: 'Poor',
};

const LISTING_INFO: Record<ListingType, { label: string; color: string; bg: string; emoji: string }> = {
  sell:  { label: 'Vendo',  color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/25',   emoji: '💚' },
  trade: { label: 'Cambio', color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/25',    emoji: '🔄' },
  want:  { label: 'Busco',  color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/25', emoji: '🔍' },
};

// ── MAIN PAGE ─────────────────────────────────────────────────
export function MarketplacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const telegramUser = useUserStore(s => s.telegramUser);
  const prefill = (location.state as any)?.prefill;
  const initialTab = (location.state as any)?.tab as TabType | undefined;

  // Premium: se consulta directamente al Worker
  const [isPremium, setIsPremium] = useState(false);

  const [tab, setTab] = useState<TabType>(initialTab || 'browse');
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Listing | null>(null);

  const [tcg, setTcg] = useState('');
  const [listingType, setListingType] = useState<ListingType | ''>('');
  const [sort, setSort] = useState<SortType>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Verificar premium al cargar
  useEffect(() => {
    if (!telegramUser?.id) return;
    fetch(`${API}/marketplace-list?user_id=${telegramUser.id}&limit=1`)
      .catch(() => {});
    // Consultar premium via Worker (evita exponer claves en frontend)
    fetch(`${API}/admin-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id, checkPremium: true }),
    })
      .then(r => r.json())
      .then(data => { if (data.isPremium) setIsPremium(true); })
      .catch(() => {});
  }, [telegramUser?.id]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ sort, limit: '40' });
      if (tcg) p.set('tcg', tcg);
      if (listingType) p.set('listing_type', listingType);
      if (search) p.set('search', search);
      const res = await fetch(`${API}/marketplace-list?${p}`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch { setListings([]); }
    finally { setLoading(false); }
  }, [tcg, listingType, sort, search]);

  const fetchMyListings = useCallback(async () => {
    if (!telegramUser?.id) return;
    try {
      const res = await fetch(`${API}/marketplace-list?user_id=${telegramUser.id}&limit=50`);
      const data = await res.json();
      setMyListings(data.listings || []);
    } catch { setMyListings([]); }
  }, [telegramUser?.id]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/marketplace-stats`);
      const data = await res.json();
      setStats(data);
    } catch { setStats(null); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    if (tab === 'my_listings') fetchMyListings();
  }, [tab, fetchMyListings]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await fetch(`${API}/marketplace-delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, telegram_user_id: telegramUser?.id }),
    });
    fetchMyListings();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`${API}/marketplace-update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, telegram_user_id: telegramUser?.id, status }),
    });
    fetchMyListings();
  };

  const activeCount = myListings.filter(l => l.status === 'active').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {/* Header */}
      <div className="relative px-4 pt-6 pb-3">
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate('/')} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-green-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
            <h1 className="text-lg font-bold leading-tight">Marketplace</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8 px-4">
        {([
          { key: 'browse', label: '🔍 Explorar' },
          { key: 'my_listings', label: '📦 Mis anuncios' },
          { key: 'create', label: '➕ Publicar' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cx('flex-1 py-3 text-xs font-semibold transition-colors border-b-2',
              tab === t.key ? 'text-green-400 border-green-400' : 'text-gray-500 border-transparent')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* BROWSE */}
      {tab === 'browse' && (
        <div className="px-4 pt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Anuncios" value={listings.length} color="text-green-400" />
            <StatCard label="Bajadas 🔻" value={stats?.price_drops?.length || 0} color="text-emerald-400" />
            <StatCard label="Nuevos ✨" value={stats?.newest?.length || 0} color="text-yellow-400" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Buscar carta, Funko..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
              />
            </div>
            <button onClick={() => setSearch(searchInput)} className="bg-green-600 px-3 rounded-xl text-sm font-medium">Ir</button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <select value={tcg} onChange={e => setTcg(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white shrink-0 focus:outline-none">
              {TCG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={listingType} onChange={e => setListingType(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white shrink-0 focus:outline-none">
              <option value="">Todos los tipos</option>
              <option value="sell">💚 Vendo</option>
              <option value="trade">🔄 Cambio</option>
              <option value="want">🔍 Busco</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value as SortType)}
              className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white shrink-0 focus:outline-none">
              <option value="newest">🕐 Más nuevos</option>
              <option value="price_asc">💰 Precio ↑</option>
              <option value="price_desc">💰 Precio ↓</option>
              <option value="recent_change">🔄 Cambio reciente</option>
            </select>
            {(tcg || listingType || search) && (
              <button onClick={() => { setTcg(''); setListingType(''); setSearch(''); setSearchInput(''); }}
                className="shrink-0 text-xs text-red-400 flex items-center gap-1 px-2">
                <X size={12} /> Limpiar
              </button>
            )}
          </div>

          {!tcg && !listingType && !search && stats && (
            <>
              {stats.price_drops?.length > 0 && (
                <Section title="🔻 Bajadas de precio">
                  <HScroll>{stats.price_drops.map((l: Listing) => <MiniCard key={l.id} listing={l} onClick={() => setSelected(l)} />)}</HScroll>
                </Section>
              )}
              {stats.newest?.length > 0 && (
                <Section title="✨ Recién añadidos">
                  <HScroll>{stats.newest.map((l: Listing) => <MiniCard key={l.id} listing={l} onClick={() => setSelected(l)} />)}</HScroll>
                </Section>
              )}
              {stats.price_rises?.length > 0 && (
                <Section title="🔺 Subidas de precio">
                  <HScroll>{stats.price_rises.map((l: Listing) => <MiniCard key={l.id} listing={l} onClick={() => setSelected(l)} />)}</HScroll>
                </Section>
              )}
            </>
          )}

          <Section title={tcg || listingType || search ? 'Resultados' : 'Todos los anuncios'}>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 text-green-400 animate-spin" /></div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-3 text-center">
                <ShoppingBag size={32} className="text-gray-600" />
                <p className="text-sm text-gray-500">No hay anuncios con estos filtros</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {listings.map(l => <ListingCard key={l.id} listing={l} onClick={() => setSelected(l)} />)}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* MIS ANUNCIOS */}
      {tab === 'my_listings' && (
        <div className="px-4 pt-4 space-y-3">
          {!isPremium && (
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Anuncios activos</p>
                <p className="text-[10px] text-gray-500">{activeCount}/{FREE_LIMIT} — GO para ilimitado</p>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: FREE_LIMIT }).map((_, i) => (
                  <div key={i} className={cx('w-3.5 h-3.5 rounded-full', i < activeCount ? 'bg-green-400' : 'bg-white/10')} />
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setTab('create')} disabled={!isPremium && activeCount >= FREE_LIMIT}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition-transform">
            <Plus size={16} /> Publicar nuevo anuncio
          </button>
          {myListings.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 text-center">
              <ShoppingBag size={32} className="text-gray-600" />
              <p className="text-sm text-gray-500">Aún no tienes anuncios</p>
            </div>
          ) : myListings.map(l => (
            <MyListingCard key={l.id} listing={l}
              onDelete={() => handleDelete(l.id)}
              onStatusChange={(s) => handleStatusChange(l.id, s)} />
          ))}
        </div>
      )}

      {/* CREAR */}
      {tab === 'create' && (
        <CreateTab
          telegramUser={telegramUser}
          isPremium={isPremium}
          myListingsCount={activeCount}
          prefill={prefill}
          onCreated={() => { setTab('my_listings'); fetchMyListings(); }}
        />
      )}

      {selected && (
        <ListingModal listing={selected} currentUserId={telegramUser?.id} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ── CREATE TAB ────────────────────────────────────────────────
function CreateTab({ telegramUser, isPremium, myListingsCount, prefill, onCreated }: any) {
  const [form, setForm] = useState({
    listing_type: (prefill?.listing_type || 'sell') as ListingType,
    tcg: prefill?.tcg || 'pokemon',
    item_name: prefill?.item_name || '',
    set_name: prefill?.set_name || '',
    card_number: prefill?.card_number || '',
    condition: 'near_mint',
    variant: '',
    language: 'es',
    image_url: prefill?.image_url || '',
    price: prefill?.price || '',
    accepts_trade: false,
    description: '',
    contact_telegram: prefill?.contact_telegram || telegramUser?.username || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  if (!isPremium && myListingsCount >= FREE_LIMIT) {
    return (
      <div className="px-4 pt-8 text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-lg font-bold">Límite alcanzado</h2>
        <p className="text-sm text-gray-400">Los usuarios FREE pueden tener {FREE_LIMIT} anuncios activos. Hazte GO para publicar ilimitado.</p>
        <button className="bg-yellow-500 text-black font-bold py-3 px-6 rounded-2xl">⭐ Hazte GO — 75 Stars</button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.item_name.trim()) return setError('El nombre es obligatorio');
    if (!form.contact_telegram.trim()) return setError('El usuario de Telegram es obligatorio');
    if (form.listing_type === 'sell' && !form.price && !form.accepts_trade) return setError('Indica un precio o marca que aceptas intercambio');
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API}/marketplace-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price: form.price ? parseFloat(form.price) : null,
          telegram_user_id: telegramUser?.id,
          username: telegramUser?.username,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Error al publicar');
      else onCreated();
    } catch { setError('Error de conexión'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="px-4 pt-4 pb-10 space-y-4">
      <h2 className="font-bold">Publicar anuncio</h2>
      {error && <div className="bg-red-500/15 border border-red-500/25 text-red-400 rounded-xl p-3 text-xs">{error}</div>}

      <Field label="¿Qué quieres hacer?">
        <div className="grid grid-cols-3 gap-2">
          {(['sell', 'trade', 'want'] as ListingType[]).map(type => {
            const info = LISTING_INFO[type];
            return (
              <button key={type} onClick={() => set('listing_type', type)}
                className={cx('py-2 rounded-xl text-xs font-semibold border transition-all',
                  form.listing_type === type ? info.bg + ' ' + info.color : 'bg-white/5 border-white/8 text-gray-400')}>
                {info.emoji} {info.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Categoría">
        <select value={form.tcg} onChange={e => set('tcg', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none">
          {TCG_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>

      <Field label="Nombre del artículo *">
        <input value={form.item_name} onChange={e => set('item_name', e.target.value)}
          placeholder="Ej: Charizard ex, Funko Pop Goku..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Set / Serie">
          <input value={form.set_name} onChange={e => set('set_name', e.target.value)} placeholder="Obsidian Flames"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </Field>
        <Field label="Número">
          <input value={form.card_number} onChange={e => set('card_number', e.target.value)} placeholder="125/197"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Condición">
          <select value={form.condition} onChange={e => set('condition', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none">
            {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Variante">
          <input value={form.variant} onChange={e => set('variant', e.target.value)} placeholder="Holo, 1st Ed..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </Field>
      </div>

      <Field label="Idioma">
        <select value={form.language} onChange={e => set('language', e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none">
          <option value="es">🇪🇸 Español</option>
          <option value="en">🇬🇧 Inglés</option>
          <option value="jp">🇯🇵 Japonés</option>
          <option value="fr">🇫🇷 Francés</option>
          <option value="de">🇩🇪 Alemán</option>
          <option value="pt">🇵🇹 Portugués</option>
          <option value="it">🇮🇹 Italiano</option>
          <option value="ko">🇰🇷 Coreano</option>
        </select>
      </Field>

      <Field label="URL imagen (opcional)">
        <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
      </Field>

      {form.listing_type !== 'want' && (
        <Field label={`Precio (€) ${form.listing_type === 'trade' ? '(opcional)' : '*'}`}>
          <div className="flex gap-2">
            <input value={form.price} onChange={e => set('price', e.target.value)} type="number" min="0" step="0.01" placeholder="0.00"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
            <button onClick={() => set('accepts_trade', !form.accepts_trade)}
              className={cx('px-3 py-2 rounded-xl text-xs border font-medium transition-all',
                form.accepts_trade ? 'bg-blue-500/15 border-blue-500/25 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400')}>
              🔄 Cambio
            </button>
          </div>
        </Field>
      )}
      {form.listing_type === 'want' && (
        <Field label="Precio máximo (€)">
          <input value={form.price} onChange={e => set('price', e.target.value)} type="number" min="0" step="0.01" placeholder="0.00"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </Field>
      )}

      <Field label="Descripción">
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Estado, detalles, condiciones de envío..." rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none resize-none" />
      </Field>

      <Field label="Tu usuario de Telegram *">
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-gray-500 text-sm">@</span>
          <input value={form.contact_telegram} onChange={e => set('contact_telegram', e.target.value.replace('@', ''))}
            placeholder="tu_usuario"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
        </div>
        <p className="text-[10px] text-gray-600 mt-1">Los interesados te contactarán directamente</p>
      </Field>

      <div className="bg-white/3 rounded-xl p-3 text-[10px] text-gray-500 space-y-1 border border-white/5">
        <p>⚠️ <strong className="text-gray-400">CollectIQ no interviene en las transacciones.</strong></p>
        <p>Este es un tablón de anuncios. El acuerdo, pago y envío son responsabilidad de las partes.</p>
        <p>Prohibido publicar artículos ilegales o falsificaciones.</p>
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full bg-green-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {submitting ? 'Publicando...' : '✅ Publicar anuncio'}
      </button>
    </div>
  );
}

// ── LISTING MODAL ─────────────────────────────────────────────
function ListingModal({ listing, currentUserId, onClose }: { listing: Listing; currentUserId?: number; onClose: () => void }) {
  const [offerMsg, setOfferMsg] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const isOwn = listing.telegram_user_id === currentUserId;
  const info = LISTING_INFO[listing.listing_type];

  const handleOffer = async () => {
    if (!offerMsg.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/marketplace-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          from_user_id: currentUserId,
          message: offerMsg,
          offer_price: offerPrice ? parseFloat(offerPrice) : undefined,
        }),
      });
      setSent(true);
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-[#111118] w-full rounded-t-2xl max-h-[90vh] overflow-y-auto border-t border-white/8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/8">
          <span className={cx('text-xs px-2.5 py-1 rounded-full border font-semibold', info.bg, info.color)}>{info.emoji} {info.label}</span>
          <button onClick={onClose} className="text-gray-500 w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {listing.image_url && (
            <div className="flex justify-center">
              <img src={listing.image_url} alt={listing.item_name} className="h-44 object-contain rounded-xl" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold">{listing.item_name}</h2>
            {listing.set_name && <p className="text-gray-400 text-sm">{listing.set_name}{listing.card_number ? ` · ${listing.card_number}` : ''}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {listing.condition && <Tag>{CONDITION_LABELS[listing.condition] || listing.condition}</Tag>}
            {listing.variant && <Tag>{listing.variant}</Tag>}
            {listing.language && <Tag>{listing.language.toUpperCase()}</Tag>}
            {listing.accepts_trade && <Tag color="blue">🔄 Acepta cambio</Tag>}
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            {listing.price != null ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-green-400">{listing.price.toFixed(2)}€</span>
                {listing.price_change && (
                  <span className={cx('text-xs font-semibold flex items-center gap-1',
                    listing.price_change.direction === 'down' ? 'text-emerald-400' : 'text-red-400')}>
                    {listing.price_change.direction === 'down' ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {Math.abs(listing.price_change.pct)}% desde {listing.price_change.from.toFixed(2)}€
                  </span>
                )}
              </div>
            ) : <p className="text-gray-400 text-sm">Precio a negociar</p>}
          </div>
          {listing.price_history?.length > 0 && (
            <div className="bg-white/3 rounded-xl p-3 border border-white/5">
              <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">Historial de precio</p>
              <div className="space-y-1">
                {listing.price_history.slice(-4).map((h, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-500">{new Date(h.date).toLocaleDateString('es')}</span>
                    <span className="text-gray-300">{h.price.toFixed(2)}€</span>
                  </div>
                ))}
                {listing.price != null && (
                  <div className="flex justify-between text-xs font-bold text-green-400 border-t border-white/8 pt-1 mt-1">
                    <span>Actual</span><span>{listing.price.toFixed(2)}€</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {listing.description && <p className="text-sm text-gray-300 bg-white/3 rounded-xl p-3 border border-white/5">{listing.description}</p>}
          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">Vendedor</p>
              <p className="text-sm font-semibold">@{listing.contact_telegram}</p>
            </div>
            <a href={`https://t.me/${listing.contact_telegram}`} target="_blank" rel="noopener noreferrer"
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
              <MessageCircle size={12} /> Contactar
            </a>
          </div>
          {!isOwn && !sent && (
            <div className="border border-white/8 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold">✉️ Enviar oferta</p>
              <textarea value={offerMsg} onChange={e => setOfferMsg(e.target.value)}
                placeholder="Hola, me interesa tu anuncio..." rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none resize-none" />
              {listing.listing_type !== 'want' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Ofrezco:</span>
                  <input value={offerPrice} onChange={e => setOfferPrice(e.target.value)} type="number" placeholder="€"
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none" />
                </div>
              )}
              <button onClick={handleOffer} disabled={sending || !offerMsg.trim()}
                className="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform">
                {sending ? 'Enviando...' : 'Enviar oferta'}
              </button>
              <p className="text-[10px] text-gray-600 text-center">El vendedor recibirá una notificación por Telegram</p>
            </div>
          )}
          {sent && (
            <div className="bg-green-500/15 border border-green-500/25 rounded-xl p-3 text-center">
              <CheckCircle size={20} className="text-green-400 mx-auto mb-1" />
              <p className="text-sm text-green-400 font-semibold">Oferta enviada</p>
              <p className="text-[10px] text-gray-400 mt-0.5">@{listing.contact_telegram} ha recibido tu mensaje</p>
            </div>
          )}
          <p className="text-[10px] text-gray-600 text-center">
            Publicado el {new Date(listing.created_at).toLocaleDateString('es')} · Caduca el {new Date(listing.expires_at).toLocaleDateString('es')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── MY LISTING CARD ───────────────────────────────────────────
function MyListingCard({ listing, onDelete, onStatusChange }: { listing: Listing; onDelete: () => void; onStatusChange: (s: string) => void }) {
  const info = LISTING_INFO[listing.listing_type];
  const isActive = listing.status === 'active';
  return (
    <div className={cx('bg-[#111118] border rounded-2xl p-3', isActive ? 'border-white/8' : 'border-white/4 opacity-60')}>
      <div className="flex gap-3">
        {listing.image_url && <img src={listing.image_url} alt={listing.item_name} className="w-12 h-12 object-contain rounded-lg shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={cx('text-[10px] px-2 py-0.5 rounded-full border font-bold', info.bg, info.color)}>{info.emoji} {info.label}</span>
            <span className={cx('text-[10px] px-2 py-0.5 rounded-full',
              listing.status === 'active' ? 'bg-green-500/15 text-green-400' :
              listing.status === 'reserved' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-gray-500/15 text-gray-400')}>
              {listing.status}
            </span>
          </div>
          <p className="text-sm font-semibold truncate">{listing.item_name}</p>
          {listing.set_name && <p className="text-[10px] text-gray-500 truncate">{listing.set_name}</p>}
          {listing.price != null && <p className="text-sm font-bold text-green-400">{listing.price.toFixed(2)}€</p>}
          <p className="text-[10px] text-gray-600 mt-0.5">👁 {listing.views} · 💬 {listing.offers_count} ofertas</p>
        </div>
      </div>
      <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-white/5">
        {isActive && (
          <button onClick={() => onStatusChange('reserved')}
            className="flex-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-1.5 rounded-xl text-[11px] font-semibold">
            🤝 Reservar
          </button>
        )}
        {listing.status === 'reserved' && (
          <>
            <button onClick={() => onStatusChange('active')} className="flex-1 bg-white/5 text-gray-300 py-1.5 rounded-xl text-[11px]">Reactivar</button>
            <button onClick={() => onStatusChange('sold')} className="flex-1 bg-green-500/10 text-green-400 border border-green-500/20 py-1.5 rounded-xl text-[11px] font-semibold">✅ Vendido</button>
          </>
        )}
        <button onClick={onDelete} className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-xl">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── LISTING CARD ──────────────────────────────────────────────
function ListingCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  const info = LISTING_INFO[listing.listing_type];
  const pc = listing.price_change;
  return (
    <button onClick={onClick} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden text-left active:scale-95 transition-transform hover:border-white/15">
      <div className="aspect-square bg-white/5 relative">
        {listing.image_url
          ? <img src={listing.image_url} alt={listing.item_name} className="w-full h-full object-contain p-2" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">
              {listing.tcg === 'pokemon' ? '⚡' : listing.tcg === 'funko' ? '🎭' : listing.tcg === 'onepiece' ? '⚓' : '🃏'}
            </div>}
        <span className={cx('absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full border font-bold', info.bg, info.color)}>{info.emoji}</span>
        {pc && (
          <span className={cx('absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white',
            pc.direction === 'down' ? 'bg-emerald-500/90' : 'bg-red-500/90')}>
            {pc.direction === 'down' ? '🔻' : '🔺'}{Math.abs(pc.pct)}%
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-0.5">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{listing.item_name}</p>
        {listing.set_name && <p className="text-[10px] text-gray-500 truncate">{listing.set_name}</p>}
        <div className="flex items-center justify-between pt-0.5">
          {listing.price != null
            ? <span className="text-sm font-bold text-green-400">{listing.price.toFixed(2)}€</span>
            : listing.accepts_trade ? <span className="text-[10px] text-blue-400">🔄 Cambio</span>
            : <span className="text-[10px] text-gray-500">A negociar</span>}
          {listing.condition && <span className="text-[10px] text-gray-500">{CONDITION_LABELS[listing.condition] || listing.condition}</span>}
        </div>
      </div>
    </button>
  );
}

// ── MINI CARD ─────────────────────────────────────────────────
function MiniCard({ listing, onClick }: { listing: Listing; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-[#111118] border border-white/8 rounded-xl overflow-hidden w-28 shrink-0 text-left active:scale-95">
      <div className="h-24 bg-white/5 flex items-center justify-center">
        {listing.image_url ? <img src={listing.image_url} alt={listing.item_name} className="h-full w-full object-contain p-1.5" /> : <span className="text-2xl">🃏</span>}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-semibold line-clamp-1">{listing.item_name}</p>
        {listing.price != null && <p className="text-[10px] text-green-400 font-bold">{listing.price.toFixed(2)}€</p>}
      </div>
    </button>
  );
}

// ── HELPERS ───────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
      <p className={cx('text-xl font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold text-gray-400 mb-2">{title}</p>{children}</div>;
}
function HScroll({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-[11px] text-gray-500 mb-1.5">{label}</p>{children}</div>;
}
function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={cx('text-[10px] px-2 py-0.5 rounded-full',
      color === 'blue' ? 'bg-blue-500/15 text-blue-400' : 'bg-white/8 text-gray-400')}>
      {children}
    </span>
  );
}
