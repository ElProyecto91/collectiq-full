import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { LegoAddPart } from '../components/LegoAddPart';
import { LegoImage } from '../components/LegoImage';
import { LegoPartSets } from '../components/LegoPartSets';
import { fetchPartDetailsCached } from '../services/lego-catalog';
import { copyLabels } from '../copy-label';
import { availability } from '../services/lego-allocation';
import { listAllocations, listUserParts, listUserSets, setUserPartQuantity } from '../services/lego-user';
import type { UserLegoPart } from '../types';

const SHOWN = 60;

const Swatch = ({ rgb, trans }: { rgb: string | null; trans: boolean }) => (
  <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 inline-block"
    style={{ background: rgb ? `#${rgb}` : 'transparent', opacity: trans ? 0.6 : 1 }} />
);

export function LegoPartsPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const qc = useQueryClient();
  const tid = useUserStore((s) => s.telegramUser?.id);

  // ── inventory ─────────────────────────────────────────────────
  const partsQuery = useQuery({
    queryKey: ['user-lego-parts', tid], queryFn: () => listUserParts(tid!), enabled: tid != null,
  });
  const parts = partsQuery.data ?? [];
  // reservations by owned sets: the inventory is never reduced, pieces are only set aside
  const allocsQuery = useQuery({ queryKey: ['user-lego-allocs', tid], queryFn: () => listAllocations(tid!), enabled: tid != null });
  const setsQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });
  const av = useMemo(() => availability(parts, allocsQuery.data ?? []), [parts, allocsQuery.data]);
  const setNumOf = useMemo(() => copyLabels(setsQuery.data ?? []), [setsQuery.data]);
  const keysSig = parts.map((p) => `${p.part_num}|${p.color_id}`).join(',');
  const detailsQuery = useQuery({
    queryKey: ['lego-part-details', keysSig],
    queryFn: () => fetchPartDetailsCached(parts),
    enabled: parts.length > 0,
    placeholderData: (prev) => prev,
  });
  const details = detailsQuery.data;

  const [filter, setFilter] = useState('');
  const [openSets, setOpenSets] = useState<string | null>(null);
  const [limit, setLimit] = useState(SHOWN);
  useEffect(() => { setLimit(SHOWN); }, [filter]);

  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return parts
      .map((p) => ({ p, d: details?.get(`${p.part_num}|${p.color_id}`) }))
      .filter(({ p, d }) => !f || p.part_num.toLowerCase().includes(f)
        || (d?.part_name ?? '').toLowerCase().includes(f) || (d?.color_name ?? '').toLowerCase().includes(f));
  }, [parts, details, filter]);

  const totalPieces = parts.reduce((s, p) => s + p.quantity, 0);
  const freePieces = [...av.values()].reduce((s, a) => s + a.free, 0);

  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const qtyMutation = useMutation({
    mutationFn: (v: { p: UserLegoPart; next: number }) => setUserPartQuantity(tid!, v.p.part_num, v.p.color_id, v.next),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['user-lego-parts', tid] });
      const prev = qc.getQueryData<UserLegoPart[]>(['user-lego-parts', tid]);
      qc.setQueryData<UserLegoPart[]>(['user-lego-parts', tid], (old) =>
        (old ?? []).flatMap((x) => x.part_num === v.p.part_num && x.color_id === v.p.color_id
          ? (v.next > 0 ? [{ ...x, quantity: v.next }] : []) : [x]));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(['user-lego-parts', tid], ctx?.prev); fail(e); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['user-lego-parts', tid] }),
  });

  const field = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50';

  if (tid == null) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 pt-6 space-y-4">
        <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <p className="text-sm text-white/60">{t.lego.needLogin}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-black">{t.lego.inventory}</h1>
          {partsQuery.data && <p className="text-xs text-white/50">{tr('lego.partsSummary', { count: totalPieces, unique: parts.length })}{allocsQuery.data && allocsQuery.data.length > 0 && ` · ${tr('lego.totalFree', { free: freePieces, count: totalPieces })}`}</p>}
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* add */}
        <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold">{t.lego.addPart}</h2>
          <LegoAddPart tid={tid} />
          {error && <p className="text-xs text-red-300" role="alert">{t.lego.saveError} {tr('lego.saveErrorDetail', { message: error })}</p>}
        </section>

        {/* inventory */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold">{t.lego.myInventory}</h2>
          {partsQuery.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
          {partsQuery.isError && (
            <div className="space-y-2">
              <p className="text-sm text-white/60">{t.lego.loadError}</p>
              <p className="text-[11px] text-white/30 break-words">{(partsQuery.error as Error)?.message}</p>
              <button onClick={() => partsQuery.refetch()} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">{t.lego.retry}</button>
            </div>)}
          {partsQuery.data && parts.length === 0 && <p className="text-sm text-white/50">{t.lego.emptyInventory}</p>}
          {parts.length > 0 && (
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t.lego.filterInventory}
              className={`${field} w-full`} aria-label={t.lego.filterInventory} />)}

          <ul className="space-y-2">
            {rows.slice(0, limit).map(({ p, d }) => (
              <li key={`${p.part_num}|${p.color_id}`} className="bg-white/[0.04] border border-white/8 rounded-xl p-2 space-y-2">
                <div className="flex items-center gap-3">
                <LegoImage src={d?.img_url} alt={d?.part_name ?? p.part_num} className="w-14 h-14 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-red-300 font-semibold">{p.part_num}</p>
                  <p className="text-xs leading-tight line-clamp-2">{d?.part_name ?? p.part_num}</p>
                  <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                    <Swatch rgb={d?.color_rgb ?? null} trans={d?.color_is_trans ?? false} />{d?.color_name ?? `#${p.color_id}`}
                  </p>
                  {(() => {
                    const a = av.get(`${p.part_num}|${p.color_id}`);
                    if (!a || a.allocated === 0) return null;
                    // one line per set so "5 in 75192-1" is readable even with several sets
                    const bySet = new Map<string, number>();
                    for (const x of a.inSets) bySet.set(setNumOf.get(x.user_set_id) ?? '?', (bySet.get(setNumOf.get(x.user_set_id) ?? '?') ?? 0) + x.quantity);
                    return (
                      <p className="text-[11px] mt-0.5">
                        <span className="text-green-300 font-semibold">{tr('lego.ownedFree', { free: a.free })}</span>
                        {[...bySet].map(([setNum, q]) => <span key={setNum} className="text-white/50"> · {tr('lego.inSetShort', { count: q, set: setNum })}</span>)}
                        {a.owned < a.allocated && <span className="text-red-300 block">{t.lego.overAssigned}</span>}
                      </p>);
                  })()}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button aria-label={t.lego.decrease} onClick={() => qtyMutation.mutate({ p, next: p.quantity - 1 })}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                  <span className="w-8 text-center text-sm font-bold" aria-label={t.lego.quantity}>{p.quantity}</span>
                  <button aria-label={t.lego.increase} onClick={() => qtyMutation.mutate({ p, next: p.quantity + 1 })}
                    className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  <button aria-label={t.lego.delete} onClick={() => qtyMutation.mutate({ p, next: 0 })}
                    className="w-7 h-7 rounded-lg bg-red-500/15 text-red-300 flex items-center justify-center ml-1"><Trash2 className="w-3 h-3" /></button>
                </div>
                </div>
                <button onClick={() => setOpenSets(openSets === `${p.part_num}|${p.color_id}` ? null : `${p.part_num}|${p.color_id}`)}
                  aria-expanded={openSets === `${p.part_num}|${p.color_id}`} className="text-[11px] text-red-300 underline">
                  {openSets === `${p.part_num}|${p.color_id}` ? t.lego.partSetsHide : t.lego.partSetsToggle}
                </button>
                {openSets === `${p.part_num}|${p.color_id}` && (
                  <LegoPartSets partNum={p.part_num} colorId={p.color_id} colorName={d?.color_name ?? `#${p.color_id}`}
                    colorRgb={d?.color_rgb ?? null} colorIsTrans={d?.color_is_trans ?? false} />)}
              </li>))}
          </ul>
          {rows.length > limit && (
            <button onClick={() => setLimit((l) => l + SHOWN)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.showMore}</button>)}
        </section>

        <p className="text-[11px] text-white/30">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
