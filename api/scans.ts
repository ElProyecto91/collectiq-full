// api/scans.ts — gestión de contadores de escaneos
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DAILY_LIMIT = 5;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const today = new Date().toISOString().split('T')[0];

  // ── GET /api/scans?userId=xxx ─────────────────────────────
  if (req.method === 'GET') {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data } = await supabase
      .from('user_scans')
      .select('scans_today, last_scan_date, bonus_scans')
      .eq('telegram_user_id', userId)
      .maybeSingle();

    const scansToday = data?.last_scan_date === today ? (data?.scans_today ?? 0) : 0;
    const scansAccumulated = data?.bonus_scans ?? 0;

    return res.status(200).json({
      scansUsed: scansToday,
      scansAccumulated: scansAccumulated,
      dailyLimit: DAILY_LIMIT,
    });
  }

  // ── POST /api/scans ───────────────────────────────────────
  if (req.method === 'POST') {
    const { telegramUserId, action, amount } = req.body;
    if (!telegramUserId) return res.status(400).json({ error: 'telegramUserId required' });

    const { data } = await supabase
      .from('user_scans')
      .select('scans_today, last_scan_date, bonus_scans')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    const scansToday = data?.last_scan_date === today ? (data?.scans_today ?? 0) : 0;
    const bonusScans = data?.bonus_scans ?? 0;

    let newScansToday = scansToday;
    let newBonusScans = bonusScans;

    if (action === 'use') {
      newScansToday = scansToday + 1;
    } else if (action === 'add_accumulated') {
      newBonusScans = bonusScans + (amount ?? 1);
    }

    await supabase.from('user_scans').upsert({
      telegram_user_id: telegramUserId,
      scans_today: newScansToday,
      last_scan_date: today,
      bonus_scans: newBonusScans,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'telegram_user_id' });

    return res.status(200).json({
      scansUsed: newScansToday,
      scansAccumulated: newBonusScans,
      dailyLimit: DAILY_LIMIT,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}