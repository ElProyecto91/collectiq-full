// Shared by the Vercel functions: who is calling, and the Supabase client with the service role.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * The Telegram user id behind `Authorization: Bearer <session token>`, or null.
 * It is the same session token the rest of the app uses (table user_sessions); the id is never taken
 * from the request body, so one user cannot act as another.
 */
export async function sessionUserId(req: any): Promise<number | null> {
  const header: string = req.headers?.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data } = await supabase
    .from('user_sessions')
    .select('telegram_user_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return Number(data.telegram_user_id);
}

/** Same-origin calls only need these headers for the OPTIONS preflight of the app itself. */
export function cors(res: any, methods: string) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export const DAILY_SCAN_LIMIT = 5;

export interface ScanState {
  used: number;
  accumulated: number;
  limit: number;
  premium: boolean;
}

export const todayUtc = () => new Date().toISOString().split('T')[0];

/**
 * Card-scan quota of a user. One row per user and day in user_scans (scan_date, scans_used,
 * scans_accumulated): `scans_accumulated` is the extra scans earned TODAY (rewarded ads). GO subscribers
 * (user_premium, plan 'go', not expired) are unlimited.
 */
export async function scanState(uid: number): Promise<ScanState> {
  const [{ data: row }, { data: prem }] = await Promise.all([
    supabase.from('user_scans').select('scans_used, scans_accumulated').eq('telegram_user_id', uid).eq('scan_date', todayUtc()).maybeSingle(),
    supabase.from('user_premium').select('plan, expires_at').eq('telegram_user_id', uid).maybeSingle(),
  ]);
  const premium = prem?.plan === 'go' && !!prem?.expires_at && new Date(prem.expires_at) > new Date();
  const accumulated = Number(row?.scans_accumulated ?? 0);
  return { used: Number(row?.scans_used ?? 0), accumulated, limit: DAILY_SCAN_LIMIT + accumulated, premium };
}

/** Adds `usedDelta` / `accumulatedDelta` to today's row (never below 0). */
export async function bumpScans(uid: number, usedDelta: number, accumulatedDelta = 0): Promise<ScanState> {
  const s = await scanState(uid);
  await supabase.from('user_scans').upsert(
    {
      telegram_user_id: uid,
      scan_date: todayUtc(),
      scans_used: Math.max(0, s.used + usedDelta),
      scans_accumulated: Math.max(0, s.accumulated + accumulatedDelta),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_user_id,scan_date' }
  );
  return scanState(uid);
}
