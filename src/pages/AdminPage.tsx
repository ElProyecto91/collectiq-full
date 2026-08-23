import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { Users, Zap, BarChart2, Gift, Search, ArrowLeft, TrendingUp } from 'lucide-react';

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

interface AnalyticsStats {
  totalEvents: number;
  pageViews: number;
  scanStarted: number;
  scanSuccess: number;
  scanFailed: number;
  cardAdded: number;
  goPurchaseStarted: number;
  goPurchaseCompleted: number;
  goPurchaseCancelled: number;
  adWatched: number;
  referralCopied: number;
  byPlatform: { platform: string; count: number }[];
  conversionRate: number;
}

export function AdminPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'analytics'>('users');
  const [search, setSearch] = useState('');
  const [giftingId, setGiftingId] = useState<number | null>(null);
  const [giftInput, setGiftInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    if (telegramUser.id !== ADMIN_ID) { navigate('/'); return; }
    fetch('/api/admin-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id }),
    })
      .then(r => r.json())
      .then(data => { if (!data.ok) navigate('/'); else { loadData(); loadAnalytics(); } })
      .catch(() => navigate('/'));
  }, [telegramUser?.id]);

  const loadAnalytics = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data } = await supabase
      .from('analytics_events')
      .select('event_name, platform, is_premium')
      .gte('created_at', since.toISOString())
      .eq('app_id', 'collectiq');

    if (!data) return;

    const count = (name: string) => data.filter(e => e.event_name === name).length;
    const started = count('go_purchase_started');
    const completed = count('go_purchase_completed');

    const platformMap: Record<string, number> = {};
    data.forEach(e => {
      const p = e.platform ?? 'unknown';
      platformMap[p] = (platformMap[p] ?? 0) + 1;
    });

    setAnalyticsStats({
      totalEvents: data.length,
      pageViews: count('page_view'),
      scanStarted: count('scan_started'),
      scanSuccess: count('scan_success'),
      scanFailed: count('scan_failed'),
      cardAdded: count('card_added'),
      goPurchaseStarted: started,
      goPurchaseCompleted: completed,
      goPurchaseCancelled: count('go_purchase_cancelled'),
      adWatched: count('ad_watched'),
      referralCopied: count('referral_link_copied'),
      byPlatform: Object.entries(platformMap).map(([platform, count]) => ({ platform, count })),
      conversionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    });
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: rawSessions } = await supabase
        .from('user_sessions')
        .select('telegram_user_id, user_data, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!rawSessions) return;

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

        const isExpired = premiumData?.expires_at ? new Date(premiumData.expires_at) < new Date() : true;

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

  const giveGO = async (userId: number, months: number = 1, days: number = 0) => {
    if (!telegramUser?.id) return;
    const res = await fetch('/api/admin-give-go', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id, targetUserId: userId, months, days }),
    });
    const data = await res.json();
    if (data.ok) {
      setStatusMsg('✅ GO activado para ' + userId + ' hasta ' + new Date(data.expiresAt).toLocaleDateString('es-ES'));
      setUsers(prev => prev.map(u => u.telegram_user_id === userId ? { ...u, isPremium: true, premiumExpires: data.expiresAt } : u));
    } else {
      setStatusMsg('❌ Error al activar GO');
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

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('users')}
            className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ' + (activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400')}>
            <Users size={14} className="inline mr-1.5" />Usuarios
          </button>
          <button onClick={() => setActiveTab('analytics')}
            className={'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ' + (activeTab === 'analytics' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400')}>
            <TrendingUp size={14} className="inline mr-1.5" />Analytics
          </button>
        </div>

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

        {/* TAB ANALYTICS */}
        {activeTab === 'analytics' && analyticsStats && (
          <div className="space-y-4">

            {/* Escaneos */}
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Escaneos — últimos 30 días</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Iniciados', value: analyticsStats.scanStarted, color: 'text-blue-400' },
                  { label: 'Éxito', value: analyticsStats.scanSuccess, color: 'text-green-400' },
                  { label: 'Fallidos', value: analyticsStats.scanFailed, color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={'text-xl font-bold ' + item.color}>{item.value}</p>
                    <p className="text-[10px] text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Tasa de éxito</span>
                <span className="text-green-400 font-bold">
                  {analyticsStats.scanStarted > 0
                    ? Math.round((analyticsStats.scanSuccess / analyticsStats.scanStarted) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            {/* Monetización */}
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Monetización — últimos 30 días</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Iniciados', value: analyticsStats.goPurchaseStarted, color: 'text-blue-400' },
                  { label: 'Completados', value: analyticsStats.goPurchaseCompleted, color: 'text-green-400' },
                  { label: 'Cancelados', value: analyticsStats.goPurchaseCancelled, color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
                    <p className={'text-xl font-bold ' + item.color}>{item.value}</p>
                    <p className="text-[10px] text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Conversión GO</span>
                <span className="text-yellow-400 font-bold">{analyticsStats.conversionRate}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Anuncios vistos</span>
                <span className="text-purple-400 font-bold">{analyticsStats.adWatched}</span>
              </div>
            </div>

            {/* Engagement */}
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Engagement — últimos 30 días</p>
              {[
                { label: 'Page views', value: analyticsStats.pageViews, color: 'text-blue-400' },
                { label: 'Cartas añadidas', value: analyticsStats.cardAdded, color: 'text-purple-400' },
                { label: 'Referidos copiados', value: analyticsStats.referralCopied, color: 'text-green-400' },
                { label: 'Total eventos', value: analyticsStats.totalEvents, color: 'text-gray-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className={'text-sm font-bold ' + item.color}>{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Por plataforma */}
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por plataforma</p>
              {analyticsStats.byPlatform.map(item => (
                <div key={item.platform} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 capitalize">{item.platform}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-white/10 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round((item.count / analyticsStats.totalEvents) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-white font-bold w-8 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB USUARIOS */}
        {activeTab === 'users' && (
          <>
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

            <FunkoImporter adminId={telegramUser?.id ?? 0} />

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

                      <div className="flex gap-2 flex-wrap">
                        {giftingId === user.telegram_user_id ? (
                          <>
                            {[
                              { label: '1d', months: 0, days: 1 },
                              { label: '3d', months: 0, days: 3 },
                              { label: '7d', months: 0, days: 7 },
                              { label: '1m', months: 1, days: 0 },
                              { label: '3m', months: 3, days: 0 },
                              { label: '6m', months: 6, days: 0 },
                              { label: '12m', months: 12, days: 0 },
                            ].map(opt => (
                              <button key={opt.label} onClick={() => giveGO(user.telegram_user_id, opt.months, opt.days)}
                                className="flex-1 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold active:scale-95">
                                {opt.label}
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
                              <Gift size={12} className="inline mr-1" />Dar GO
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
          </>
        )}
      </div>
    </div>
  );
}
function FunkoImporter({ adminId }: { adminId: number }) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [activeSource, setActiveSource] = useState<'all' | 'kennymkchan' | 'funkopop_list'>('all');

  // Importar al catálogo universal (catalog_items)
  const runCatalogImport = async () => {
    setImporting(true);
    setDone(false);
    setProgress('Iniciando importación al catálogo universal...');
    let offset = 0;
    let total = 0;

    while (true) {
      const res = await fetch('/api/catalog-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, source: activeSource, offset, batchSize: 500 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setProgress('❌ Error: ' + (data.error ?? 'desconocido'));
        setImporting(false);
        return;
      }

      // Sumar resultados de todas las fuentes
      let batchTotal = 0;
      let allDone = true;
      for (const [key, result] of Object.entries(data.results ?? {})) {
        const r = result as any;
        if (r.imported) batchTotal += r.imported;
        if (!r.done) allDone = false;
      }
      total += batchTotal;
      setProgress(`✅ Importados ${total} items al catálogo universal...`);
      if (allDone || batchTotal === 0) break;
      offset += 500;
      await new Promise(r => setTimeout(r, 300));
    }

    setProgress(`✅ Importación completa — ${total} items en catalog_items`);
    setImporting(false);
    setDone(true);
  };

  // Sincronización de precios y nuevos items via cron manual
  const runSync = async (mode: 'prices' | 'import' | 'full') => {
    setImporting(true);
    setProgress(`Ejecutando sync (modo: ${mode})...`);
    try {
      const res = await fetch(`/api/catalog-sync?mode=${mode}&secret=collectiq_secret_2026`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setProgress('❌ Error: ' + (data.error ?? 'desconocido'));
      } else {
        const r = data.results ?? {};
        setProgress(`✅ Sync completado — ${JSON.stringify(r)}`);
      }
    } catch (err: any) {
      setProgress('❌ ' + (err?.message ?? 'Error desconocido'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">🗂 Catálogo Universal</p>

      {progress && (
        <p className="text-xs text-blue-300 break-all">{progress}</p>
      )}

      {/* Selector de fuente */}
      <div>
        <p className="text-[10px] text-gray-500 mb-1.5">Fuente de datos Funko</p>
        <div className="flex gap-2">
          {(['all', 'kennymkchan', 'funkopop_list'] as const).map(src => (
            <button key={src} onClick={() => setActiveSource(src)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                activeSource === src
                  ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                  : 'bg-white/5 border-white/8 text-gray-500'
              }`}>
              {src === 'all' ? 'Todas' : src}
            </button>
          ))}
        </div>
      </div>

      {/* Importar catálogo */}
      <button onClick={runCatalogImport} disabled={importing}
        className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50">
        {importing ? 'Importando...' : '📥 Importar Funkos → catalog_items'}
      </button>

      {/* Sync de precios */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => runSync('prices')} disabled={importing}
          className="py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-[10px] font-bold active:scale-95 disabled:opacity-50">
          💰 Precios
        </button>
        <button onClick={() => runSync('import')} disabled={importing}
          className="py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold active:scale-95 disabled:opacity-50">
          📦 Importar
        </button>
        <button onClick={() => runSync('full')} disabled={importing}
          className="py-2 rounded-xl bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold active:scale-95 disabled:opacity-50">
          🔄 Full sync
        </button>
      </div>
    </div>
  );
}