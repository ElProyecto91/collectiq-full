import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import {
  Users, Zap, BarChart2, Gift, Search, ArrowLeft,
  TrendingUp, ShoppingBag, AlertTriangle, Package,
  Star, RefreshCw,
} from 'lucide-react';

const ADMIN_ID = 1299079722;
const API = 'https://collectiq-api.esxdinero.workers.dev';

interface UserStats {
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  totalCards: number;
  totalFunkos: number;
  totalDecks: number;
  totalScans: number;
  marketplaceListings: number;
  isPremium: boolean;
  premiumExpires: string | null;
  lastSeen: string | null;
}

interface GlobalStats {
  totalUsers: number;
  totalCards: number;
  totalFunkos: number;
  totalDecks: number;
  totalScans: number;
  premiumUsers: number;
  marketplaceListings: number;
  marketplaceOffers: number;
  bugReports: number;
}

interface AnalyticsStats {
  totalEvents: number;
  pageViews: number;
  scanStarted: number;
  scanSuccess: number;
  scanFailed: number;
  cardAdded: number;
  funkoAdded: number;
  goPurchaseStarted: number;
  goPurchaseCompleted: number;
  goPurchaseCancelled: number;
  adWatched: number;
  referralCopied: number;
  marketplaceViews: number;
  marketplaceCreated: number;
  marketplaceOffers: number;
  byPlatform: { platform: string; count: number }[];
  conversionRate: number;
}

interface BugReport {
  id: string;
  telegram_user_id: number;
  username: string | null;
  message: string;
  page: string | null;
  status: string;
  created_at: string;
}

type Tab = 'users' | 'analytics' | 'marketplace' | 'bugs';

