import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Bell, ChevronRight, Star, Zap, TrendingUp } from 'lucide-react';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { useDisplayName } from '@/hooks';
import { supabase } from '@/lib/supabase';

const COLLECTIONS = [
  {
    key: 'pokemon',
    label: 'Pokémon TCG',
    emoji: '⚡',
    desc: 'Cartas, escáner IA, deck builder',
    route: RoutePaths.Home,
    gradient: 'from-yellow-500 to-red-500',
    bg: 'from-yellow-500/15 to-red-500/15',
    border: 'border-yellow-500/20',
    active: true,
    color: '#F59E0B',
  },
  {
    key: 'funko',
    label: 'Funko Pop',
    emoji: '🎭',
    desc: 'Colección, precios eBay, wishlist',
    route: RoutePaths.FunkoHome,
    gradient: 'from-purple-500 to-pink-500',
    bg: 'from-purple-500/15 to-pink-500/15',
    border: 'border-purple-500/20',
    active: true,
    color: '#A855F7',
  },
  {
    key: 'yugioh',
    label: 'Yu-Gi-Oh!',
    emoji: '🃏',
    desc: 'Próximamente',
    route: null,
    gradient: 'from-blue-500 to-indigo-500',
    bg: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-blue-500/10',
    active: false,
    color: '#3B82F6',
  },
  {
    key: 'onepiece',
    label: 'One Piece TCG',
    emoji: '⚓',
    desc: 'Próximamente',
    route: null,
    gradient: 'from-red-500 to-orange-500',
    bg: 'from-red-500/10 to-orange-500/10',
    border: 'border-red-500/10',
    active: false,
    color: '#EF4444',
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
  const name = useDisplayName();
  const telegramUser = useUserStore(s => s.telegramUser);
  const [defaultCollection, setDefaultCollection] = useState<string | null>(
    localStorage.getItem('collectiq_default_collection')
  );
  const [funkos, setFunkos] = useState(0);
  const [funkoValue, setFunkoValue] = useState(0);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    if (!telegramUser?.id) return;
    // Cargar stats rápidas de Funko
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
    // Verificar premium
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

  const defaultCol = COLLECTIONS.find(c => c.key === defaultCollection && c.active);
  const activeCollections = COLLECTIONS.filter(c => c.active);
  const comingCollections = COLLECTIONS.filter(c => !c.active);

  return (
    <div className="min-h-screen bg-[#080810] text-white pb-28">

      {/* Header */}
      <div className="px-4 pt-8 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{greetingByHour()},</p>
          <h1 className="text-2xl font-bold text-white">{name} {isPremium && <span className="text-yellow-400 text-lg">⚡</span>}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/notifications')}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
            <Bell className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => navigate(RoutePaths.Profile)}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
            {telegramUser?.photo_url
              ? <img src={telegramUser.photo_url} className="w-9 h-9 rounded-xl object-cover" />
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
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em]">MI COLECCIÓN PRINCIPAL</span>
                <button
                  onClick={e => { e.stopPropagation(); setDefault(''); }}
                  className="text-[10px] text-white/30 active:text-white/60">
                  cambiar
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl">{defaultCol.emoji}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{defaultCol.label}</h2>
                  <p className="text-xs text-white/50">{defaultCol.desc}</p>
                </div>
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
            <p className="text-xs text-gray-500">Se mostrará destacada cada vez que abras la app</p>
          </div>
        )}

        {/* Mis colecciones activas */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis colecciones</p>
          {activeCollections.map(col => (
            <div key={col.key}
              className={`bg-gradient-to-r ${col.bg} border ${col.border} rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform`}>
              <button
                onClick={() => navigate(col.route!)}
                className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="text-2xl">{col.emoji}</span>
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
                }`}
                title="Establecer como principal">
                <Star className="w-3.5 h-3.5" fill={defaultCollection === col.key ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
        </div>

        {/* Premium banner si no es GO */}
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
          <div className="grid grid-cols-2 gap-2">
            {comingCollections.map(col => (
              <div key={col.key}
                className="bg-white/3 border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-2 opacity-50">
                <span className="text-2xl">{col.emoji}</span>
                <p className="text-xs font-bold text-gray-500 text-center">{col.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}