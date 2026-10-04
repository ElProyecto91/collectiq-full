import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useCurrency } from '@/hooks/use-currency';
import { useUserStore } from '@/store';
import { LegoImage } from '../components/LegoImage';
import { LegoPendingParts } from '../components/LegoPendingParts';
import { fetchSetsByNums } from '../services/lego-catalog';
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
  const nums = useMemo(() => [...new Set(mine.map((m) => m.set_num))].sort(), [mine]);
  const setsQuery = useQuery({
    queryKey: ['lego-sets-by-nums', nums.join(',')],
    queryFn: () => fetchSetsByNums(nums),
    enabled: nums.length > 0,
    placeholderData: (prev) => prev,
  });
  const catalog = useMemo(() => new Map((setsQuery.data ?? []).map((s) => [s.set_num, s])), [setsQuery.data]);

  const shown = filter ? mine.filter((m) => m.status === filter) : mine;
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

        <ul className="grid grid-cols-2 gap-3">
          {tab === 'sets' && shown.map((m) => {
            const s = catalog.get(m.set_num);
            return (
              <li key={m.id}>
                <button onClick={() => navigate(`/lego/sets/${encodeURIComponent(m.set_num)}`)}
                  className="w-full text-left bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform">
                  <LegoImage src={s?.img_url} alt={s?.name ?? m.set_num} className="w-full aspect-[4/3]" />
                  <div className="p-3 space-y-0.5">
                    <p className="text-[11px] text-red-300 font-semibold">{m.set_num}</p>
                    <p className="text-sm font-bold leading-tight line-clamp-2">{s?.name ?? t.lego.setNotInCatalog}</p>
                    <p className="text-[11px] text-white/50">{statusLabel(t, m.status)}</p>
                    {m.price_paid !== null && <p className="text-[11px] text-white/40">{symbol}{m.price_paid.toFixed(2)}</p>}
                  </div>
                </button>
              </li>);
          })}
        </ul>

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
