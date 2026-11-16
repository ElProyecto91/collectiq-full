import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Crown, Loader2, LogOut, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserStore } from '@/store';
import { reloadForNewScope, setHouseholdScope } from '@/lib/household-scope';
import {
  HouseholdError, createInvite, fetchHousehold, joinHousehold, leaveHousehold, removeMember, revokeInvite,
  type HouseholdState,
} from './household';

const KEY = ['household'];

export function HouseholdPage() {
  const { t, tr } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: KEY, queryFn: fetchHousehold, retry: false });
  const state: HouseholdState = q.data ?? { household: null };

  const fail = (e: unknown) => {
    const c = e instanceof HouseholdError ? e.code : 'unknown';
    const known = ['invalid_code', 'bad_code', 'already_in_household', 'household_full', 'too_many_invites', 'same_household', 'unauthorized', 'network', 'not_owner'];
    setError(known.includes(c) ? t.household[`err_${c}` as keyof typeof t.household] : t.household.err_unknown);
  };
  const me = useUserStore((s) => s.telegramUser?.id);
  const apply = (s: HouseholdState) => {
    setError(null);
    qc.setQueryData(KEY, s);
    // the group changed: remember who shares the collection and reload so every page reads the new scope
    if (me && setHouseholdScope(me, (s.members ?? []).map((m) => m.telegram_user_id))) reloadForNewScope();
  };

  const invite = useMutation({ mutationFn: createInvite, onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: KEY }); }, onError: fail });
  const join = useMutation({ mutationFn: joinHousehold, onSuccess: (s) => { setCode(''); apply(s); }, onError: fail });
  const leave = useMutation({ mutationFn: leaveHousehold, onSuccess: apply, onError: fail });
  const remove = useMutation({ mutationFn: removeMember, onSuccess: apply, onError: fail });
  const revoke = useMutation({ mutationFn: revokeInvite, onSuccess: apply, onError: fail });

  const copy = async (c: string) => {
    const text = tr('household.shareText', { code: c });
    try { await navigator.clipboard.writeText(text); setCopied(c); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ }
  };
  const confirmLeave = () => { if (window.confirm(t.household.leaveConfirm)) leave.mutate(); };
  const confirmRemove = (id: number, name: string | null) => { if (window.confirm(tr('household.removeConfirm', { name: name ?? String(id) }))) remove.mutate(id); };

  const members = state.members ?? [];
  const isOwner = state.role === 'owner';
  const shared = members.length > 1;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label={t.household.back} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{t.household.title}</h1>
          <p className="text-xs text-white/50">{t.household.subtitle}</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {q.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
        {q.isError && <p className="text-sm text-red-300">{t.household.loadError}</p>}
        {error && <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

        {q.isSuccess && (
          <>
            <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4 text-red-300" />{t.household.members}
                <span className="ml-auto text-[11px] text-white/40">{members.length || 1}</span></h2>
              {members.length === 0 && <p className="text-xs text-white/50">{t.household.alone}</p>}
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.telegram_user_id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-200 flex items-center justify-center text-xs font-bold">
                      {(m.display_name ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{m.display_name ?? m.telegram_user_id}{m.is_me && <span className="text-white/40 font-normal"> · {t.household.you}</span>}</p>
                      <p className="text-[11px] text-white/40 flex items-center gap-1">{m.role === 'owner' && <Crown className="w-3 h-3 text-yellow-300" />}{m.role === 'owner' ? t.household.owner : t.household.member}</p>
                    </div>
                    {isOwner && !m.is_me && (
                      <button onClick={() => confirmRemove(m.telegram_user_id, m.display_name)} aria-label={t.household.remove} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <UserMinus className="w-4 h-4 text-white/50" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {shared && <p className="text-[11px] text-white/40">{t.household.sharedNote}</p>}
            </section>

            <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold flex items-center gap-2"><UserPlus className="w-4 h-4 text-red-300" />{t.household.inviteTitle}</h2>
              <p className="text-xs text-white/50">{t.household.inviteHelp}</p>
              {(state.invites ?? []).map((i) => (
                <div key={i.code} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                  <span className="font-mono text-base tracking-[0.2em] font-bold text-white flex-1">{i.code.slice(0, 4)}-{i.code.slice(4)}</span>
                  <span className="text-[10px] text-white/40">{tr('household.expires', { date: new Date(i.expires_at).toLocaleString() })}</span>
                  <button onClick={() => copy(i.code)} aria-label={t.household.copy} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    {copied === i.code ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => revoke.mutate(i.code)} aria-label={t.household.revoke} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              ))}
              <button onClick={() => invite.mutate()} disabled={invite.isPending}
                className="w-full rounded-xl bg-[#e3000b] text-white text-sm font-bold py-2.5 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {invite.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{t.household.newInvite}
              </button>
            </section>

            {!shared && (
              <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
                <h2 className="text-sm font-bold">{t.household.joinTitle}</h2>
                <p className="text-xs text-white/50">{t.household.joinHelp}</p>
                <div className="flex gap-2">
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} placeholder="ABCD-EFGH" aria-label={t.household.codeLabel}
                    className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 font-mono tracking-widest text-sm uppercase text-white placeholder:text-white/25" />
                  <button onClick={() => join.mutate(code)} disabled={join.isPending || code.replace(/[^A-Z0-9]/gi, '').length !== 8}
                    className="rounded-xl bg-white/10 px-4 text-sm font-bold disabled:opacity-40 active:scale-95">
                    {join.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.household.join}
                  </button>
                </div>
                <p className="text-[11px] text-white/35">{t.household.joinWarning}</p>
              </section>
            )}

            {state.household && (
              <button onClick={confirmLeave} disabled={leave.isPending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/8 text-gray-400 text-sm active:scale-95">
                <LogOut className="w-4 h-4" />{t.household.leave}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
