import { useState } from 'react';
import { Bell, Check, ChevronRight, Globe, LogOut, Settings, Shield, DollarSign } from 'lucide-react';

import { Avatar, Button, Card, StatTile } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useCollectionStats, useDisplayName, useTelegram } from '@/hooks';
import { useUserStore } from '@/store';
import { formatNumber } from '@/utils';
import { useI18n, type Locale } from '@/i18n';
import type { ReactNode } from 'react';

const CURRENCIES = [
  { value: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  { value: 'USD', label: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { value: 'GBP', label: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { value: 'CHF', label: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { value: 'BRL', label: 'Real Brasileño', symbol: 'R$', flag: '🇧🇷' },
  { value: 'MXN', label: 'Peso Mexicano', symbol: 'MX$', flag: '🇲🇽' },
  { value: 'PLN', label: 'Polish Złoty', symbol: 'zł', flag: '🇵🇱' },
] as const;

export type Currency = (typeof CURRENCIES)[number]['value'];

function useCurrencyStore() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem('collectiq-currency') as Currency) ?? 'EUR';
  });

  const setCurrency = (c: Currency) => {
    localStorage.setItem('collectiq-currency', c);
    setCurrencyState(c);
  };

  return { currency, setCurrency };
}

export function ProfilePage() {
  const { isTelegram } = useTelegram();
  const name = useDisplayName();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: stats, isLoading } = useCollectionStats();
  const { t } = useI18n();

  const handle = telegramUser?.username ? `@${telegramUser.username}` : t.profile.noUsername;

  return (
    <div className="space-y-5 pt-3 animate-fade-in">
      <PageHeader title={t.profile.title} />

      <Card variant="glass" padding="lg" className="flex items-center gap-4">
        <Avatar src={telegramUser?.photo_url} name={name} size={72} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl font-bold text-ink">{name}</h2>
          <p className="truncate text-sm text-ink-soft">{handle}</p>
          {isTelegram && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary-soft">
              {t.profile.telegram}
            </span>
          )}
        </div>
      </Card>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">{t.profile.statistics}</h3>
        <div className="grid grid-cols-3 gap-3">
          {isLoading || !stats ? (
            <>
              <StatTile label={t.stats.cards} value="—" />
              <StatTile label={t.stats.unique} value="—" />
              <StatTile label={t.stats.sets} value="—" />
            </>
          ) : (
            <>
              <StatTile label={t.stats.cards} value={formatNumber(stats.totalItems)} accent="primary" />
              <StatTile label={t.stats.unique} value={formatNumber(stats.uniqueCards)} accent="gold" />
              <StatTile label={t.stats.sets} value={Object.keys(stats.byTcg).length} />
            </>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold text-ink">{t.profile.settings}</h3>
        <Card padding="none" className="divide-y divide-line-soft">
          <SettingsRow icon={<Settings size={18} />} label={t.profile.preferences} />
          <SettingsRow icon={<Bell size={18} />} label={t.profile.notifications} />
          <LanguageRow />
          <CurrencyRow />
          <SettingsRow icon={<Shield size={18} />} label={t.profile.privacy} />
        </Card>
      </section>

      <Button variant="ghost" size="md" fullWidth leftIcon={<LogOut size={18} />} className="text-ink-soft">
        {t.profile.signOut}
      </Button>

      <p className="pb-2 text-center text-xs text-ink-faint">{t.profile.version}</p>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  hint,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-ink-soft">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
      <ChevronRight size={18} className="text-ink-faint" />
    </button>
  );
}

function LanguageRow() {
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  const options: { value: Locale; label: string }[] = [
    { value: 'es', label: t.profile.spanish },
    { value: 'en', label: t.profile.english },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-ink-soft">
          <Globe size={18} />
        </span>
        <span className="flex-1 text-sm font-medium text-ink">{t.profile.language}</span>
        <span className="text-xs text-ink-muted">{locale === 'es' ? t.profile.spanish : t.profile.english}</span>
        <ChevronRight
          size={18}
          className={`text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-1 bg-surface-2 px-4 py-2">
          <p className="mb-2 text-xs text-ink-muted">{t.profile.languageSettingsDesc}</p>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setLocale(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                locale === opt.value
                  ? 'bg-primary/10 text-primary-soft'
                  : 'text-ink-soft hover:bg-surface-3'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{opt.value === 'es' ? '🇪🇸' : '🇬🇧'}</span>
                {opt.label}
              </span>
              {locale === opt.value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrencyRow() {
  const [open, setOpen] = useState(false);
  const { currency, setCurrency } = useCurrencyStore();
  const current = CURRENCIES.find(c => c.value === currency) ?? CURRENCIES[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-ink-soft">
          <DollarSign size={18} />
        </span>
        <span className="flex-1 text-sm font-medium text-ink">Moneda</span>
        <span className="text-xs text-ink-muted">{current.flag} {current.value}</span>
        <ChevronRight
          size={18}
          className={`text-ink-faint transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-1 bg-surface-2 px-4 py-2 max-h-64 overflow-y-auto">
          <p className="mb-2 text-xs text-ink-muted">Elige tu moneda preferida</p>
          {CURRENCIES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setCurrency(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                currency === opt.value
                  ? 'bg-primary/10 text-primary-soft'
                  : 'text-ink-soft hover:bg-surface-3'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{opt.flag}</span>
                <span>{opt.label}</span>
                <span className="text-xs text-ink-muted">{opt.symbol}</span>
              </span>
              {currency === opt.value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}