import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatEuro, type ValueTotals } from '../value';

interface Props {
  title: string;
  tot: ValueTotals;
  progress: { done: number; total: number } | null;
  error: string | null;
  onRetry?: () => void;
  /** Hide the explanatory footnote (e.g. when two cards are stacked). */
  compact?: boolean;
  hasStockBasis?: boolean;
}

/** Total value in euros (used and new) of a collection, with how much of it is priced and what is still loading. */
export function LegoValueCard({ title, tot, progress, error, onRetry, compact, hasStockBasis }: Props) {
  const { t, tr, locale } = useI18n();
  const errKey = error ? (`valueErr_${['not_configured', 'bricklink_auth', 'rate_limited', 'network', 'unauthorized'].includes(error) ? error : 'unknown'}` as keyof typeof t.lego) : null;
  return (
    <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="text-3xl font-black tabular-nums">≈ {formatEuro(tot.total, locale)}</p>
      {tot.count > 0 && <p className="text-[11px] text-white/45">{tr('lego.valueCoverage', { priced: tot.priced, count: tot.count })}</p>}
      {progress && (
        <div className="space-y-1" role="status">
          <p className="text-[11px] text-white/60 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />{tr('lego.valuePricing', { done: progress.done, total: progress.total })}</p>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} /></div>
        </div>)}
      {errKey && (
        <p className="text-[11px] text-yellow-200/90" role="alert">
          {t.lego[errKey]}{' '}
          {onRetry && error !== 'not_configured' && <button onClick={onRetry} className="underline font-semibold">{t.lego.valueRetry}</button>}
        </p>)}
      {!compact && <p className="text-[10px] text-white/30">{t.lego.valueNote}{hasStockBasis ? ` ${t.lego.valueStockNote}` : ''}</p>}
    </section>
  );
}
