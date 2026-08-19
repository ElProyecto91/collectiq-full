import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { Users, Zap, BarChart2, Gift, Search, ArrowLeft } from 'lucide-react';

const ADMIN_ID = 1299079722;

interface UserStats {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  totalCards: number;
  totalDecks: number;
  totalScans: number;
  isPremium: boolean;
  premiumExpires: string | null;
  lastSeen: string | null;
}

interface GlobalStats {
  totalUsers: number;
  totalCards: number;
  totalDecks: number;
  totalScans: number;
  premiumUsers: number;
}

export function AdminPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [giftingId, setGiftingId] = useState<number | null>(null);
  const [giftInput, setGiftInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    if (telegramUser.id !== ADMIN_ID) {
      navigate('/');
      return;
    }
    loadData();
  }, [telegramUser?.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: rawSessions } = await supabase
        .from('user_sessions')
        .select('telegram_user_id, user_data, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!rawSessions) return;

      // Deduplicar — quedarse solo con la sesión más reciente por usuario
      const seen = new Set<number>();
      const sessions = rawSessions.filter(s => {
        if (seen.has(s.telegram_user_id)) return false;
        seen.add(s.telegram_user_id);
        return true;
      });

      const userStats = await Promise.all(sessions.map(async session => {
        const ud = session.user_data ?? {};

        const [
          { count: totalCards },
          { count: totalDecks },
          { count: totalScans },
          { data: premiumData },
        ] = await Promise.all([
          supabase.from('collection_items').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id),
          supabase.from('decks').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id),
          supabase.from('activity_feed').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id).eq('type', 'scan'),
          supabase.from('user_premium').select('plan, expires_at').eq('telegram_user_id', session.telegram_user_id).maybeSingle(),
        ]);

        const isExpired = premiumData?.expires_at
          ? new Date(premiumData.expires_at) < new Date()
          : true;

        return {
          telegram_user_id: session.telegram_user_id,
          username: ud.username ?? null,
          first_name: ud.first_name ?? null,
          totalCards: totalCards ?? 0,
          totalDecks: totalDecks ?? 0,
          totalScans: totalScans ?? 0,
          isPremium: premiumData?.plan === 'go' && !isExpired,
          premiumExpires: premiumData?.expires_at ?? null,
          lastSeen: session.created_at,
        };
      }));

      setUsers(userStats);

      setGlobalStats({
        totalUsers: sessions.length,
        totalCards: userStats.reduce((s, u) => s + u.totalCards, 0),
        totalDecks: userStats.reduce((s, u) => s + u.totalDecks, 0),
        totalScans: userStats.reduce((s, u) => s + u.totalScans, 0),
        premiumUsers: userStats.filter(u => u.isPremium).length,
      });

    } finally {
      setIsLoading(false);
    }
  };

  const giveGO = async (userId: number, months: number = 1) => {
    const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('user_premium').upsert({
      telegram_user_id: userId,
      plan: 'go',
      expires_at: expiresAt,
      stars_paid: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' });

    if (!error) {
      setStatusMsg('✅ GO activado para ' + userId + ' hasta ' + new Date(expiresAt).toLocaleDateString('es-ES'));
      setUsers(prev => prev.map(u => u.telegram_user_id === userId ? { ...u, isPremium: true, premiumExpires: expiresAt } : u));
    } else {
      setStatusMsg('❌ Error: ' + error.message);
    }
    setTimeout(() => setStatusMsg(''), 4000);
    setGiftingId(null);
  };

  const giveGOByInput = async () => {
    const userId = parseInt(giftInput.trim());
    if (isNaN(userId)) { setStatusMsg('❌ ID inválido'); return; }
    await giveGO(userId);
    setGiftInput('');
  };

  const revokeGO = async (userId: number) => {
    await supabase.from('user_premium').update({ plan: 'free', expires_at: null }).eq('telegram_user_id', userId);
    setUsers(prev => prev.map(u => u.telegram_user_id === userId ? { ...u, isPremium: false, premiumExpires: null } : u));
    setStatusMsg('✅ GO revocado para ' + userId);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  if (!telegramUser || telegramUser.id !== ADMIN_ID) return null;

  const filtered = users.filter(u =>
    (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.first_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    u.telegram_user_id.toString().includes(search)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ADMIN</p>
          <h1 className="text-lg font-bold">Panel de Control</h1>
        </div>
      </div>

      <div className="px-4 space-y-4">

        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        {/* Stats globales */}
        {globalStats && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Usuarios', value: globalStats.totalUsers, color: 'text-blue-400', icon: <Users size={14} /> },
              { label: 'GO activos', value: globalStats.premiumUsers, color: 'text-yellow-400', icon: <Zap size={14} /> },
              { label: 'Cartas totales', value: globalStats.totalCards, color: 'text-purple-400', icon: <BarChart2 size={14} /> },
              { label: 'Escaneos totales', value: globalStats.totalScans, color: 'text-green-400', icon: <BarChart2 size={14} /> },
            ].map(item => (
              <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-gray-500 mb-1">
                  {item.icon}
                  <p className="text-[10px] uppercase tracking-wider">{item.label}</p>
                </div>
                <p className={'text-2xl font-bold ' + item.color}>{item.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Dar GO por ID */}
        <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
            <Gift size={14} className="text-yellow-400" /> Dar GO por Telegram ID
          </p>
          <div className="flex gap-2">
            <input value={giftInput} onChange={e => setGiftInput(e.target.value)}
              placeholder="Telegram ID..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
            <button onClick={giveGOByInput}
              className="px-4 py-2.5 rounded-xl bg-yellow-500 text-black text-sm font-bold active:scale-95 transition-transform">
              Dar GO
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
        </div>

        {/* Lista de usuarios */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Cargando usuarios...</div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">{filtered.length} usuarios</p>
            {filtered.map(user => {
              const displayName = user.first_name ?? user.username ?? 'Usuario';
              return (
                <div key={user.telegram_user_id}
                  className={'bg-[#111118] border rounded-2xl p-4 space-y-3 ' + (user.isPremium ? 'border-yellow-500/20' : 'border-white/8')}>
                  <div className="flex items-center gap-3">
                    <div className={'w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + (user.isPremium ? 'bg-yellow-500/20' : 'bg-blue-600/20')}>
                      <span className={'font-bold text-sm ' + (user.isPremium ? 'text-yellow-400' : 'text-blue-400')}>
                        {displayName[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{displayName}</p>
                        {user.isPremium && <span className="text-[9px] bg-yellow-500 text-black font-black px-1.5 py-0.5 rounded-full shrink-0">GO</span>}
                      </div>
                      {user.username && <p className="text-xs text-gray-500">@{user.username}</p>}
                      <p className="text-[10px] text-gray-600">{user.telegram_user_id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Cartas', value: user.totalCards, color: 'text-blue-400' },
                      { label: 'Mazos', value: user.totalDecks, color: 'text-purple-400' },
                      { label: 'Escaneos', value: user.totalScans, color: 'text-green-400' },
                    ].map(item => (
                      <div key={item.label} className="bg-white/5 rounded-xl p-2 text-center">
                        <p className={'text-sm font-bold ' + item.color}>{item.value}</p>
                        <p className="text-[9px] text-gray-500">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {user.isPremium && user.premiumExpires && (
                    <p className="text-[10px] text-yellow-500">
                      GO hasta {new Date(user.premiumExpires).toLocaleDateString('es-ES')}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {giftingId === user.telegram_user_id ? (
                      <>
                        {[1, 3, 6, 12].map(months => (
                          <button key={months} onClick={() => giveGO(user.telegram_user_id, months)}
                            className="flex-1 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold active:scale-95">
                            {months}m
                          </button>
                        ))}
                        <button onClick={() => setGiftingId(null)}
                          className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 text-xs">
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setGiftingId(user.telegram_user_id)}
                          className="flex-1 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium active:scale-95">
                          <Gift size={12} className="inline mr-1" />
                          Dar GO
                        </button>
                        {user.isPremium && (
                          <button onClick={() => revokeGO(user.telegram_user_id)}
                            className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium active:scale-95">
                            Revocar GO
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}