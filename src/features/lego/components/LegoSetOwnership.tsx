import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useCurrency } from '@/hooks/use-currency';
import { useUserStore } from '@/store';
import {
  addUserParts, addUserSet, deleteUserSet, listUserSets, mergeItems, removeUserParts,
} from '../services/lego-user';
import { statusLabel } from '../status';
import { LEGO_SET_STATUSES, type LegoPartItem, type LegoSet, type LegoSetPart, type LegoSetStatus } from '../types';

/** "0" and "" are valid (no price); anything else must be a non-negative number. */
function parseMoney(s: string): { ok: boolean; value: number | null } {
  const t = s.trim().replace(',', '.');
  if (t === '') return { ok: true, value: null };
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? { ok: true, value: Math.round(n * 100) / 100 } : { ok: false, value: null };
}

export function LegoSetOwnership({ set, parts }: { set: LegoSet; parts: LegoSetPart[] | undefined }) {
  const { t, tr } = useI18n();
  const qc = useQueryClient();
  const { symbol } = useCurrency();
  const tid = useUserStore((s) => s.telegramUser?.id);

  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ items: LegoPartItem[]; count: number } | null>(null);
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<LegoSetStatus>('sealed');
  const [paid, setPaid] = useState('');
  const [rrp, setRrp] = useState('');
  const [notes, setNotes] = useState('');

  // spare parts are never part of the set
  const items = useMemo(() => mergeItems(
    (parts ?? []).filter((p) => !p.is_spare).map((p) => ({ part_num: p.part_num, color_id: p.color_id, quantity: p.quantity }))
  ), [parts]);
  const pieces = items.reduce((s, i) => s + i.quantity, 0);

  const setsQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });
  const copies = (setsQuery.data ?? []).filter((c) => c.set_num === set.set_num);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const refreshParts = () => qc.invalidateQueries({ queryKey: ['user-lego-parts', tid] });

  const complete = useMutation({
    mutationFn: () => addUserParts(tid!, items),
    onSuccess: () => { setError(null); setConfirming(false); setUndone(false); setDone({ items, count: pieces }); refreshParts(); },
    onError: fail,
  });
  const undo = useMutation({
    mutationFn: () => removeUserParts(tid!, done!.items),
    onSuccess: () => { setError(null); setDone(null); setUndone(true); refreshParts(); },
    onError: fail,
  });

  const price = parseMoney(paid);
  const rrpVal = parseMoney(rrp);
  const addCopy = useMutation({
    mutationFn: () => addUserSet(tid!, {
      set_num: set.set_num, status, price_paid: price.value, rrp: rrpVal.value, notes: notes.trim() || null,
    }),
    onSuccess: () => {
      setError(null); setAdding(false); setPaid(''); setRrp(''); setNotes(''); setStatus('sealed');
      qc.invalidateQueries({ queryKey: ['user-lego-sets', tid] });
    },
    onError: fail,
  });
  const removeCopy = useMutation({
    mutationFn: (id: string) => deleteUserSet(tid!, id),
    // the database drops the copy's reservations with it, so its pieces are free again
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-lego-sets', tid] });
      qc.invalidateQueries({ queryKey: ['user-lego-allocs', tid] });
    },
    onError: fail,
  });

  const field = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50';
  const money = (n: number | null) => (n === null ? '—' : `${symbol}${n.toFixed(2)}`);

  if (tid == null) return <p className="text-xs text-white/50">{t.lego.needLogin}</p>;

  return (
    <div className="space-y-4">
      {/* "I own this set complete" -> adds its parts to the inventory */}
      <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
        {!confirming && (
          <button disabled={!parts || items.length === 0} onClick={() => { setConfirming(true); setDone(null); setUndone(false); setError(null); }}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold disabled:opacity-30">{t.lego.setComplete}</button>)}
        {parts && items.length === 0 && <p className="text-xs text-white/50">{t.lego.setCompleteNoParts}</p>}
        {confirming && (
          <div className="space-y-2">
            <p className="text-xs text-white/70">{tr('lego.setCompleteConfirm', { count: pieces, unique: items.length })}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-white/10 py-2 text-sm">{t.lego.cancel}</button>
              <button disabled={complete.isPending} onClick={() => complete.mutate()}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold flex items-center justify-center gap-2">
                {complete.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{t.lego.confirm}
              </button>
            </div>
          </div>)}
        {done && (
          <div className="flex items-center justify-between gap-3" role="status">
            <p className="text-xs text-green-300">{tr('lego.setCompleteDone', { count: done.count })}</p>
            <button disabled={undo.isPending} onClick={() => undo.mutate()} className="text-xs underline text-white/70 shrink-0">{t.lego.undo}</button>
          </div>)}
        {undone && <p className="text-xs text-white/60" role="status">{t.lego.setCompleteUndone}</p>}
      </section>

      {/* owned copies */}
      <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-bold">{t.lego.inCollection}</h2>
        {setsQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
        {setsQuery.isError && <p className="text-xs text-red-300">{t.lego.loadError}</p>}
        {setsQuery.isSuccess && copies.length === 0 && <p className="text-xs text-white/50">{t.lego.notOwned}</p>}
        <ul className="space-y-2">
          {copies.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3 border border-white/8 rounded-xl p-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs font-bold">{t.lego.copyOf} {copies.length - i} · {statusLabel(t, c.status)}</p>
                <p className="text-[11px] text-white/50">{t.lego.pricePaid}: {money(c.price_paid)} · {t.lego.rrp}: {money(c.rrp)}</p>
                {c.notes && <p className="text-[11px] text-white/40 break-words">{c.notes}</p>}
              </div>
              <button aria-label={t.lego.delete} disabled={removeCopy.isPending} onClick={() => removeCopy.mutate(c.id)}
                className="w-7 h-7 rounded-lg bg-red-500/15 text-red-300 flex items-center justify-center shrink-0"><Trash2 className="w-3 h-3" /></button>
            </li>))}
        </ul>

        {copies.length > 0 && <p className="text-[11px] text-white/40">{t.lego.deleteCopyReleases}</p>}
        {!adding && (
          <button onClick={() => setAdding(true)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.addToCollection}</button>)}
        {adding && (
          <div className="space-y-2">
            <label className="block text-xs text-white/60 space-y-1">{t.lego.status}
              <select value={status} onChange={(e) => setStatus(e.target.value as LegoSetStatus)} className={`${field} w-full`}>
                {LEGO_SET_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-white/60 space-y-1">{t.lego.pricePaid} ({symbol})
                <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" className={`${field} w-full`} />
              </label>
              <label className="block text-xs text-white/60 space-y-1">{t.lego.rrp} ({symbol})
                <input value={rrp} onChange={(e) => setRrp(e.target.value)} inputMode="decimal" className={`${field} w-full`} />
              </label>
            </div>
            <label className="block text-xs text-white/60 space-y-1">{t.lego.notes}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${field} w-full`} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-white/10 py-2 text-sm">{t.lego.cancel}</button>
              <button disabled={!price.ok || !rrpVal.ok || addCopy.isPending} onClick={() => addCopy.mutate()}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-2">
                {addCopy.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{t.lego.save}
              </button>
            </div>
          </div>)}
      </section>

      {error && <p className="text-xs text-red-300" role="alert">{t.lego.saveError} {tr('lego.saveErrorDetail', { message: error })}</p>}
    </div>
  );
}
