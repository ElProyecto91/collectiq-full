import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Star, Zap, ShoppingBag, AlertTriangle } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { useDisplayName } from '@/hooks';
import { supabase } from '@/lib/supabase';

// ── LOGOS SVG ──────────────────────────────────────────────────
const PokemonLogo = () => (
  <svg viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="50" fontFamily="Arial Black, Impact, sans-serif" fontSize="50" fontWeight="900"
      fill="#FFCB05" stroke="#3B4CCA" strokeWidth="5" paintOrder="stroke">Pokémon</text>
  </svg>
);
const FunkoLogo = () => (
  <svg viewBox="0 0 160 50" xmlns="http://www.w3.org/2000/svg" className="w-20 h-8">
    <rect x="1" y="1" width="158" height="48" rx="8" fill="#E31837" />
    <text x="80" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="30" fontWeight="900"
      fill="white" textAnchor="middle">FUNKO</text>
  </svg>
);
const OnePieceLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="34" fontWeight="900"
      fill="#D4AF37" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">ONE PIECE</text>
    <text x="4" y="54" fontFamily="Arial Black, Impact, sans-serif" fontSize="18" fontWeight="700"
      fill="#D4AF37" stroke="#1a0a00" strokeWidth="2" paintOrder="stroke">CARD GAME</text>
  </svg>
);
const MagicLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="28" fontWeight="900"
      fill="#B5860D" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">MAGIC</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="16" fontWeight="700"
      fill="#B5860D" stroke="#1a0a00" strokeWidth="2" paintOrder="stroke">THE GATHERING</text>
  </svg>
);
const YugiohLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="38" fontWeight="900"
      fill="#C8A951" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">Yu-Gi-Oh!</text>
  </svg>
);
const LorcanaLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="42" fontWeight="900"
      fill="#7B68EE" stroke="#1a0a1a" strokeWidth="3" paintOrder="stroke">Lorcana</text>
  </svg>
);
const DigimonLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="42" fontWeight="900"
      fill="#00AEEF" stroke="#003366" strokeWidth="3" paintOrder="stroke">Digimon</text>
  </svg>
);
const DragonBallLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="28" fontWeight="900"
      fill="#FF6600" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">DRAGON BALL</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="16" fontWeight="700"
      fill="#FF6600" stroke="#1a0a00" strokeWidth="2" paintOrder="stroke">SUPER CARD GAME</text>
  </svg>
);
const StarWarsLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="32" fontWeight="900"
      fill="#FFE81F" stroke="#1a1a00" strokeWidth="3" paintOrder="stroke">STAR WARS</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="16" fontWeight="700"
      fill="#FFE81F" stroke="#1a1a00" strokeWidth="2" paintOrder="stroke">UNLIMITED</text>
  </svg>
);
const WoWLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#F4C430" stroke="#3D0000" strokeWidth="2" paintOrder="stroke">WORLD OF</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#F4C430" stroke="#3D0000" strokeWidth="2" paintOrder="stroke">WARCRAFT</text>
  </svg>
);
const GundamLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="40" fontWeight="900"
      fill="#C0C0C0" stroke="#1a1a1a" strokeWidth="3" paintOrder="stroke">GUNDAM</text>
  </svg>
);
const WeissSchwarzLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#FFFFFF" stroke="#333333" strokeWidth="2" paintOrder="stroke">WEISS</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#333333" stroke="#999999" strokeWidth="2" paintOrder="stroke">SCHWARZ</text>
  </svg>
);
const VanguardLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="34" fontWeight="900"
      fill="#E74C3C" stroke="#1a0000" strokeWidth="3" paintOrder="stroke">VANGUARD</text>
  </svg>
);
const FleshBloodLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="24" fontWeight="900"
      fill="#CC0000" stroke="#1a0000" strokeWidth="2" paintOrder="stroke">FLESH &</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="24" fontWeight="900"
      fill="#CC0000" stroke="#1a0000" strokeWidth="2" paintOrder="stroke">BLOOD</text>
  </svg>
);
const RiftboundLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="36" fontWeight="900"
      fill="#9B59B6" stroke="#1a0a1a" strokeWidth="3" paintOrder="stroke">Riftbound</text>
  </svg>
);

