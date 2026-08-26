import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Star, Zap } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { useDisplayName } from '@/hooks';
import { supabase } from '@/lib/supabase';

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

const YugiohLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="38" fontWeight="900"
      fill="#C8A951" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">Yu-Gi-Oh!</text>
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

const WoWLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#F4C430" stroke="#3D0000" strokeWidth="2" paintOrder="stroke">WORLD OF</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="22" fontWeight="900"
      fill="#F4C430" stroke="#3D0000" strokeWidth="2" paintOrder="stroke">WARCRAFT</text>
  </svg>
);

const DragonBallLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="36" fontFamily="Arial Black, Impact, sans-serif" fontSize="28" fontWeight="900"
      fill="#FF6600" stroke="#1a0a00" strokeWidth="3" paintOrder="stroke">DRAGON BALL</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="18" fontWeight="700"
      fill="#FF6600" stroke="#1a0a00" strokeWidth="2" paintOrder="stroke">SUPER CARD GAME</text>
  </svg>
);

const GundamLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="40" fontWeight="900"
      fill="#C0C0C0" stroke="#1a1a1a" strokeWidth="3" paintOrder="stroke">GUNDAM</text>
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

const RiftboundLogo = () => (
  <svg viewBox="0 0 220 55" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="44" fontFamily="Arial Black, Impact, sans-serif" fontSize="36" fontWeight="900"
      fill="#9B59B6" stroke="#1a0a1a" strokeWidth="3" paintOrder="stroke">Riftbound</text>
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

const FreshBloodLogo = () => (
  <svg viewBox="0 0 220 60" xmlns="http://www.w3.org/2000/svg" className="w-28 h-9">
    <text x="4" y="32" fontFamily="Arial Black, Impact, sans-serif" fontSize="24" fontWeight="900"
      fill="#CC0000" stroke="#1a0000" strokeWidth="2" paintOrder="stroke">FLESH &</text>
    <text x="4" y="56" fontFamily="Arial Black, Impact, sans-serif" fontSize="24" fontWeight="900"
      fill="#CC0000" stroke="#1a0000" strokeWidth="2" paintOrder="stroke">BLOOD</text>
  </svg>
);

const COLLECTIONS = [
  {
    key: 'pokemon',
    label: 'Pokémon TCG',
    LogoComponent: PokemonLogo,
    desc: 'Cartas, escáner IA, deck builder',
    route: '/pokemon',
    bg: 'from-yellow-500/15 to-blue-600/15',
    border: 'border-yellow-500/20',
    active: true,
    color: '#FFCB05',
  },
  {
    key: 'funko',
    label: 'Funko Pop',
    LogoComponent: FunkoLogo,
    desc: 'Colección, precios eBay, wishlist',
    route: RoutePaths.FunkoHome,
    bg: 'from-red-600/15 to-pink-500/15',
    border: 'border-red-500/20',
    active: true,
    color: '#E31837',
  },
  {
    key: 'magic',
    label: 'Magic: The Gathering',
    LogoComponent: MagicLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-amber-700/10 to-amber-500/10',
    border: 'border-amber-700/15',
    active: false,
    color: '#B5860D',
  },
  {
    key: 'onepiece',
    label: 'One Piece TCG',
    LogoComponent: OnePieceLogo,
    desc: 'Próximamente',
    route: '/onepiece',
    bg: 'from-yellow-500/10 to-red-500/10',
    border: 'border-yellow-500/10',
    active: true,
    color: '#D4AF37',
  },
  {
    key: 'yugioh',
    label: 'Yu-Gi-Oh!',
    LogoComponent: YugiohLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-yellow-700/10 to-yellow-500/10',
    border: 'border-yellow-700/15',
    active: false,
    color: '#C8A951',
  },
  {
    key: 'lorcana',
    label: 'Lorcana',
    LogoComponent: LorcanaLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-purple-500/10 to-blue-500/10',
    border: 'border-purple-500/10',
    active: false,
    color: '#7B68EE',
  },
  {
    key: 'digimon',
    label: 'Digimon TCG',
    LogoComponent: DigimonLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-blue-500/10 to-cyan-500/10',
    border: 'border-blue-500/10',
    active: false,
    color: '#00AEEF',
  },
  {
    key: 'wow',
    label: 'World of Warcraft',
    LogoComponent: WoWLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-yellow-600/10 to-orange-700/10',
    border: 'border-yellow-600/10',
    active: false,
    color: '#F4C430',
  },
  {
    key: 'dragonball',
    label: 'Dragon Ball SCG',
    LogoComponent: DragonBallLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-orange-500/10 to-yellow-500/10',
    border: 'border-orange-500/10',
    active: false,
    color: '#FF6600',
  },
  {
    key: 'gundam',
    label: 'Gundam TCG',
    LogoComponent: GundamLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-gray-500/10 to-blue-500/10',
    border: 'border-gray-500/10',
    active: false,
    color: '#C0C0C0',
  },
  {
    key: 'starwars',
    label: 'Star Wars Unlimited',
    LogoComponent: StarWarsLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-yellow-400/10 to-gray-700/10',
    border: 'border-yellow-400/10',
    active: false,
    color: '#FFE81F',
  },
  {
    key: 'riftbound',
    label: 'Riftbound',
    LogoComponent: RiftboundLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-purple-600/10 to-indigo-500/10',
    border: 'border-purple-600/10',
    active: false,
    color: '#9B59B6',
  },
  {
    key: 'weisskschwarz',
    label: 'Weiss Schwarz',
    LogoComponent: WeissSchwarzLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-white/5 to-gray-500/10',
    border: 'border-white/10',
    active: false,
    color: '#FFFFFF',
  },
  {
    key: 'vanguard',
    label: 'Cardfight!! Vanguard',
    LogoComponent: VanguardLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-red-500/10 to-orange-500/10',
    border: 'border-red-500/10',
    active: false,
    color: '#E74C3C',
  },
  {
    key: 'freshandblood',
    label: 'Flesh & Blood',
    LogoComponent: FreshBloodLogo,
    desc: 'Próximamente',
    route: null,
    bg: 'from-red-800/10 to-gray-700/10',
    border: 'border-red-800/10',
    active: false,
    color: '#CC0000',
  },
];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomePage() {
  const navigate = useNavigate();
  const name = useDisplayName(telegramUser);
  const telegramUser = useUserStore(s => s.telegramUser);
  const [defaultCollection, setDefaultCollection] = useState<string | null>(
    localStorage.getItem('collectiq_default_collection')
  );
  const [funkos, setFunkos] = useState(0);
  const [funkoValue, setFunkoValue] = useState(0);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!telegramUser?.id) return;
    supabase
      .from('funko_collection')
      .select('quantity, market_value')
      .eq('telegram_user_id', telegramUser.id)
      .then(({ data }) => {
        if (data) {
          setFunkos(data.reduce((s, f) => s + f.quantity, 0));
          setFunkoValue(data.reduce((s, f) => s + ((f.market_value ?? 0) * f.quantity), 0));
        }
      });
    supabase
      .from('user_premium')
      .select('plan, expires_at')
      .eq('telegram_user_id', telegramUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.plan === 'go' && data.expires_at) {
          setIsPremium(new Date(data.expires_at) > new Date());
        }
      });
  }, [telegramUser?.id]);

  const setDefault = (key: string) => {
    localStorage.setItem('collectiq_default_collection', key);
    setDefaultCollection(key);
  };

  const clearDefault = () => {
    localStorage.removeItem('collectiq_default_collection');
    setDefaultCollection(null);
  };

  const defaultCol = COLLECTIONS.find(c => c.key === defaultCollection && c.active);
  const activeCollections = COLLECTIONS.filter(c => c.active);
  const comingCollections = COLLECTIONS.filter(c => !c.active);

  return (
    <div className="min-h-screen bg-[#080810] text-white pb-28">

      {/* Header */}
      <div className="px-4 pt-8 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{greetingByHour()},</p>
          <h1 className="text-2xl font-bold text-white">
            {name} {isPremium && <span className="text-yellow-400 text-lg">⚡</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/notifications')}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
            <Bell className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => navigate(RoutePaths.Profile)}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center overflow-hidden">
            {telegramUser?.photo_url
              ? <img src={telegramUser.photo_url} className="w-9 h-9 object-cover" alt="avatar" />
              : <span className="text-sm font-bold text-white">{name?.[0]?.toUpperCase()}</span>
            }
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5 mt-4">

        {/* Colección principal destacada */}
        {defaultCol ? (
          <div
            onClick={() => navigate(defaultCol.route!)}
            className={`relative overflow-hidden bg-gradient-to-br ${defaultCol.bg} border ${defaultCol.border} rounded-3xl p-5 active:scale-[0.98] transition-transform cursor-pointer`}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20"
              style={{ background: defaultCol.color }} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">MI COLECCIÓN PRINCIPAL</span>
                <button
                  onClick={e => { e.stopPropagation(); clearDefault(); }}
                  className="text-[10px] text-white/30 active:text-white/60">
                  cambiar
                </button>
              </div>
              <div className="mb-4">
                <defaultCol.LogoComponent />
                <p className="text-xs text-white/40 mt-1">{defaultCol.desc}</p>
              </div>
              {defaultCol.key === 'funko' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/10 rounded-2xl p-3">
                    <p className="text-lg font-bold text-white">{funkos}</p>
                    <p className="text-[10px] text-white/50">Funkos</p>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3">
                    <p className="text-lg font-bold text-white">{funkoValue > 0 ? `€${funkoValue.toFixed(0)}` : '—'}</p>
                    <p className="text-[10px] text-white/50">Valor</p>
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-1 text-white/60">
                <span className="text-xs font-medium">Abrir colección</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/8 rounded-3xl p-5 text-center space-y-2">
            <p className="text-2xl">⭐</p>
            <p className="text-sm font-bold text-white">Elige tu colección principal</p>
            <p className="text-xs text-gray-500">Pulsa la estrella en una colección para destacarla aquí</p>
          </div>
        )}

        {/* Mis colecciones activas */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis colecciones</p>
          {activeCollections.map(col => (
            <div key={col.key}
              className={`bg-gradient-to-r ${col.bg} border ${col.border} rounded-2xl p-4 flex items-center gap-3`}>
              <button
                onClick={() => navigate(col.route!)}
                className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-16 h-10 flex items-center justify-center shrink-0">
                  <col.LogoComponent />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-white">{col.label}</p>
                  <p className="text-xs text-white/40">{col.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
              </button>
              <button
                onClick={() => setDefault(col.key)}
                className={`shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                  defaultCollection === col.key
                    ? 'bg-yellow-500 text-black'
                    : 'bg-white/5 border border-white/10 text-gray-600'
                }`}>
                <Star className="w-3.5 h-3.5" fill={defaultCollection === col.key ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>

        {/* Premium banner */}
        {!isPremium && (
          <button onClick={() => navigate('/premium')}
            className="w-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">Hazte GO</p>
              <p className="text-xs text-gray-400">Escaneos ilimitados, IA avanzada y más</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        )}

        {/* Próximamente */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Próximamente</p>
          <div className="grid grid-cols-2 gap-3">
            {comingCollections.map(col => (
              <div key={col.key}
                className={`bg-gradient-to-br ${col.bg} border ${col.border} rounded-2xl p-3 flex flex-col items-center gap-2 opacity-60`}>
                <col.LogoComponent />
                <p className="text-[10px] font-bold text-gray-400 text-center">{col.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}