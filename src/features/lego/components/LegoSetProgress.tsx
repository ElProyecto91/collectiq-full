import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserStore } from '@/store';
import { inventorySig } from '../inventory-sig';
import { fetchCanonMap, fetchWeights } from '../services/lego-catalog';
import { computeProgress } from '../services/lego-progress';
import { listUserParts } from '../services/lego-user';
import type { LegoSetPart } from '../types';
import { LegoImage } from './LegoImage';
import { LegoPctBar } from './LegoPctBar';

type Filter = 'all' | 'have' | 'missing';

/** What you have and what you lack of one set, from your inventory, with images. */
export function LegoSetProgress({ parts }: { parts: LegoSetPart[] }) {
  const { t, tr } = useI18n();
  const tid = useUserStore((s) => s.telegramUser?.id);
  const [filter, setFilter] = useState<Filter>('missing');

  const invQuery = useQuery({ queryKey: ['user-lego-parts', tid], queryFn: () => listUserParts(tid!), enabled: tid != null });
  const inventory = invQuery.data ?? [];
  const sig = useMemo(() => inventorySig(inventory), [inventory]);

  const partNums = useMemo(() => [...new Set([...parts.map((p) => p.part_num), ...inventory.map((i) => i.part_num)])].sort(), [parts, inventory]);
  const canonQuery = useQuery({
    queryKey: ['lego-canon', partNums.join(',')], queryFn: () => fetchCanonMap(partNums), enabled: parts.length > 0 && invQuery.isSuccess,
    staleTime: Infinity,
  });
  const canon = canonQuery.data;
  const groupKeys = useMemo(() => {
    if (!canon) return [];
    return [...new Set(parts.filter((p) => !p.is_spare).map((p) => `${canon.get(p.part_num) ?? p.part_num}|${p.color_id}`))].sort();
  }, [parts, canon]);
  const weightsQuery = useQuery({
    queryKey: ['lego-weights', groupKeys.join(',')],
    queryFn: () => fetchWeights(groupKeys.map((k) => ({ part_num: k.split('|')[0], color_id: Number(k.split('|')[1]) }))),
    enabled: groupKeys.length > 0, staleTime: Infinity,
  });

  const progress = useMemo(() => (canon && weightsQuery.data ? computeProgress(parts, inventory, canon, weightsQuery.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, sig, canon, weightsQuery.data]);

  const rows = useMemo(() => {
    if (!progress) return [];
    const list = progress.rows.filter((r) => filter === 'all' || (filter === 'missing' ? r.missing > 0 : r.missing === 0));
    return [...list].sort((a, b) => b.missing - a.missing || a.part.color_name.localeCompare(b.part.color_name) || a.part.part_num.localeCompare(b.part.part_num));
  }, [progress, filter]);
  const [limit, setLimit] = useState(60);

  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs border ${active ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5'}`;

  if (tid == null) return <p className="text-sm text-white/60">{t.lego.needLogin}</p>;
  if (invQuery.isLoading || canonQuery.isLoading || weightsQuery.isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>;
  const err = (invQuery.error ?? canonQuery.error ?? weightsQuery.error) as Error | null;
  if (err) {
    const needsImport = /no such table/i.test(err.message);
    return <div className="space-y-1"><p className="text-sm text-white/60">{needsImport ? t.lego.rankingNeedsImport : t.lego.loadError}</p><p className="text-[11px] text-white/30 break-words">{err.message}</p></div>;
  }
  if (inventory.length === 0) return <p className="text-sm text-white/60">{t.lego.progressNeedsInventory}</p>;
  if (!progress) return null;

  return (
    <div className="space-y-3">
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-3 space-y-2">
        <p className="text-xs text-white/70">{tr('lego.progressSummary', { covered: progress.covered, total: progress.total })}</p>
        <LegoPctBar value={progress.pct} label={t.lego.metricSimple} />
        {progress.wpct !== null ? <LegoPctBar value={progress.wpct} label={t.lego.metricWeighted} />
          : <p className="text-[10px] text-white/35">{t.lego.metricWeighted}: {t.lego.progressWeightedUnavailable}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {([['missing', t.lego.progressMissing], ['have', t.lego.progressHave], ['all', t.lego.progressAll]] as const).map(([f, label]) => (
          <button key={f} aria-pressed={filter === f} className={chip(filter === f)} onClick={() => { setFilter(f); setLimit(60); }}>{label}</button>))}
      </div>

      <ul className="space-y-2">
        {rows.slice(0, limit).map((r) => (
          <li key={r.key} className="flex items-center gap-3 bg-white/[0.04] border border-white/8 rounded-xl p-2">
            <LegoImage src={r.part.img_url} alt={r.part.part_name} className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-red-300 font-semibold">{r.part.part_num}</p>
              <p className="text-xs leading-tight line-clamp-2">{r.part.part_name}</p>
              <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                <span className="w-3 h-3 rounded-full border border-white/20 inline-block" style={{ background: r.part.color_rgb ? `#${r.part.color_rgb}` : 'transparent', opacity: r.part.color_is_trans ? 0.6 : 1 }} />
                {r.part.color_name}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-white/70">{r.covered}/{r.need}</p>
              <p className={`text-[11px] font-bold ${r.missing > 0 ? 'text-red-300' : 'text-green-300'}`}>{r.missing > 0 ? tr('lego.missing', { count: r.missing }) : t.lego.complete}</p>
            </div>
          </li>))}
      </ul>
      {rows.length > limit && <button onClick={() => setLimit((l) => l + 60)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.showMore}</button>}
    </div>
  );
}