const COLLECTIONS = [
  { key: 'pokemon', label: 'Pokémon TCG', Logo: PokemonLogo, desc: 'Cartas, escáner IA, deck builder', route: RoutePaths.PokemonHome, bg: 'from-yellow-500/15 to-blue-600/15', border: 'border-yellow-500/20', color: '#FFCB05', active: true },
  { key: 'funko', label: 'Funko Pop', Logo: FunkoLogo, desc: 'Colección, precios eBay, wishlist', route: RoutePaths.FunkoHome, bg: 'from-red-600/15 to-pink-500/15', border: 'border-red-500/20', color: '#E31837', active: true },
  { key: 'onepiece', label: 'One Piece TCG', Logo: OnePieceLogo, desc: 'Explorador, escáner, deck builder', route: RoutePaths.OnePieceHome, bg: 'from-yellow-500/10 to-red-500/10', border: 'border-yellow-500/15', color: '#D4AF37', active: true },
  { key: 'magic', label: 'Magic: The Gathering', Logo: MagicLogo, desc: 'Próximamente', route: null, bg: 'from-amber-700/10 to-amber-500/10', border: 'border-amber-700/10', color: '#B5860D', active: false },
  { key: 'yugioh', label: 'Yu-Gi-Oh!', Logo: YugiohLogo, desc: 'Próximamente', route: null, bg: 'from-yellow-700/10 to-yellow-500/10', border: 'border-yellow-700/10', color: '#C8A951', active: false },
  { key: 'lorcana', label: 'Lorcana', Logo: LorcanaLogo, desc: 'Próximamente', route: null, bg: 'from-purple-500/10 to-blue-500/10', border: 'border-purple-500/10', color: '#7B68EE', active: false },
  { key: 'digimon', label: 'Digimon TCG', Logo: DigimonLogo, desc: 'Próximamente', route: null, bg: 'from-blue-500/10 to-cyan-500/10', border: 'border-blue-500/10', color: '#00AEEF', active: false },
  { key: 'dragonball', label: 'Dragon Ball SCG', Logo: DragonBallLogo, desc: 'Próximamente', route: null, bg: 'from-orange-500/10 to-yellow-500/10', border: 'border-orange-500/10', color: '#FF6600', active: false },
  { key: 'starwars', label: 'Star Wars Unlimited', Logo: StarWarsLogo, desc: 'Próximamente', route: null, bg: 'from-yellow-400/10 to-gray-700/10', border: 'border-yellow-400/10', color: '#FFE81F', active: false },
  { key: 'wow', label: 'World of Warcraft', Logo: WoWLogo, desc: 'Próximamente', route: null, bg: 'from-yellow-600/10 to-orange-700/10', border: 'border-yellow-600/10', color: '#F4C430', active: false },
  { key: 'gundam', label: 'Gundam TCG', Logo: GundamLogo, desc: 'Próximamente', route: null, bg: 'from-gray-500/10 to-blue-500/10', border: 'border-gray-500/10', color: '#C0C0C0', active: false },
  { key: 'weisschwarz', label: 'Weiss Schwarz', Logo: WeissSchwarzLogo, desc: 'Próximamente', route: null, bg: 'from-white/5 to-gray-500/10', border: 'border-white/10', color: '#FFFFFF', active: false },
  { key: 'vanguard', label: 'Cardfight!! Vanguard', Logo: VanguardLogo, desc: 'Próximamente', route: null, bg: 'from-red-500/10 to-orange-500/10', border: 'border-red-500/10', color: '#E74C3C', active: false },
  { key: 'fleshandblood', label: 'Flesh & Blood', Logo: FleshBloodLogo, desc: 'Próximamente', route: null, bg: 'from-red-800/10 to-gray-700/10', border: 'border-red-800/10', color: '#CC0000', active: false },
  { key: 'riftbound', label: 'Riftbound', Logo: RiftboundLogo, desc: 'Próximamente', route: null, bg: 'from-purple-600/10 to-indigo-500/10', border: 'border-purple-600/10', color: '#9B59B6', active: false },
];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomePage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const name = useDisplayName(telegramUser);

  const [defaultCollection, setDefaultCollection] = useState<string | null>(
    localStorage.getItem('collectiq_default_collection')
  );
  const [isPremium, setIsPremium] = useState(false);
  const [stats, setStats] = useState<Record<string, { items: number; value: number }>>({});

  useEffect(() => {
    if (!telegramUser?.id) return;
    supabase.from('user_premium').select('plan, expires_at').eq('telegram_user_id', telegramUser.id).maybeSingle()
      .then(({ data }) => { if (data?.plan === 'go' && data.expires_at) setIsPremium(new Date(data.expires_at) > new Date()); });
    supabase.from('collection_items').select('market_price').eq('telegram_user_id', telegramUser.id).eq('tcg', 'pokemon')
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, pokemon: { items: data.length, value: data.reduce((s, c) => s + (c.market_price ?? 0), 0) } })); });
    supabase.from('funko_collection').select('quantity, market_value').eq('telegram_user_id', telegramUser.id)
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, funko: { items: data.reduce((s, f) => s + f.quantity, 0), value: data.reduce((s, f) => s + ((f.market_value ?? 0) * f.quantity), 0) } })); });
    supabase.from('collection_items').select('market_price').eq('telegram_user_id', telegramUser.id).eq('tcg', 'onepiece')
      .then(({ data }) => { if (data) setStats(prev => ({ ...prev, onepiece: { items: data.length, value: data.reduce((s, c) => s + (c.market_price ?? 0), 0) } })); });
  }, [telegramUser?.id]);

  const setDefault = (key: string) => { localStorage.setItem('collectiq_default_collection', key); setDefaultCollection(key); };
  const clearDefault = () => { localStorage.removeItem('collectiq_default_collection'); setDefaultCollection(null); };

  const activeCollections = COLLECTIONS.filter(c => c.active);
  const comingCollections = COLLECTIONS.filter(c => !c.active);
  const defaultCol = activeCollections.find(c => c.key === defaultCollection);

  return (
    <div className="min-h-screen bg-[#080810] text-white pb-28">
      {/* Header */}
      <div className="px-4 pt-8 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{greetingByHour()},</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {name}
            {isPremium && <span className="text-xs bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded-full font-bold">GO ⚡</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(RoutePaths.BugReport)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          </button>
          <button onClick={() => navigate(RoutePaths.Notifications)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
            <Bell className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => navigate(RoutePaths.Profile)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center overflow-hidden">
            {telegramUser?.photo_url
              ? <img src={telegramUser.photo_url} className="w-9 h-9 object-cover" alt="avatar" />
              : <span className="text-sm font-bold text-white">{name?.[0]?.toUpperCase()}</span>}
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5 mt-4">
        {/* Colección principal */}
        {defaultCol ? (
          <button onClick={() => navigate(defaultCol.route!)}
            className={`w-full relative overflow-hidden bg-gradient-to-br ${defaultCol.bg} border ${defaultCol.border} rounded-3xl p-5 active:scale-[0.98] transition-transform text-left`}>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: defaultCol.color }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">MI COLECCIÓN PRINCIPAL</span>
                <button onClick={e => { e.stopPropagation(); clearDefault(); }} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">cambiar</button>
              </div>
              <defaultCol.Logo />
              <p className="text-xs text-white/40 mt-1 mb-3">{defaultCol.desc}</p>
              {stats[defaultCol.key] && (
                <div className="flex gap-3 mb-3">
                  <div className="bg-white/10 rounded-xl px-3 py-2">
                    <p className="text-base font-bold text-white">{stats[defaultCol.key].items}</p>
                    <p className="text-[10px] text-white/50">items</p>
                  </div>
                  {stats[defaultCol.key].value > 0 && (
                    <div className="bg-white/10 rounded-xl px-3 py-2">
                      <p className="text-base font-bold text-white">€{stats[defaultCol.key].value.toFixed(0)}</p>
                      <p className="text-[10px] text-white/50">valor est.</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1 text-white/50">
                <span className="text-xs font-medium">Abrir colección</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </button>
        ) : (
          <div className="bg-white/5 border border-white/8 rounded-3xl p-5 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto">
              <Star className="w-6 h-6 text-yellow-400" />
            </div>
            <p className="text-sm font-bold text-white">Elige tu colección principal</p>
            <p className="text-xs text-gray-500">Pulsa la estrella en una colección para destacarla aquí</p>
          </div>
        )}

        {/* Acceso rápido — solo Marketplace */}
        <button onClick={() => navigate(RoutePaths.Marketplace)}
          className="w-full bg-gradient-to-br from-green-600/15 to-emerald-500/15 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3 active:scale-95 transition-transform text-left">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Marketplace</p>
            <p className="text-[10px] text-gray-400">Compra, vende e intercambia</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
        </button>

        {/* Mis colecciones activas */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis colecciones</p>
          {activeCollections.map(col => (
            <div key={col.key} className={`bg-gradient-to-r ${col.bg} border ${col.border} rounded-2xl p-4 flex items-center gap-3`}>
              <button onClick={() => navigate(col.route!)} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-16 h-10 flex items-center justify-center shrink-0"><col.Logo /></div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-white">{col.label}</p>
                  <p className="text-xs text-white/40">
                    {stats[col.key]
                      ? `${stats[col.key].items} items${stats[col.key].value > 0 ? ` · €${stats[col.key].value.toFixed(0)}` : ''}`
                      : col.desc}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
              </button>
              <button
                onClick={() => defaultCollection === col.key ? clearDefault() : setDefault(col.key)}
                className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all ${defaultCollection === col.key ? 'bg-yellow-500 text-black' : 'bg-white/5 border border-white/10 text-gray-600'}`}>
                <Star className="w-3.5 h-3.5" fill={defaultCollection === col.key ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>

        {/* Banner GO */}
        {!isPremium && (
          <button onClick={() => navigate(RoutePaths.Premium)}
            className="w-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">Hazte GO</p>
              <p className="text-xs text-gray-400">Escaneos ilimitados, marketplace ilimitado y más</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        )}

        {/* Próximamente */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Próximamente</p>
          <div className="grid grid-cols-2 gap-3">
            {comingCollections.map(col => (
              <div key={col.key} className={`bg-gradient-to-br ${col.bg} border ${col.border} rounded-2xl p-3 flex flex-col items-center gap-2 opacity-50`}>
                <col.Logo />
                <p className="text-[10px] font-bold text-gray-500 text-center">{col.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}