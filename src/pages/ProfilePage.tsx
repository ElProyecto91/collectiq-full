import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, LogOut, Globe, Coins, BarChart2, Trophy, Zap, Users, Bell, Flame, Gift, Copy, Check } from 'lucide-react';
import { useUserStore } from '@/store';
import { useI18n } from '@/i18n';
import { useCurrency } from '@/hooks/use-currency';
import { useCollectionList } from '@/hooks/use-collection';
import { useXP, getLevelName } from '@/hooks/use-xp';
import { useStreak } from '@/hooks/use-streak';
import { useMissions, DAILY_MISSIONS } from '@/hooks/use-missions';
import { usePremium } from '@/hooks/use-premium';
import { AchievementToast } from '@/components/AchievementToast';
import { GOBadge, GOName } from '@/components/GOBadge';
import { supabase } from '@/lib/supabase';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'BRL', 'MXN', 'PLN'];
const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

export function ProfilePage() {
  const telegramUser = useUserStore((s) => s.telegramUser);
  const setTelegramUser = useUserStore((s) => s.setTelegramUser);
  const { t } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const { data: cards = [] } = useCollectionList();
  const navigate = useNavigate();
  const { xpData, unlockedAchievements, newAchievement } = useXP();
  const { streak } = useStreak();
  const { missions, completedCount } = useMissions();
  const { premium } = usePremium();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);
  const displayName = telegramUser?.first_name ?? telegramUser?.username ?? 'Coleccionista';
  const username = telegramUser?.username ? '@' + telegramUser.username : null;
  const levelName = getLevelName(xpData.level);
  const savedLang = localStorage.getItem('i18n-locale') ?? 'es';

  const referralLink = telegramUser?.id
    ? `https://t.me/CollectIQ_bot/app?startapp=ref_${telegramUser.id}`
    : '';

  useEffect(() => {
    if (!telegramUser?.id) return;
    loadSocialStats();
  }, [telegramUser?.id]);

  const loadSocialStats = async () => {
    if (!telegramUser?.id) return;
    const [{ count: notifs }, { count: following }, { count: followers }, { count: referrals }] = await Promise.all([
      supabase.from('user_notifications').select('*', { count: 'exact', head: true })
        .eq('telegram_user_id', telegramUser.id).eq('read', false),
      supabase.from('user_follows').select('*', { count: 'exact', head: true })
        .eq('follower_id', telegramUser.id),
      supabase.from('user_follows').select('*', { count: 'exact', head: true })
        .eq('following_id', telegramUser.id),
      supabase.from('referrals').select('*', { count: 'exact', head: true })
        .eq('referrer_id', telegramUser.id).eq('completed', true),
    ]);
    setUnreadNotifs(notifs ?? 0);
    setFollowingCount(following ?? 0);
    setFollowersCount(followers ?? 0);
    setReferralCount(referrals ?? 0);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!telegramUser?.id) return;
    const url = 'https://collectiq-full.vercel.app/u/' + telegramUser.id;
    if (navigator.share) {
      navigator.share({ title: 'Mi coleccion en CollectIQ', url });
    } else {
      navigator.clipboard.writeText(url);
      alert('Enlace copiado: ' + url);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('collectiq-session-token');
    setTelegramUser(null);
    window.location.href = '/login';
  };

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      <AchievementToast achievement={newAchievement} onDone={() => {}} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t.profile.title}</h1>
        <button onClick={() => navigate('/notifications')} className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Bell size={16} className="text-gray-400" />
          {unreadNotifs > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
              {unreadNotifs}
            </span>
          )}
        </button>
      </div>

      {/* Avatar */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-4">
        <div className="relative">
          <div className={'w-14 h-14 rounded-full flex items-center justify-center shrink-0 ' + (premium.isGO ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : 'bg-blue-600/20 border border-blue-500/30')}>
            <span className={'text-xl font-bold ' + (premium.isGO ? 'text-yellow-400' : 'text-blue-400')}>{displayName[0].toUpperCase()}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full px-1.5 py-0.5">
            <span className="text-[9px] font-black text-black">{xpData.level}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {premium.isGO ? (
              <p className="font-bold truncate"><GOName name={displayName} /></p>
            ) : (
              <p className="text-white font-bold truncate">{displayName}</p>
            )}
            {premium.isGO && <GOBadge />}
          </div>
          {username && <p className="text-xs text-gray-500 mt-0.5">{username}</p>}
          <p className="text-xs text-yellow-400 mt-0.5 font-medium">{levelName} · {xpData.xp} XP</p>
        </div>
        <button onClick={handleShare}
          className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <Share2 size={18} className="text-blue-400" />
        </button>
      </div>

      {/* Social */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => navigate('/friends')}
          className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center active:scale-95 transition-transform">
          <p className="text-xl font-bold text-blue-400">{followingCount}</p>
          <p className="text-[10px] text-gray-500">Siguiendo</p>
        </button>
        <button onClick={() => navigate('/friends')}
          className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center active:scale-95 transition-transform">
          <p className="text-xl font-bold text-purple-400">{followersCount}</p>
          <p className="text-[10px] text-gray-500">Seguidores</p>
        </button>
      </div>

      {/* Racha + Misiones */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => navigate('/missions')}
          className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-2 active:scale-95 transition-transform">
          <span className="text-2xl">🔥</span>
          <div className="text-left">
            <p className="text-lg font-bold text-orange-400">{streak.currentStreak}d</p>
            <p className="text-[10px] text-gray-500">Racha</p>
          </div>
        </button>
        <button onClick={() => navigate('/missions')}
          className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-2 active:scale-95 transition-transform">
          <span className="text-2xl">🎯</span>
          <div className="text-left">
            <p className="text-lg font-bold text-blue-400">{completedCount}/{DAILY_MISSIONS.length}</p>
            <p className="text-[10px] text-gray-500">Misiones</p>
          </div>
        </button>
      </div>

      {/* XP */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 space-y-2 cursor-pointer active:scale-95 transition-transform"
        onClick={() => navigate('/achievements')}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Nivel {xpData.level} → {xpData.level + 1}</p>
          <p className="text-xs text-yellow-400 font-bold">{xpData.progress}%</p>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
            style={{ width: xpData.progress + '%' }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-600">{xpData.xp} / {xpData.nextLevelXP} XP</p>
          <p className="text-[10px] text-yellow-500">{unlockedAchievements.length} logros →</p>
        </div>
      </div>

      {/* Stats coleccion */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t.stats.cards, value: totalCards, color: 'text-blue-400' },
          { label: t.stats.unique, value: uniqueCards, color: 'text-purple-400' },
          { label: t.stats.estValue ?? 'Valor', value: totalValue > 0 ? totalValue.toFixed(0) + currency : '—', color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className={'text-lg font-bold ' + color}>{value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Sistema de referidos */}
      <div className="bg-gradient-to-br from-green-600/10 to-blue-600/10 border border-green-500/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-green-400" />
          <p className="text-sm font-bold text-white">Invita amigos</p>
          {referralCount > 0 && (
            <span className="ml-auto text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">
              {referralCount} completados
            </span>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-400">Tu amigo añade 10 cartas y ambos ganáis:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <p className="text-lg">🎁</p>
              <p className="text-xs font-bold text-green-400">Tú: +10 escaneos</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <p className="text-lg">⭐</p>
              <p className="text-xs font-bold text-yellow-400">Él: 12h GO gratis</p>
            </div>
          </div>
        </div>
        <button onClick={handleCopyReferral}
          className={'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 ' + (
            copied ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-white/5 border border-white/10 text-gray-300'
          )}>
          {copied ? <><Check size={14} />¡Enlace copiado!</> : <><Copy size={14} />Copiar enlace de invitación</>}
        </button>
      </div>

      {/* Herramientas */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Herramientas</p>
        {[
          { icon: <Trophy size={16} className="text-yellow-400" />, bg: 'bg-yellow-500/20', label: 'Logros', desc: unlockedAchievements.length + ' de 11 desbloqueados', route: '/achievements' },
          { icon: <Flame size={16} className="text-orange-400" />, bg: 'bg-orange-500/20', label: 'Misiones diarias', desc: completedCount + '/' + DAILY_MISSIONS.length + ' completadas hoy', route: '/missions' },
          { icon: <Users size={16} className="text-blue-400" />, bg: 'bg-blue-500/20', label: 'Amigos', desc: followingCount + ' siguiendo · ' + followersCount + ' seguidores', route: '/friends' },
          { icon: <BarChart2 size={16} className="text-purple-400" />, bg: 'bg-purple-500/20', label: 'Estadisticas', desc: 'Valor, ROI y evolucion', route: '/stats' },
          { icon: <Zap size={16} className="text-yellow-400" />, bg: 'bg-yellow-500/20', label: 'CollectIQ GO', desc: premium.isGO ? '✓ Plan activo' : 'Desbloquea todo el potencial', route: '/premium' },
        ].map(item => (
          <button key={item.route} onClick={() => navigate(item.route)}
            className="w-full flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 active:scale-95 transition-transform">
            <div className={'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ' + item.bg}>
              {item.icon}
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500 truncate">{item.desc}</p>
            </div>
            <span className="text-gray-500 text-xs shrink-0">›</span>
          </button>
        ))}
      </div>

      {/* Compartir */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Compartir</p>
        <button onClick={handleShare}
          className="w-full flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 active:scale-95 transition-transform">
          <Share2 size={18} className="text-blue-400 shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-white">Compartir mi coleccion</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">collectiq-full.vercel.app/u/{telegramUser?.id ?? '...'}</p>
          </div>
        </button>
      </div>

      {/* Preferencias */}
      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Preferencias</p>
        <div>
          <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
            <Globe size={12} /> Idioma
          </p>
          <div className="flex gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.code}
                onClick={() => { localStorage.setItem('i18n-locale', lang.code); window.location.reload(); }}
                className={'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm border transition-all ' + (
                  savedLang === lang.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'
                )}>
                <span>{lang.flag}</span><span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
            <Coins size={12} /> Moneda
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CURRENCIES.map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={'shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ' + (
                  currency === c ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'
                )}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl py-3.5 font-medium active:scale-95 transition-transform">
        <LogOut size={18} />{t.profile.signOut}
      </button>

      <p className="text-center text-xs text-gray-600">{t.profile.version}</p>
    </div>
  );
}