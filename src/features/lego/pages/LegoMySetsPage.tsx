import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useCurrency } from '@/hooks/use-currency';
import { useUserStore } from '@/store';
import { LegoImage } from '../components/LegoImage';
import { copyLabels } from '../copy-label';
import { LegoPendingParts } from '../components/LegoPendingParts';
import { fetchSetsByNums, fetchThemes } from '../services/lego-catalog';
import { buildView, type GroupKey, type SortDir, type SortKey } from '../my-sets-view';
import { listUserSets } from '../services/lego-user';
import { statusLabel } from '../status';
import { LEGO_SET_STATUSES, type LegoSetStatus } from '../types';

export function LegoMySetsPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const { symbol } = useCurrency();
  const tid = useUserStore((s) => s.telegramUser?.id);
  const [filter, setFilter] = useState<LegoSetStatus | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'pending' ? 'pending' : 'sets';
  const setTab = (v: 'sets' | 'pending') => setParams(v === 'pending' ? { tab: 'pending' } : {}, { replace: true });

  const mineQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });
  const mine = mineQuery.data ?? [];
  const labels = useMemo(() => copyLabels(mine), [mine]);
  const nums = useMemo(() => [...new Set(mine.map((m) => m.set_num))].sort(), [mine]);
  const setsQuery = useQuery({
    queryKey: ['lego-sets-by-nums', nums.join(',')],
    queryFn: () => fetchSetsByNums(nums),
    enabled: nums.length > 0,
    placeholderData: (prev) => prev,
  });
  const catalog = useMemo(() => new Map((setsQuery.data ?? []).map((s) => [s.set_num, s])), [setsQuery.data]);

  const themesQuery = useQuery({ queryKey: ['lego-themes'], queryFn: fetchThemes, staleTime: Infinity });
  const themeMap = useMemo(() => new Map((themesQuery.data ?? []).map((th) => [th.id, th])), [themesQuery.data]);

  // sort / group / search choices are a per-device convenience: remembered when storage allows it
  const [view, setView] = useState<{ search: string; sort: SortKey; dir: SortDir; group: GroupKey }>(() => {
    const base = { search: '', sort: 'number' as SortKey, dir: 'asc' as SortDir, group: 'none' as GroupKey };
    try { return { ...base, ...JSON.parse(localStorage.getItem('lego-my-sets-view') ?? '{}'), search: '' }; } catch { return base; }
  });
  useEffect(() => {
    try { localStorage.setItem('lego-my-sets-view', JSON.stringify({ sort: view.sort, dir: view.dir, group: view.group })); } catch { /* storage unavailable */ }
  }, [view.sort, view.dir, view.group]);

  const byStatus = useMemo(() => (filter ? mine.filter((m) => m.status === filter) : mine), [mine, filter]);
  const groups = useMemo(() => buildView(byStatus, catalog, themeMap, labels, view), [byStatus, catalog, themeMap, labels, view]);
  const shown = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const groupLabel = (g: { key: string; label: string | null }) =>
    g.label ?? (view.group === 'status' ? statusLabel(t, g.key as LegoSetStatus) : view.group === 'year' ? t.lego.noYear : t.lego.noTheme);
  const paid = shown.reduce((s, m) => s + (m.price_paid ?? 0), 0);
  const rrp = shown.reduce((s, m) => s + (m.rrp ?? 0), 0);
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-xs border ${active ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5'}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-black">{t.lego.mySets}</h1>
          {mineQuery.data && mine.length > 0 && (
            <p className="text-xs text-white/50">{tr('lego.mySetsTotal', { count: shown.length, paid: `${symbol}${paid.toFixed(2)}`, rrp: `${symbol}${rrp.toFixed(2)}` })}</p>)}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {tid == null && <p className="text-sm text-white/60">{t.lego.needLogin}</p>}
        {mineQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
        {mineQuery.isError && (
          <div className="space-y-2">
            <p className="text-sm text-white/60">{t.lego.loadError}</p>
            <p className="text-[11px] text-white/30 break-words">{(mineQuery.error as Error)?.message}</p>
            <button onClick={() => mineQuery.refetch()} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">{t.lego.retry}</button>
          </div>)}
        {mineQuery.isSuccess && mine.length === 0 && <p className="text-sm text-white/50">{t.lego.emptyMySets}</p>}

        {mine.length > 0 && (
          <div className="flex gap-2" role="tablist">
            <button role="tab" aria-selected={tab === 'sets'} className={chip(tab === 'sets')} onClick={() => setTab('sets')}>{t.lego.myCollectionTab}</button>
            <button role="tab" aria-selected={tab === 'pending'} className={chip(tab === 'pending')} onClick={() => setTab('pending')}>{t.lego.pendingTab}</button>
          </div>)}

        {tab === 'pending' && mine.length > 0 && <LegoPendingParts catalog={catalog} />}

        {tab === 'sets' && mine.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button className={chip(filter === null)} onClick={() => setFilter(null)}>{t.lego.filterAll}</button>
            {LEGO_SET_STATUSES.map((s) => (
              <button key={s} className={chip(filter === s)} onClick={() => setFilter(s)}>{statusLabel(t, s)}</button>))}
          </div>)}

        {tab === 'sets' && mine.length > 0 && (
          <div className="space-y-2">
            <input value={view.search} onChange={(e) => setView((v) => ({ ...v, search: e.target.value }))}
              placeholder={t.lego.searchMySets} aria-label={t.lego.searchMySets}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50" />
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
              <label className="block text-[10px] uppercase tracking-wide text-white/40 space-y-1">{t.lego.sortBy}
                <select value={view.sort} onChange={(e) => setView((v) => ({ ...v, sort: e.target.value as SortKey }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm normal-case tracking-normal text-white">
                  {(['number', 'year', 'theme', 'name', 'pieces', 'added', 'price'] as const).map((k) => <option key={k} value={k}>{t.lego[`sort_${k}`]}</option>)}
                </select>
              </label>
              <button onClick={() => setView((v) => ({ ...v, dir: v.dir === 'asc' ? 'desc' : 'asc' }))}
                aria-label={view.dir === 'asc' ? t.lego.sortAsc : t.lego.sortDesc} title={view.dir === 'asc' ? t.lego.sortAsc : t.lego.sortDesc}
                className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                {view.dir === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
              </button>
              <label className="block text-[10px] uppercase tracking-wide text-white/40 space-y-1">{t.lego.groupBy}
                <select value={view.group} onChange={(e) => setView((v) => ({ ...v, group: e.target.value as GroupKey }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm normal-case tracking-normal text-white">
                  {(['none', 'theme', 'year', 'status'] as const).map((k) => <option key={k} value={k}>{t.lego[`group_${k}`]}</option>)}
                </select>
              </label>
            </div>
          </div>)}
        {tab === 'sets' && mine.length > 0 && shown.length === 0 && <p className="text-sm text-white/50">{t.lego.noResults}</p>}

        {tab === 'sets' && groups.map((g) => (
        <section key={g.key || 'none'} className="space-y-2">
          {view.group !== 'none' && (
            <h2 className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wide text-white/60 pt-1">
              <span>{groupLabel(g)}</span><span className="text-white/35 font-normal">{g.items.length}</span>
            </h2>)}
        <ul className="grid grid-cols-2 gap-3">
          {g.items.map((m) => {
            const s = catalog.get(m.set_num);
            return (
              <li key={m.id}>
                <button onClick={() => navigate(`/lego/sets/${encodeURIComponent(m.set_num)}`)}
                  className="w-full text-left bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform">
                  <LegoImage src={s?.img_url} alt={s?.name ?? m.set_num} className="w-full aspect-[4/3]" />
                  <div className="p-3 space-y-0.5">
                    <p className="text-[11px] text-red-300 font-semibold">{labels.get(m.id) ?? m.set_num}</p>
                    <p className="text-sm font-bold leading-tight line-clamp-2">{s?.name ?? t.lego.setNotInCatalog}</p>
                    <p className="text-[11px] text-white/50">{statusLabel(t, m.status)}</p>
                    {s && <p className="text-[11px] text-white/40">{[s.year, s.num_parts != null ? tr('lego.piecesShort', { count: s.num_parts }) : null].filter(Boolean).join(' · ')}</p>}
                    {m.price_paid !== null && <p className="text-[11px] text-white/40">{symbol}{m.price_paid.toFixed(2)}</p>}
                  </div>
                </button>
              </li>);
          })}
        </ul>
        </section>))}

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
