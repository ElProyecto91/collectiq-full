import { useUserStore } from '@/store';
import { useI18n } from '@/i18n';
import { useCurrency } from '@/hooks/use-currency';
import { useCollectionList } from '@/hooks/use-collection';
import { Share2, LogOut, Globe, Coins } from 'lucide-react';

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

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce((s, c) => s + ((c.marketPrice ?? c.tcgplayerPrice ?? 0) * c.quantity), 0);

  const displayName = telegramUser?.first_name ?? telegramUser?.username ?? 'Coleccionista';
  const username = telegramUser?.username ? '@' + telegramUser.username : null;

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

  const savedLang = localStorage.getItem('i18n-locale') ?? 'es';

  return (
    <div className="space-y-4 pt-3 pb-24 px-4">

      <div>
        <h1 className="text-2xl font-bold text-white">{t.profile.title}</h1>
      </div>

      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-blue-400">
            {displayName[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold truncate">{displayName}</p>
          {username && <p className="text-xs text-gray-500 mt-0.5">{username}</p>}
          <p className="text-xs text-blue-400 mt-0.5">Telegram</p>
        </div>
        <button onClick={handleShare}
          className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <Share2 size={18} className="text-blue-400" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t.stats.cards, value: totalCards, color: 'text-blue-400' },
          { label: t.stats.unique, value: uniqueCards, color: 'text-purple-400' },
          { label: t.stats.estValue, value: totalValue > 0 ? totalValue.toFixed(2) + currency : '—', color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111118] border border-white/8 rounded-2xl p-3 text-center">
            <p className={'text-lg font-bold ' + color}>{value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Compartir</p>
        <button onClick={handleShare}
          className="w-full flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3 active:scale-95 transition-transform">
          <Share2 size={18} className="text-blue-400 shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-white">Compartir mi coleccion</p>
            <p className="text-xs text-gray-500 mt-0.5">{'collectiq-full.vercel.app/u/' + (telegramUser?.id ?? '...')}</p>
          </div>
        </button>
      </div>

      <div className="bg-[#111118] border border-white/8 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Preferencias</p>

        <div>
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
            <Globe size={12} /> Idioma
          </p>
          <div className="flex gap-2">
            {LANGUAGES.map(lang => (
              <button key={lang.code}
                onClick={() => { localStorage.setItem('i18n-locale', lang.code); window.location.reload(); }}
                className={'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm border transition-all ' + (
                  savedLang === lang.code ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/8 text-gray-400'
                )}>
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
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
        <LogOut size={18} />
        {t.profile.signOut}
      </button>

      <p className="text-center text-xs text-gray-600">{t.profile.version}</p>
    </div>
  );
}