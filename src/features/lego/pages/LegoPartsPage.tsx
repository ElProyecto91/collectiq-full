import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { LegoImage } from '../components/LegoImage';
import {
  fetchAllColors, fetchPartColors, fetchPartDetailsCached, searchParts,
} from '../services/lego-catalog';
import { addUserParts, listUserParts, setUserPartQuantity } from '../services/lego-user';
import type { LegoColorOption, LegoPartSummary, UserLegoPart } from '../types';

const SHOWN = 60;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const Swatch = ({ rgb, trans }: { rgb: string | null; trans: boolean }) => (
  <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 inline-block"
    style={{ background: rgb ? `#${rgb}` : 'transparent', opacity: trans ? 0.6 : 1 }} />
);

export function LegoPartsPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const qc = useQueryClient();
  const tid = useUserStore((s) => s.telegramUser?.id);

  // ── add a part ────────────────────────────────────────────────
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<LegoPartSummary | null>(null);
  const [colorId, setColorId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [qty, setQty] = useState('1');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dq = useDebounced(q, 300);

  const searchQuery = useQuery({
    queryKey: ['lego-part-search', dq.trim()],
    queryFn: () => searchParts(dq),
    enabled: dq.trim().length > 0 && !picked,
  });
  const partColorsQuery = useQuery({
    queryKey: ['lego-part-colors', picked?.part_num],
    queryFn: () => fetchPartColors(picked!.part_num),
    enabled: !!picked,
  });
  const knownColors = partColorsQuery.data ?? [];
  const useAll = showAll || (partColorsQuery.isSuccess && knownColors.length === 0);
  const allColorsQuery = useQuery({
    queryKey: ['lego-all-colors'], queryFn: fetchAllColors, staleTime: Infinity, enabled: !!picked && useAll,
  });
  const colors: LegoColorOption[] = useAll ? allColorsQuery.data ?? [] : knownColors;
  const chosenColor = colors.find((c) => c.color_id === colorId) ?? null;
  const quantity = Number.parseInt(qty, 10);

  // ── inventory ─────────────────────────────────────────────────
  const partsQuery = useQuery({
    queryKey: ['user-lego-parts', tid], queryFn: () => listUserParts(tid!), enabled: tid != null,
  });
  const parts = partsQuery.data ?? [];
  const keysSig = parts.map((p) => `${p.part_num}|${p.color_id}`).join(',');
  const detailsQuery = useQuery({
    queryKey: ['lego-part-details', keysSig],
    queryFn: () => fetchPartDetailsCached(parts),
    enabled: parts.length > 0,
    placeholderData: (prev) => prev,
  });
  const details = detailsQuery.data;

  const [filter, setFilter] = useState('');
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

  const fail = (e: unknown) => { setMessage(null); setError(e instanceof Error ? e.message : String(e)); };

  const addMutation = useMutation({
    mutationFn: () => addUserParts(tid!, [{ part_num: picked!.part_num, color_id: chosenColor!.color_id, quantity }]),
    onSuccess: () => {
      setError(null);
      setMessage(tr('lego.partAdded', { qty: quantity, name: picked!.name, color: chosenColor!.name }));
      setPicked(null); setColorId(null); setQ(''); setQty('1'); setShowAll(false);
      qc.invalidateQueries({ queryKey: ['user-lego-parts', tid] });
    },
    onError: fail,
  });

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
          {partsQuery.data && <p className="text-xs text-white/50">{tr('lego.partsSummary', { count: totalPieces, unique: parts.length })}</p>}
        </div>
      </div>

      <div className="px-4 space-y-6">
        {/* add */}
        <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold">{t.lego.addPart}</h2>
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={picked ? `${picked.part_num} · ${picked.name}` : q}
              onChange={(e) => { setPicked(null); setColorId(null); setQ(e.target.value); setMessage(null); setError(null); }}
              placeholder={t.lego.searchPartPlaceholder} className={`${field} w-full pl-9`} aria-label={t.lego.addPart} />
          </div>

          {!picked && searchQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          {!picked && searchQuery.isError && <p className="text-xs text-red-300">{t.lego.loadError}</p>}
          {!picked && searchQuery.data && searchQuery.data.length === 0 && dq.trim() && (
            <p className="text-xs text-white/50">{t.lego.noPartResults}</p>)}
          {!picked && searchQuery.data && searchQuery.data.length > 0 && (
            <ul className="divide-y divide-white/5 border border-white/8 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {searchQuery.data.map((r) => (
                <li key={r.part_num}>
                  <button onClick={() => { setPicked(r); setColorId(null); setShowAll(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 active:bg-white/10">
                    <span className="text-xs text-red-300 font-semibold">{r.part_num}</span>
                    <span className="text-xs text-white/70 ml-2">{r.name}</span>
                  </button>
                </li>))}
            </ul>)}

          {picked && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">{useAll ? t.lego.allColors : t.lego.onlyKnownColors}</p>
              {(partColorsQuery.isLoading || (useAll && allColorsQuery.isLoading)) && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.lego.chooseColor}>
                {colors.map((c) => (
                  <button key={c.color_id} role="radio" aria-checked={colorId === c.color_id} onClick={() => setColorId(c.color_id)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${colorId === c.color_id ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                    <Swatch rgb={c.rgb} trans={c.is_trans} />{c.name}
                  </button>))}
              </div>
              {!useAll && (
                <button onClick={() => setShowAll(true)} className="text-xs text-red-300 underline">{t.lego.showAllColors}</button>)}

              {chosenColor && (
                <div className="flex items-center gap-3">
                  <LegoImage src={chosenColor.img_url} alt={picked.name} className="w-16 h-16 rounded-xl shrink-0" />
                  <label className="flex-1 text-xs text-white/60 space-y-1">
                    {t.lego.quantity}
                    <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      inputMode="numeric" className={`${field} w-full`} />
                  </label>
                </div>)}
              <button disabled={!chosenColor || !(quantity > 0) || addMutation.isPending} onClick={() => addMutation.mutate()}
                className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-2">
                {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{t.lego.add}
              </button>
            </div>)}

          {message && <p className="text-xs text-green-300" role="status">{message}</p>}
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
              <li key={`${p.part_num}|${p.color_id}`} className="flex items-center gap-3 bg-white/[0.04] border border-white/8 rounded-xl p-2">
                <LegoImage src={d?.img_url} alt={d?.part_name ?? p.part_num} className="w-14 h-14 rounded-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-red-300 font-semibold">{p.part_num}</p>
                  <p className="text-xs leading-tight line-clamp-2">{d?.part_name ?? p.part_num}</p>
                  <p className="text-[11px] text-white/50 flex items-center gap-1 mt-0.5">
                    <Swatch rgb={d?.color_rgb ?? null} trans={d?.color_is_trans ?? false} />{d?.color_name ?? `#${p.color_id}`}
                  </p>
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
