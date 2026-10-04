import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { LegoImage } from '../components/LegoImage';
import { LegoPctBar } from '../components/LegoPctBar';
import { inventorySig } from '../inventory-sig';
import { fetchPossibleSets } from '../services/lego-catalog';
import { freeInventory } from '../services/lego-allocation';
import { listAllocations, listUserParts, listUserSets } from '../services/lego-user';
import type { RankingMetric } from '../types';

const LIMIT = 300;
const MIN_COVERED = 10;
const MIN_OPTIONS = [0.1, 0.25, 0.5, 0.75, 0.9];
const SHOWN = 24;

export function LegoPossibleSetsPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const tid = useUserStore((s) => s.telegramUser?.id);
  const [metric, setMetric] = useState<RankingMetric>('simple');
  const [minPct, setMinPct] = useState(0.1);
  const [limit, setLimit] = useState(SHOWN);

  const partsQuery = useQuery({ queryKey: ['user-lego-parts', tid], queryFn: () => listUserParts(tid!), enabled: tid != null });
  const allocsQuery = useQuery({ queryKey: ['user-lego-allocs', tid], queryFn: () => listAllocations(tid!), enabled: tid != null });
  const [onlyFree, setOnlyFree] = useState(true);
  // sets already in the collection are not candidates: they would hide the new ones
  const ownedQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });
  const owned = useMemo(() => new Set((ownedQuery.data ?? []).map((c) => c.set_num)), [ownedQuery.data]);
  const rawInventory = partsQuery.data ?? [];
  const allocs = allocsQuery.data ?? [];
  // pieces reserved by sets already in the collection are not available for another set
  const inventory = useMemo(() => (onlyFree ? freeInventory(rawInventory, allocs) : rawInventory), [onlyFree, rawInventory, allocs]);
  const sig = useMemo(() => inventorySig(inventory), [inventory]);

  const rankingQuery = useQuery({
    queryKey: ['lego-possible', sig, metric, minPct, owned.size],
    // owned sets are dropped after the query, so ask for that many extra to still fill the list
    queryFn: () => fetchPossibleSets({ inventory, metric, minPct, minCovered: MIN_COVERED, limit: LIMIT + owned.size }),
    enabled: inventory.length > 0 && allocsQuery.isSuccess && ownedQuery.isSuccess,
    staleTime: 10 * 60_000, // each ranking reads a lot of catalog rows: recalculate on demand
    gcTime: 30 * 60_000,
  });
  const sets = useMemo(() => (rankingQuery.data ?? []).filter((x) => !owned.has(x.set_num)).slice(0, LIMIT), [rankingQuery.data, owned]);
  const errMsg = (rankingQuery.error as Error | null)?.message ?? '';
  const needsImport = /no such table|no such column/i.test(errMsg);
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs border ${active ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5'}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-black">{t.lego.possibleSets}</h1>
          <p className="text-xs text-white/50">{t.lego.possibleSetsDesc}</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {tid == null && <p className="text-sm text-white/60">{t.lego.needLogin}</p>}
        {partsQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
        {partsQuery.isError && <p className="text-sm text-white/60">{t.lego.loadError} <span className="text-[11px] text-white/30 break-words">{(partsQuery.error as Error).message}</span></p>}

        {partsQuery.isSuccess && rawInventory.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-white/60">{t.lego.needInventory}</p>
            <button onClick={() => navigate(RoutePaths.LegoParts)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold">{t.lego.goToParts}</button>
          </div>)}

        {rawInventory.length > 0 && (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.lego.metricSimple}>
                <button role="radio" aria-checked={metric === 'simple'} className={chip(metric === 'simple')} onClick={() => { setMetric('simple'); setLimit(SHOWN); }}>{t.lego.metricSimple}</button>
                <button role="radio" aria-checked={metric === 'weighted'} className={chip(metric === 'weighted')} onClick={() => { setMetric('weighted'); setLimit(SHOWN); }}>{t.lego.metricWeighted}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/50">{t.lego.minPct}</span>
                {MIN_OPTIONS.map((m) => (
                  <button key={m} aria-pressed={minPct === m} className={chip(minPct === m)} onClick={() => { setMinPct(m); setLimit(SHOWN); }}>{Math.round(m * 100)}%</button>))}
              </div>
              {allocs.length > 0 && (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.lego.onlyFree}>
                  <button role="radio" aria-checked={onlyFree} className={chip(onlyFree)} onClick={() => { setOnlyFree(true); setLimit(SHOWN); }}>{t.lego.onlyFree}</button>
                  <button role="radio" aria-checked={!onlyFree} className={chip(!onlyFree)} onClick={() => { setOnlyFree(false); setLimit(SHOWN); }}>{t.lego.allPieces}</button>
                </div>)}
              {allocs.length > 0 && onlyFree && <p className="text-[11px] text-white/35">{t.lego.freeHelp}</p>}
              <p className="text-[11px] text-white/35">{t.lego.metricHelp}</p>
            </div>

            <div className="flex items-center justify-between text-xs text-white/50 min-h-5">
              <span>{rankingQuery.data ? tr('lego.rankingResults', { count: sets.length }) : ''}</span>
              <button onClick={() => rankingQuery.refetch()} disabled={rankingQuery.isFetching} className="flex items-center gap-1 text-red-300 disabled:opacity-40">
                <RefreshCw className={`w-3 h-3 ${rankingQuery.isFetching ? 'animate-spin' : ''}`} />{t.lego.rankingRefresh}
              </button>
            </div>

            {rankingQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
            {rankingQuery.isError && (
              <div className="space-y-2">
                <p className="text-sm text-white/60">{needsImport ? t.lego.rankingNeedsImport : t.lego.loadError}</p>
                <p className="text-[11px] text-white/30 break-words">{errMsg}</p>
              </div>)}
            {inventory.length === 0 && allocsQuery.isSuccess && <p className="text-sm text-white/50">{t.lego.rankingNone}</p>}
            {rankingQuery.isSuccess && sets.length === 0 && <p className="text-sm text-white/50">{t.lego.rankingNone}</p>}

            <ul className="grid grid-cols-2 gap-3">
              {sets.slice(0, limit).map((s) => (
                <li key={s.set_num}>
                  <button onClick={() => navigate(`/lego/sets/${encodeURIComponent(s.set_num)}?tab=progress`)}
                    className="w-full text-left bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform">
                    <LegoImage src={s.img_url} alt={s.name} className="w-full aspect-[4/3]" />
                    <div className="p-3 space-y-1.5">
                      <div>
                        <p className="text-[11px] text-red-300 font-semibold">{s.set_num}</p>
                        <p className="text-sm font-bold leading-tight line-clamp-2">{s.name}</p>
                      </div>
                      <LegoPctBar value={s.pct} label={t.lego.metricSimple} />
                      <LegoPctBar value={s.wpct} label={t.lego.metricWeighted} />
                      <p className="text-[10px] text-white/40">{tr('lego.rankingCovered', { covered: s.covered, total: s.total })}</p>
                    </div>
                  </button>
                </li>))}
            </ul>
            {sets.length > limit && <button onClick={() => setLimit((l) => l + SHOWN)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.showMore}</button>}
            {sets.length >= LIMIT && <p className="text-[11px] text-white/35">{tr('lego.rankingTruncated', { count: LIMIT })}</p>}
          </>)}

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
