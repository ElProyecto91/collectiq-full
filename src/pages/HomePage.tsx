import { useNavigate } from 'react-router-dom';
import { Compass, Heart, LayoutGrid, ScanLine, Sparkles, TrendingUp, User } from 'lucide-react';

import { Avatar, Button, Card, StatTile } from '@/components/ui';
import { useDisplayName, useTelegram } from '@/hooks';
import { useCollectionStats } from '@/hooks';
import { useUserStore } from '@/store';
import { RoutePaths } from '@/config';
import { formatNumber } from '@/utils';
import { useI18n } from '@/i18n';
import type { ReactNode } from 'react';

/**
 * Home — the collector's landing surface.
 *
 * Greeting (Telegram-aware), the primary scan CTA, quick navigation tiles, a
 * collection statistics snapshot, and a daily tip placeholder. Statistics come
 * from the collection stats query; while it loads, skeletons fill the tiles.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { isTelegram } = useTelegram();
  const name = useDisplayName();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: stats, isLoading } = useCollectionStats();
  const { t } = useI18n();

  const greeting = greetingFor(t);

  return (
    <div className="space-y-6 bg-gradient-hero -mx-4 px-4 pb-4 pt-3">
      {/* Greeting + avatar */}
      <header className="flex items-center justify-between animate-fade-in">
        <div>
          <p className="text-sm text-ink-soft">{greeting},</p>
          <h1 className="font-display text-2xl font-bold text-ink">{name}</h1>
        </div>
        <Avatar
          src={telegramUser?.photo_url}
          name={name}
          size={48}
          className="cursor-pointer"
        />
      </header>

      {/* Hero CTA — scan a card */}
      <Card variant="glass" padding="lg" interactive className="animate-fade-up">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft">
            <ScanLine size={28} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-ink">{t.home.scanCard}</h2>
            <p className="text-sm text-ink-soft">{t.home.scanCardDesc}</p>
          </div>
        </div>
        <Button
          size="lg"
          fullWidth
          leftIcon={<ScanLine size={20} />}
          className="mt-4"
          onClick={() => navigate(RoutePaths.Scanner)}
        >
          {t.home.openScanner}
        </Button>
      </Card>

      {/* Quick navigation tiles */}
      <section className="grid grid-cols-2 gap-3 animate-fade-up">
        <QuickTile icon={<LayoutGrid size={20} />} label={t.nav.collection} onClick={() => navigate(RoutePaths.Collection)} />
        <QuickTile icon={<Compass size={20} />} label={t.nav.explorer} onClick={() => navigate(RoutePaths.Explorer)} />
        <QuickTile icon={<Heart size={20} />} label={t.nav.wishlist} onClick={() => navigate(RoutePaths.Wishlist)} />
        <QuickTile icon={<User size={20} />} label={t.nav.profile} onClick={() => navigate(RoutePaths.Profile)} />
      </section>

      {/* Collection statistics */}
      <section className="animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary-soft" />
          <h2 className="font-display text-base font-semibold text-ink">{t.home.yourCollection}</h2>
        </div>
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
              <StatTile label={t.stats.tcgs} value={Object.keys(stats.byTcg).length} />
            </>
          )}
        </div>
      </section>

      {/* Daily tip placeholder */}
      <Card variant="flat" padding="md" className="animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">{t.home.dailyTip}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {t.home.dailyTipDesc}
            </p>
          </div>
        </div>
      </Card>

      {isTelegram === false && <WebFallbackNote />}
    </div>
  );
}

function QuickTile({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Card interactive padding="md" className="flex items-center gap-3" onClick={onClick} role="button">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-primary-soft">
        {icon}
      </div>
      <span className="text-sm font-medium text-ink">{label}</span>
    </Card>
  );
}

function WebFallbackNote() {
  const { t } = useI18n();
  return (
    <p className="pt-2 text-center text-xs text-ink-faint">
      {t.home.webFallback}
    </p>
  );
}

function greetingFor(t: ReturnType<typeof useI18n>['t']): string {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greeting.morning;
  if (hour < 18) return t.home.greeting.afternoon;
  return t.home.greeting.evening;
}
