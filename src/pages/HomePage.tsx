import { useNavigate } from 'react-router-dom';
import { Compass, Heart, LayoutGrid, ScanLine, TrendingUp, User, DollarSign, Trophy } from 'lucide-react';

import { Avatar, Button, Card, StatTile } from '@/components/ui';
import { useDisplayName, useTelegram, useCollectionStats, useCollectionList } from '@/hooks';
import { useUserStore } from '@/store';
import { RoutePaths } from '@/config';
import { formatNumber } from '@/utils';
import { useI18n } from '@/i18n';
import type { ReactNode } from 'react';

export function HomePage() {
  const navigate = useNavigate();
  const { isTelegram } = useTelegram();
  const name = useDisplayName();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const { data: stats, isLoading } = useCollectionStats();
  const { data: cards = [] } = useCollectionList();
  const { t } = useI18n();

  const greeting = greetingFor(t);

  const totalValue = cards.reduce((sum, card) => {
    const price = card.marketPrice ?? card.tcgplayerPrice ?? 0;
    return sum + price * card.quantity;
  }, 0);

  const mostValuable = cards.reduce((best, card) => {
    const price = card.marketPrice ?? card.tcgplayerPrice ?? 0;
    const bestPrice = best ? (best.marketPrice ?? best.tcgplayerPrice ?? 0) : 0;
    return price > bestPrice ? card : best;
  }, cards[0]);

  const uniqueSets = new Set(cards.map(c => c.setName)).size;

  return (
    <div className="space-y-6 bg-gradient-hero -mx-4 px-4 pb-4 pt-3">

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
          onClick={() => navigate(RoutePaths.Profile)}
        />
      </header>

      {totalValue > 0 && (
        <div
          onClick={() => navigate(RoutePaths.Collection)}
          className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 cursor-pointer animate-fade-up"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20">
            <DollarSign size={24} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Valor total</p>
            <p className="text-2xl font-bold text-white">€{totalValue.toFixed(2)}</p>
          </div>
        </div>
      )}

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

      <section className="grid grid-cols-2 gap-3 animate-fade-up">
        <QuickTile icon={<LayoutGrid size={20} />} label={t.nav.collection} onClick={() => navigate(RoutePaths.Collection)} />
        <QuickTile icon={<Compass size={20} />} label={t.nav.explorer} onClick={() => navigate(RoutePaths.Explorer)} />
        <QuickTile icon={<Heart size={20} />} label={t.nav.wishlist} onClick={() => navigate(RoutePaths.Wishlist)} />
        <QuickTile icon={<User size={20} />} label={t.nav.profile} onClick={() => navigate(RoutePaths.Profile)} />
      </section>

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
              <StatTile label={t.stats.sets} value={uniqueSets} />
            </>
          )}
        </div>
      </section>

      {mostValuable && (mostValuable.marketPrice ?? mostValuable.tcgplayerPrice) && (
        <section className="animate-fade-up">
          <div className="mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            <h2 className="font-display text-base font-semibold text-ink">Carta más valiosa</h2>
          </div>
          <div
            onClick={() => navigate(RoutePaths.Collection)}
            className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
          >
            <img
              src={mostValuable.imageUrl ?? ''}
              alt={mostValuable.cardName}
              className="h-16 w-11 object-cover rounded-lg shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{mostValuable.cardName}</p>
              <p className="text-xs text-gray-500 truncate">{mostValuable.setName}</p>
              <p className="text-sm font-bold text-green-400 mt-1">
                €{(mostValuable.marketPrice ?? mostValuable.tcgplayerPrice ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </section>
      )}

      {isTelegram === false && (
        <p className="pb-2 text-center text-xs text-ink-faint">
          {t.home.webFallback}
        </p>
      )}
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

function greetingFor(t: ReturnType<typeof useI18n>['t']): string {
  const hour = new Date().getHours();
  if (hour < 12) return t.home.greeting.morning;
  if (hour < 18) return t.home.greeting.afternoon;
  return t.home.greeting.evening;
}