export function AdminPage() {
  const navigate = useNavigate();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [marketplaceStats, setMarketplaceStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [giftingId, setGiftingId] = useState<number | null>(null);
  const [giftInput, setGiftInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!telegramUser?.id) return;
    if (telegramUser.id !== ADMIN_ID) { navigate('/'); return; }
    fetch(`${API}/admin-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) navigate('/');
        else { loadData(); loadAnalytics(); loadMarketplaceStats(); loadBugReports(); }
      })
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
      funkoAdded: count('funko_added'),
      goPurchaseStarted: started,
      goPurchaseCompleted: completed,
      goPurchaseCancelled: count('go_purchase_cancelled'),
      adWatched: count('ad_watched'),
      referralCopied: count('referral_link_copied'),
      marketplaceViews: count('marketplace_view'),
      marketplaceCreated: count('marketplace_created'),
      marketplaceOffers: count('marketplace_offer'),
      byPlatform: Object.entries(platformMap).map(([platform, count]) => ({ platform, count })),
      conversionRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    });
  };

  const loadMarketplaceStats = async () => {
    try {
      const [listingsRes, offersRes] = await Promise.all([
        supabase.from('marketplace_listings').select('status, tcg, listing_type, price, created_at').neq('status', 'deleted'),
        supabase.from('marketplace_offers').select('status, created_at').limit(500),
      ]);
      const listings = listingsRes.data || [];
      const offers = offersRes.data || [];

      const byTcg: Record<string, number> = {};
      listings.forEach(l => { byTcg[l.tcg] = (byTcg[l.tcg] || 0) + 1; });

      const byType: Record<string, number> = {};
      listings.forEach(l => { byType[l.listing_type] = (byType[l.listing_type] || 0) + 1; });

      const activePrices = listings.filter(l => l.status === 'active' && l.price != null).map(l => l.price);
      const avgPrice = activePrices.length > 0
        ? activePrices.reduce((s, p) => s + p, 0) / activePrices.length
        : 0;

      setMarketplaceStats({
        total: listings.length,
        active: listings.filter(l => l.status === 'active').length,
        sold: listings.filter(l => l.status === 'sold').length,
        reserved: listings.filter(l => l.status === 'reserved').length,
        expired: listings.filter(l => l.status === 'expired').length,
        offers: offers.length,
        pendingOffers: offers.filter(o => o.status === 'pending').length,
        byTcg,
        byType,
        avgPrice: avgPrice.toFixed(2),
      });
    } catch {}
  };

  const loadBugReports = async () => {
    try {
      const { data } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setBugReports(data || []);
    } catch {}
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
          { count: totalFunkos },
          { count: totalDecks },
          { count: totalScans },
          { count: marketplaceListings },
          { data: premiumData },
        ] = await Promise.all([
          supabase.from('collection_items').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id),
          supabase.from('funko_collection').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id),
          supabase.from('decks').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id),
          supabase.from('activity_feed').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id).eq('type', 'scan'),
          supabase.from('marketplace_listings').select('*', { count: 'exact', head: true }).eq('telegram_user_id', session.telegram_user_id).neq('status', 'deleted'),
          supabase.from('user_premium').select('plan, expires_at').eq('telegram_user_id', session.telegram_user_id).maybeSingle(),
        ]);

        const isExpired = premiumData?.expires_at ? new Date(premiumData.expires_at) < new Date() : true;

        return {
          telegram_user_id: session.telegram_user_id,
          username: ud.username ?? null,
          first_name: ud.first_name ?? null,
          totalCards: totalCards ?? 0,
          totalFunkos: totalFunkos ?? 0,
          totalDecks: totalDecks ?? 0,
          totalScans: totalScans ?? 0,
          marketplaceListings: marketplaceListings ?? 0,
          isPremium: premiumData?.plan === 'go' && !isExpired,
          premiumExpires: premiumData?.expires_at ?? null,
          lastSeen: session.created_at,
        };
      }));

      setUsers(userStats);
      setGlobalStats({
        totalUsers: sessions.length,
        totalCards: userStats.reduce((s, u) => s + u.totalCards, 0),
        totalFunkos: userStats.reduce((s, u) => s + u.totalFunkos, 0),
        totalDecks: userStats.reduce((s, u) => s + u.totalDecks, 0),
        totalScans: userStats.reduce((s, u) => s + u.totalScans, 0),
        premiumUsers: userStats.filter(u => u.isPremium).length,
        marketplaceListings: userStats.reduce((s, u) => s + u.marketplaceListings, 0),
        marketplaceOffers: marketplaceStats?.offers ?? 0,
        bugReports: bugReports.length,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const giveGO = async (userId: number, months: number = 1, days: number = 0) => {
    if (!telegramUser?.id) return;
    const res = await fetch(`${API}/admin-give-go`, {
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

  const updateBugStatus = async (id: string, status: string) => {
    await supabase.from('bug_reports').update({ status }).eq('id', id);
    setBugReports(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const runCronPrices = async () => {
    setStatusMsg('🔄 Ejecutando cron de precios...');
    try {
      const res = await fetch(`${API}/cron-prices?secret=${import.meta.env.VITE_CRON_SECRET || 'collectiq2024'}`);
      const data = await res.json();
      setStatusMsg('✅ Cron completado — ' + JSON.stringify(data.results));
    } catch {
      setStatusMsg('❌ Error en cron');
    }
    setTimeout(() => setStatusMsg(''), 6000);
  };

  if (!telegramUser || telegramUser.id !== ADMIN_ID) return null;

  const filtered = users.filter(u =>
    (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.first_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    u.telegram_user_id.toString().includes(search)
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'users', label: 'Usuarios', icon: <Users size={13} />, color: 'bg-blue-600' },
    { key: 'analytics', label: 'Analytics', icon: <TrendingUp size={13} />, color: 'bg-purple-600' },
    { key: 'marketplace', label: 'Market', icon: <ShoppingBag size={13} />, color: 'bg-green-600' },
    { key: 'bugs', label: 'Bugs', icon: <AlertTriangle size={13} />, color: 'bg-red-600' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-[0.2em]">ADMIN</p>
          <h1 className="text-lg font-bold">Panel de Control</h1>
        </div>
        <button onClick={runCronPrices} className="ml-auto bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 flex items-center gap-1.5 active:scale-95">
          <RefreshCw size={12} /> Cron
        </button>
      </div>

      <div className="px-4 space-y-4">
        {statusMsg && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-xs text-blue-300 text-center break-all">
            {statusMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === t.key ? t.color + ' text-white' : 'bg-white/5 text-gray-400'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Stats globales */}
        {globalStats && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Usuarios', value: globalStats.totalUsers, color: 'text-blue-400' },
              { label: 'GO activos', value: globalStats.premiumUsers, color: 'text-yellow-400' },
              { label: 'Cartas TCG', value: globalStats.totalCards, color: 'text-purple-400' },
              { label: 'Funkos', value: globalStats.totalFunkos, color: 'text-red-400' },
              { label: 'Mazos', value: globalStats.totalDecks, color: 'text-indigo-400' },
              { label: 'Escaneos', value: globalStats.totalScans, color: 'text-green-400' },
              { label: 'Anuncios', value: globalStats.marketplaceListings, color: 'text-emerald-400' },
              { label: 'Bug reports', value: globalStats.bugReports, color: 'text-orange-400' },
            ].map(item => (
              <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                <p className={`text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB USUARIOS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Dar GO */}
            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <Gift size={14} className="text-yellow-400" /> Dar GO por Telegram ID
              </p>
              <div className="flex gap-2">
                <input value={giftInput} onChange={e => setGiftInput(e.target.value)}
                  placeholder="Telegram ID..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none" />
                <button onClick={giveGOByInput}
                  className="px-4 py-2.5 rounded-xl bg-yellow-500 text-black text-sm font-bold active:scale-95">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none" />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Cargando usuarios...</div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">{filtered.length} usuarios</p>
                {filtered.map(user => {
                  const displayName = user.first_name ?? user.username ?? 'Usuario';
                  return (
                    <div key={user.telegram_user_id}
                      className={`bg-[#111118] border rounded-2xl p-4 space-y-3 ${user.isPremium ? 'border-yellow-500/20' : 'border-white/8'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.isPremium ? 'bg-yellow-500/20' : 'bg-blue-600/20'}`}>
                          <span className={`font-bold text-sm ${user.isPremium ? 'text-yellow-400' : 'text-blue-400'}`}>
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
                        {user.lastSeen && (
                          <p className="text-[9px] text-gray-600 shrink-0">
                            {new Date(user.lastSeen).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { label: 'TCG', value: user.totalCards, color: 'text-blue-400' },
                          { label: 'Funko', value: user.totalFunkos, color: 'text-red-400' },
                          { label: 'Mazos', value: user.totalDecks, color: 'text-purple-400' },
                          { label: 'Scans', value: user.totalScans, color: 'text-green-400' },
                          { label: 'Market', value: user.marketplaceListings, color: 'text-emerald-400' },
                        ].map(item => (
                          <div key={item.label} className="bg-white/5 rounded-xl p-2 text-center">
                            <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
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
                              className="px-3 py-2 rounded-xl bg-white/5 text-gray-400 text-xs">✕</button>
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
          </div>
        )}

        {/* TAB ANALYTICS */}
        {activeTab === 'analytics' && analyticsStats && (
          <div className="space-y-4">
            <AnalyticsBlock title="Escaneos — 30 días" items={[
              { label: 'Iniciados', value: analyticsStats.scanStarted, color: 'text-blue-400' },
              { label: 'Éxito', value: analyticsStats.scanSuccess, color: 'text-green-400' },
              { label: 'Fallidos', value: analyticsStats.scanFailed, color: 'text-red-400' },
            ]} footer={`Tasa éxito: ${analyticsStats.scanStarted > 0 ? Math.round((analyticsStats.scanSuccess / analyticsStats.scanStarted) * 100) : 0}%`} />

            <AnalyticsBlock title="Monetización — 30 días" items={[
              { label: 'Iniciados', value: analyticsStats.goPurchaseStarted, color: 'text-blue-400' },
              { label: 'Completados', value: analyticsStats.goPurchaseCompleted, color: 'text-green-400' },
              { label: 'Cancelados', value: analyticsStats.goPurchaseCancelled, color: 'text-red-400' },
            ]} footer={`Conversión: ${analyticsStats.conversionRate}% · Ads: ${analyticsStats.adWatched}`} />

            <AnalyticsBlock title="Marketplace — 30 días" items={[
              { label: 'Vistas', value: analyticsStats.marketplaceViews, color: 'text-blue-400' },
              { label: 'Creados', value: analyticsStats.marketplaceCreated, color: 'text-green-400' },
              { label: 'Ofertas', value: analyticsStats.marketplaceOffers, color: 'text-yellow-400' },
            ]} />

            <AnalyticsBlock title="Colecciones — 30 días" items={[
              { label: 'Cartas añadidas', value: analyticsStats.cardAdded, color: 'text-purple-400' },
              { label: 'Funkos añadidos', value: analyticsStats.funkoAdded, color: 'text-red-400' },
              { label: 'Refs copiados', value: analyticsStats.referralCopied, color: 'text-green-400' },
            ]} />

            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Engagement — 30 días</p>
              {[
                { label: 'Page views', value: analyticsStats.pageViews, color: 'text-blue-400' },
                { label: 'Total eventos', value: analyticsStats.totalEvents, color: 'text-gray-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por plataforma</p>
              {analyticsStats.byPlatform.sort((a, b) => b.count - a.count).map(item => (
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

        {/* TAB MARKETPLACE */}
        {activeTab === 'marketplace' && marketplaceStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Total anuncios', value: marketplaceStats.total, color: 'text-white' },
                { label: 'Activos', value: marketplaceStats.active, color: 'text-green-400' },
                { label: 'Reservados', value: marketplaceStats.reserved, color: 'text-yellow-400' },
                { label: 'Vendidos', value: marketplaceStats.sold, color: 'text-blue-400' },
                { label: 'Expirados', value: marketplaceStats.expired, color: 'text-gray-400' },
                { label: 'Ofertas totales', value: marketplaceStats.offers, color: 'text-purple-400' },
                { label: 'Ofertas pendientes', value: marketplaceStats.pendingOffers, color: 'text-orange-400' },
                { label: 'Precio medio', value: `${marketplaceStats.avgPrice}€`, color: 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="bg-[#111118] border border-white/8 rounded-2xl p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por TCG</p>
              {Object.entries(marketplaceStats.byTcg).sort(([,a], [,b]) => (b as number) - (a as number)).map(([tcg, count]) => (
                <div key={tcg} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 capitalize">{tcg}</span>
                  <span className="text-xs text-white font-bold">{count as number}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Por tipo</p>
              {Object.entries(marketplaceStats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 capitalize">
                    {type === 'sell' ? '💚 Vendo' : type === 'trade' ? '🔄 Cambio' : '🔍 Busco'}
                  </span>
                  <span className="text-xs text-white font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB BUGS */}
        {activeTab === 'bugs' && (
          <div className="space-y-3">
            {bugReports.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No hay reportes de bugs</div>
            ) : bugReports.map(bug => (
              <div key={bug.id} className={`bg-[#111118] border rounded-2xl p-4 space-y-2 ${
                bug.status === 'open' ? 'border-red-500/25' :
                bug.status === 'resolved' ? 'border-green-500/20' : 'border-white/8'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">@{bug.username || bug.telegram_user_id}</p>
                    {bug.page && <p className="text-[10px] text-gray-500">{bug.page}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      bug.status === 'open' ? 'bg-red-500/20 text-red-400' :
                      bug.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{bug.status}</span>
                    <p className="text-[9px] text-gray-600">
                      {new Date(bug.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-300">{bug.message}</p>
                <div className="flex gap-2">
                  {bug.status === 'open' && (
                    <button onClick={() => updateBugStatus(bug.id, 'in_progress')}
                      className="flex-1 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[11px] font-medium">
                      🔧 En progreso
                    </button>
                  )}
                  {bug.status !== 'resolved' && (
                    <button onClick={() => updateBugStatus(bug.id, 'resolved')}
                      className="flex-1 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-medium">
                      ✅ Resuelto
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── ANALYTICS BLOCK ───────────────────────────────────────────
function AnalyticsBlock({ title, items, footer }: {
  title: string;
  items: { label: string; value: number; color: string }[];
  footer?: string;
}) {
  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{title}</p>
      <div className={`grid gap-2 grid-cols-${items.length}`}>
        {items.map(item => (
          <div key={item.label} className="bg-white/5 rounded-xl p-3 text-center">
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>
      {footer && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{footer}</span>
        </div>
      )}
    </div>
  );
}

// ── FUNKO IMPORTER ────────────────────────────────────────────
function FunkoImporter({ adminId }: { adminId: number }) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [activeSource, setActiveSource] = useState<'all' | 'kennymkchan' | 'funkopop_list'>('all');

  const runCatalogImport = async () => {
    setImporting(true);
    setProgress('Iniciando importación...');
    let offset = 0;
    let total = 0;
    while (true) {
      const res = await fetch('/api/catalog-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, source: activeSource, offset, batchSize: 500 }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setProgress('❌ Error: ' + (data.error ?? 'desconocido')); setImporting(false); return; }
      let batchTotal = 0;
      let allDone = true;
      for (const result of Object.values(data.results ?? {})) {
        const r = result as any;
        if (r.imported) batchTotal += r.imported;
        if (!r.done) allDone = false;
      }
      total += batchTotal;
      setProgress(`✅ Importados ${total} items...`);
      if (allDone || batchTotal === 0) break;
      offset += 500;
      await new Promise(r => setTimeout(r, 300));
    }
    setProgress(`✅ Importación completa — ${total} items`);
    setImporting(false);
  };

  const runSync = async (mode: 'prices' | 'import' | 'full') => {
    setImporting(true);
    setProgress(`Sync (modo: ${mode})...`);
    try {
      const res = await fetch(`/api/catalog-sync?mode=${mode}&secret=collectiq_secret_2026`);
      const data = await res.json();
      setProgress(data.error ? '❌ ' + data.error : '✅ ' + JSON.stringify(data.results));
    } catch (err: any) {
      setProgress('❌ ' + (err?.message ?? 'Error'));
    } finally { setImporting(false); }
  };

  return (
    <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">🗂 Catálogo Universal</p>
      {progress && <p className="text-xs text-blue-300 break-all">{progress}</p>}
      <div>
        <p className="text-[10px] text-gray-500 mb-1.5">Fuente Funko</p>
        <div className="flex gap-2">
          {(['all', 'kennymkchan', 'funkopop_list'] as const).map(src => (
            <button key={src} onClick={() => setActiveSource(src)}
              className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                activeSource === src ? 'bg-purple-500/15 border-purple-500/30 text-purple-400' : 'bg-white/5 border-white/8 text-gray-500'
              }`}>
              {src === 'all' ? 'Todas' : src}
            </button>
          ))}
        </div>
      </div>
      <button onClick={runCatalogImport} disabled={importing}
        className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold active:scale-95 disabled:opacity-50">
        {importing ? 'Importando...' : '📥 Importar Funkos → catalog_items'}
      </button>
      <div className="grid grid-cols-3 gap-2">
        {[
          { mode: 'prices' as const, label: '💰 Precios', color: 'text-green-400 bg-green-600/20 border-green-500/30' },
          { mode: 'import' as const, label: '📦 Importar', color: 'text-blue-400 bg-blue-600/20 border-blue-500/30' },
          { mode: 'full' as const, label: '🔄 Full sync', color: 'text-yellow-400 bg-yellow-600/20 border-yellow-500/30' },
        ].map(item => (
          <button key={item.mode} onClick={() => runSync(item.mode)} disabled={importing}
            className={`py-2 rounded-xl border text-[10px] font-bold active:scale-95 disabled:opacity-50 ${item.color}`}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
