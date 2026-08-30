import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Star, BarChart2, Package, Heart, ChevronRight, Zap, Settings, Eye, EyeOff } from 'lucide-react';
import { useUserStore } from '@/store';
import { useDisplayName } from '@/hooks';
import { getSupabase } from '@/lib/supabase';
import { RoutePaths } from '@/config';
import { useCurrency } from '@/hooks/use-currency';

interface TCGStats {
  key: string;
  label: string;
  icon: string;
  color: string;
  route: string;
  items: number;
  value: number;
  wishlist: number;
  active: boolean;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore(s => s.telegramUser);
  const setTelegramUser = useUserStore(s => s.setTelegramUser);
  const name = useDisplayName(telegramUser);
  const { formatPrice } = useCurrency();

  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpires, setPremiumExpires] = useState<string | null>(null);
  const [scansUsed, setScansUsed] = useState(0);
  const [tcgStats, setTcgStats] = useState<TCGStats[]>([]);
  const [hiddenTCGs, setHiddenTCGs] = useState<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('collectiq_hidden_tcgs') || '[]')
  ));
  const [loading, setLoading] = useState(true);

  const TCG_CONFIG = [
    { key: 'pokemon',  label: 'Pokémon TCG',   icon: '⚡', color: '#FFCB05', route: RoutePaths.PokemonHome },
    { key: 'onepiece', label: 'One Piece TCG',  icon: '☠️', color: '#E74C3C', route: '/onepiece' },
    { key: 'funko',    label: 'Funko Pop',       icon: '🎭', color: '#E31837', route: RoutePaths.FunkoHome },
  ];

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadProfile();
  }, [telegramUser?.id]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Premium
      const { data: prem } = await getSupabase().from('user_premium')
        .select('plan, expires_at, is_active')
        .eq('telegram_user_id', telegramUser!.id)
        .maybeSingle();
      if (prem?.is_active && prem.expires_at) {
        const exp = new Date(prem.expires_at);
        if (exp > new Date()) {
          setIsPremium(true);
          setPremiumExpires(exp.toLocaleDateString('es-ES'));
        }
      }

      // Escaneos hoy
      const { data: scans } = await getSupabase().from('user_scans')
        .select('scans_today, last_scan_date')
        .eq('telegram_user_id', telegramUser!.id)
        .maybeSingle();
      const today = new Date().toISOString().split('T')[0];
      if (scans?.last_scan_date === today) setScansUsed(scans.scans_today || 0);

      // Stats por TCG
      const stats: TCGStats[] = [];

      // Pokémon
      const { data: pkCards } = await getSupabase().from('collection_items')
        .select('market_price, quantity').eq('telegram_user_id', telegramUser!.id).eq('tcg', 'pokemon');
      const { count: pkWish } = await getSupabase().from('wishlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_user_id', telegramUser!.id).eq('tcg', 'pokemon');
      stats.push({
        ...TCG_CONFIG[0],
        items: pkCards?.length || 0,
        value: pkCards?.reduce((s, c) => s + (c.market_price ?? 0) * c.quantity, 0) || 0,
        wishlist: pkWish || 0,
        active: (pkCards?.length || 0) > 0,
      });

      // One Piece
      const { data: opCards } = await getSupabase().from('collection_items')
        .select('market_price, quantity').eq('telegram_user_id', telegramUser!.id).eq('tcg', 'onepiece');
      const { count: opWish } = await getSupabase().from('wishlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_user_id', telegramUser!.id).eq('tcg', 'onepiece');
      stats.push({
        ...TCG_CONFIG[1],
        items: opCards?.length || 0,
        value: opCards?.reduce((s, c) => s + (c.market_price ?? 0) * c.quantity, 0) || 0,
        wishlist: opWish || 0,
        active: (opCards?.length || 0) > 0,
      });

      // Funko
      const { data: fkItems } = await getSupabase().from('funko_collection')
        .select('market_value, quantity').eq('telegram_user_id', telegramUser!.id);
      const { count: fkWish } = await getSupabase().from('funko_wishlist')
        .select('id', { count: 'exact', head: true })
        .eq('telegram_user_id', telegramUser!.id);
      stats.push({
        ...TCG_CONFIG[2],
        items: fkItems?.reduce((s, f) => s + f.quantity, 0) || 0,
        value: fkItems?.reduce((s, f) => s + (f.market_value ?? 0) * f.quantity, 0) || 0,
        wishlist: fkWish || 0,
        active: (fkItems?.length || 0) > 0,
      });

      setTcgStats(stats);
    } catch (e) {}
    setLoading(false);
  };

  const toggleHide = (key: string) => {
    const next = new Set(hiddenTCGs);
    if (next.has(key)) next.delete(key); else next.add(key);
    setHiddenTCGs(next);
    localStorage.setItem('collectiq_hidden_tcgs', JSON.stringify([...next]));
  };

  const totalValue = tcgStats.reduce((s, t) => s + t.value, 0);
  const totalItems = tcgStats.reduce((s, t) => s + t.items, 0);
  const visibleStats = tcgStats.filter(t => !hiddenTCGs.has(t.key));
  const hiddenStats = tcgStats.filter(t => hiddenTCGs.has(t.key) && t.active);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-28">
      {/* Header con avatar */}
      <div className="relative px-4 pt-8 pb-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 to-transparent" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold overflow-hidden shrink-0">
            {telegramUser?.photo_url
              ? <img src={telegramUser.photo_url} alt={name} className="w-full h-full object-cover" />
              : name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{name}</h1>
            {telegramUser?.username && <p className="text-sm text-gray-400">@{telegramUser.username}</p>}
            {isPremium
              ? <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full mt-1 font-bold">⚡ GO hasta {premiumExpires}</span>
              : <span className="inline-flex items-center gap-1 text-xs bg-white/5 text-gray-500 px-2 py-0.5 rounded-full mt-1">Plan FREE · {Math.max(0, 5 - scansUsed)} escaneos hoy</span>
            }
          </div>
          <button onClick={() => navigate(RoutePaths.Premium)} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Settings size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Resumen total */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{formatPrice(totalValue)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Valor total colección</p>
          </div>
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{totalItems}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Items en colección</p>
          </div>
        </div>

        {/* Stats por TCG */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mis colecciones</p>
            {hiddenStats.length > 0 && (
              <p className="text-[10px] text-gray-600">{hiddenStats.length} oculta{hiddenStats.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {visibleStats.map(tcg => (
                <div key={tcg.key} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <button onClick={() => tcg.active && navigate(tcg.route)} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: tcg.color + '20', border: `1px solid ${tcg.color}30` }}>
                        {tcg.icon}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-bold text-white">{tcg.label}</p>
                        {tcg.active ? (
                          <p className="text-[10px] text-gray-500">
                            {tcg.items} items · {formatPrice(tcg.value)}
                            {tcg.wishlist > 0 && ` · ${tcg.wishlist} wishlist`}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-600">Sin cartas todavía</p>
                        )}
                      </div>
                      {tcg.active && <ChevronRight size={14} className="text-gray-600 shrink-0" />}
                    </button>
                    <button onClick={() => toggleHide(tcg.key)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <EyeOff size={12} className="text-gray-600" />
                    </button>
                  </div>

                  {/* Barra de valor relativo */}
                  {tcg.active && totalValue > 0 && (
                    <div className="px-4 pb-3">
                      <div className="w-full bg-white/5 rounded-full h-1">
                        <div className="h-1 rounded-full transition-all"
                          style={{ width: `${Math.round((tcg.value / totalValue) * 100)}%`, backgroundColor: tcg.color }} />
                      </div>
                      <p className="text-[9px] text-gray-600 mt-1">
                        {Math.round((tcg.value / totalValue) * 100)}% del valor total
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Colecciones ocultas */}
              {hiddenStats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">Ocultas</p>
                  {hiddenStats.map(tcg => (
                    <div key={tcg.key} className="bg-white/3 border border-white/5 rounded-2xl p-3 flex items-center gap-3 opacity-50">
                      <span className="text-lg">{tcg.icon}</span>
                      <p className="text-xs text-gray-500 flex-1">{tcg.label}</p>
                      <button onClick={() => toggleHide(tcg.key)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Eye size={12} className="text-gray-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* GO Banner */}
        {!isPremium && (
          <button onClick={() => navigate(RoutePaths.Premium)}
            className="w-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
              <Zap size={18} className="text-yellow-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">Hazte CollectIQ GO</p>
              <p className="text-xs text-gray-400">Escaneos ilimitados, marketplace sin límites y más</p>
            </div>
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        )}

        {/* Accesos rápidos */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <BarChart2 size={18} className="text-blue-400" />, label: 'Stats', route: RoutePaths.Stats },
            { icon: <Heart size={18} className="text-pink-400" />, label: 'Wishlist', route: RoutePaths.Wishlist },
            { icon: <Star size={18} className="text-yellow-400" />, label: 'Logros', route: RoutePaths.Achievements },
            { icon: <Package size={18} className="text-purple-400" />, label: 'Decks', route: RoutePaths.Decks },
          ].map(({ icon, label, route }) => (
            <button key={label} onClick={() => navigate(route)}
              className="bg-[#111118] border border-white/8 rounded-2xl py-3 flex flex-col items-center gap-2 active:scale-95 transition-transform">
              {icon}
              <span className="text-[10px] text-gray-400">{label}</span>
            </button>
          ))}
        </div>

        {/* Cerrar sesión */}
        <button onClick={() => { setTelegramUser(null); navigate('/login'); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/8 text-gray-500 text-sm active:scale-95 transition-transform">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}