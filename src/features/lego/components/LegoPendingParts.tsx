import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserStore } from '@/store';
import { copyLabels } from '../copy-label';
import { fetchCanonMap, fetchSetParts } from '../services/lego-catalog';
import { computePending } from '../services/lego-allocation';
import { listAllocations, listUserSets } from '../services/lego-user';
import type { LegoSet } from '../types';
import { LegoImage } from './LegoImage';
import { LegoPctBar } from './LegoPctBar';

const ROWS = 30;

/**
 * Pieces still missing from each owned set that is not complete. A set counts as complete when its
 * status is sealed or open_complete; only "incomplete" copies are listed here.
 */
export function LegoPendingParts({ catalog }: { catalog: Map<string, LegoSet> }) {
  const { t, tr } = useI18n();
  const navigate = useNavigate();
  const tid = useUserStore((s) => s.telegramUser?.id);

  const setsQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });
  const allocsQuery = useQuery({ queryKey: ['user-lego-allocs', tid], queryFn: () => listAllocations(tid!), enabled: tid != null });
  const labels = useMemo(() => copyLabels(setsQuery.data ?? []), [setsQuery.data]);
  const copies = useMemo(() => (setsQuery.data ?? []).filter((c) => c.status === 'incomplete'), [setsQuery.data]);
  const setNums = useMemo(() => [...new Set(copies.map((c) => c.set_num))].sort(), [copies]);

  // set inventories never change while the app is open: fetch each one once
  const partsQueries = useQueries({
    queries: setNums.map((n) => ({ queryKey: ['lego-set-parts', n], queryFn: () => fetchSetParts(n), staleTime: Infinity })),
  });
  const partsByNum = useMemo(
    () => new Map(setNums.map((n, i) => [n, partsQueries[i]?.data] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setNums, partsQueries.map((q) => q.dataUpdatedAt).join(',')]);
  const allLoaded = setNums.every((n) => partsByNum.get(n));

  const partNums = useMemo(() => {
    const s = new Set<string>();
    for (const parts of partsByNum.values()) parts?.forEach((p) => s.add(p.part_num));
    (allocsQuery.data ?? []).forEach((a) => s.add(a.part_num));
    return [...s].sort();
  }, [partsByNum, allocsQuery.data]);
  const canonQuery = useQuery({
    queryKey: ['lego-canon', partNums.join(',')], queryFn: () => fetchCanonMap(partNums),
    enabled: allLoaded && partNums.length > 0 && allocsQuery.isSuccess, staleTime: Infinity,
  });

  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(ROWS);

  const pending = useMemo(() => {
    if (!allLoaded || !canonQuery.data || !allocsQuery.data) return [];
    const canon = canonQuery.data;
    return copies.map((c) => {
      const mine = allocsQuery.data!.filter((a) => a.user_set_id === c.id);
      return { copy: c, ...computePending(partsByNum.get(c.set_num)!, mine, canon) };
    }).sort((a, b) => b.pct - a.pct);
  }, [copies, partsByNum, canonQuery.data, allocsQuery.data, allLoaded]);

  if (tid == null) return <p className="text-sm text-white/60">{t.lego.needLogin}</p>;
  const err = (setsQuery.error ?? allocsQuery.error ?? canonQuery.error) as Error | null;
  if (err) return <div className="space-y-1"><p className="text-sm text-white/60">{t.lego.loadError}</p><p className="text-[11px] text-white/30 break-words">{err.message}</p></div>;
  if (setsQuery.isLoading || allocsQuery.isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>;
  if (copies.length === 0) return <p className="text-sm text-white/50">{t.lego.pendingNone}</p>;
  if (!allLoaded || (partNums.length > 0 && canonQuery.isLoading)) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/40">{t.lego.pendingHelp}</p>
      <ul className="space-y-3">
        {pending.map(({ copy, rows, total, assigned, pct }) => {
          const s = catalog.get(copy.set_num);
          const isOpen = open === copy.id;
          return (
            <li key={copy.id} className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
              <button onClick={() => { setOpen(isOpen ? null : copy.id); setLimit(ROWS); }} aria-expanded={isOpen}
                className="w-full flex items-center gap-3 p-3 text-left">
                <LegoImage src={s?.img_url} alt={s?.name ?? copy.set_num} className="w-16 h-16 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] text-red-300 font-semibold">{labels.get(copy.id) ?? copy.set_num}</p>
                  <p className="text-sm font-bold leading-tight line-clamp-1">{s?.name ?? t.lego.setNotInCatalog}</p>
                  <LegoPctBar value={pct} label={t.lego.metricSimple} />
                  <p className="text-[10px] text-white/40">
                    {rows.length === 0 ? t.lego.complete : tr('lego.pendingSummary', { assigned, total, missing: total - assigned, kinds: rows.length })}
                  </p>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-white/8 p-3 space-y-2">
                  {total > 0 && assigned === 0 && <p className="text-xs text-white/60">{t.lego.pendingNothingAssigned}</p>}
                  <ul className="space-y-2">
                    {rows.slice(0, limit).map((r) => (
                      <li key={r.key} className="flex items-center gap-3 bg-white/[0.04] border border-white/8 rounded-xl p-2">
                        <LegoImage src={r.part.img_url} alt={r.part.part_name} className="w-12 h-12 rounded-lg shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-red-300 font-semibold">{r.part.part_num}</p>
                          <p className="text-xs leading-tight line-clamp-2">{r.part.part_name}</p>
                          <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                            <span className="w-3 h-3 rounded-full border border-white/20 inline-block"
                              style={{ background: r.part.color_rgb ? `#${r.part.color_rgb}` : 'transparent', opacity: r.part.color_is_trans ? 0.6 : 1 }} />
                            {r.part.color_name}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-white/70">{r.assigned}/{r.need}</p>
                          <p className="text-[11px] font-bold text-red-300">{tr('lego.missing', { count: r.missing })}</p>
                        </div>
                      </li>))}
                  </ul>
                  {rows.length > limit && <button onClick={() => setLimit((l) => l + ROWS)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.showMore}</button>}
                  <button onClick={() => navigate(`/lego/sets/${encodeURIComponent(copy.set_num)}?tab=progress`)}
                    className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.pendingOpenSet}</button>
                </div>)}
            </li>);
        })}
      </ul>
    </div>
  );
}

