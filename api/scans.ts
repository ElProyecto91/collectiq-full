// api/scans.ts — card-scan counters and referral progress of the logged-in user
// (one function for both: the project is close to Vercel's function-count limit)
import { DAILY_SCAN_LIMIT, bumpScans, cors, scanState, sessionUserId, supabase } from './_lib/auth';

const CARDS_REQUIRED = Number(process.env.REFERRAL_CARDS_REQUIRED) || 10;
const MAX_AD_BONUS = 1;       // scans a single rewarded ad grants
const MAX_BONUS_PER_DAY = 10; // ceiling for the extras of one day (an ad cannot be verified from here)

export default async function handler(req: any, res: any) {
  cors(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // the user comes from the session, never from the query or the body
  const uid = await sessionUserId(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  const out = (s: Awaited<ReturnType<typeof scanState>>) => ({
    scansUsed: s.used, scansAccumulated: s.accumulated, dailyLimit: DAILY_SCAN_LIMIT, premium: s.premium,
  });

  if (req.method === 'GET') return res.status(200).json(out(await scanState(uid)));

  if (req.method === 'POST') {
    const { action, amount } = req.body ?? {};
    if (action === 'check_referral') return res.status(200).json(await checkReferral(uid, req.body?.totalCards));
    const state = await scanState(uid);
    if (action === 'add_accumulated') {
      const add = Math.min(MAX_AD_BONUS, Math.max(1, Math.floor(Number(amount) || 1)));
      if (state.accumulated + add > MAX_BONUS_PER_DAY) return res.status(200).json(out(state));
      return res.status(200).json(out(await bumpScans(uid, 0, add)));
    }
    if (action === 'refund') {
      // the identification failed on our side (catalog down): give the scan back
      return res.status(200).json(out(state.used > 0 ? await bumpScans(uid, -1) : state));
    }
    return res.status(400).json({ error: 'unknown_action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Called after a card is added. If this user was invited (table referrals) it records how many cards they
 * have and marks the referral completed at REFERRAL_CARDS_REQUIRED. It does NOT grant a reward: what the
 * reward is has not been defined (reward_given stays untouched).
 */
async function checkReferral(uid: number, totalCards: unknown) {
  const total = Math.floor(Number(totalCards));
  if (!Number.isFinite(total) || total < 0) return { tracked: false, error: 'totalCards required' };
  const { data: ref } = await supabase.from('referrals').select('id, completed, cards_added').eq('referred_id', uid).maybeSingle();
  if (!ref) return { tracked: false };
  const cards = Math.max(Number(ref.cards_added ?? 0), total);
  const justCompleted = !ref.completed && cards >= CARDS_REQUIRED;
  const patch: Record<string, unknown> = { cards_added: cards };
  if (justCompleted) { patch.completed = true; patch.completed_at = new Date().toISOString(); }
  await supabase.from('referrals').update(patch).eq('id', ref.id);
  return { tracked: true, cards, required: CARDS_REQUIRED, completed: !!ref.completed || justCompleted };
}
