export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), { status: 400 });

    // Verificar si ya se dio el bonus
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?telegram_user_id=eq.${telegramUserId}&select=welcome_bonus_given&order=created_at.asc&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const sessions = await checkRes.json();
    
    if (!sessions?.length || sessions[0]?.welcome_bonus_given) {
      return new Response(JSON.stringify({ ok: true, bonus: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Dar +10 escaneos de bienvenida
    const today = new Date().toISOString().split('T')[0];
    await fetch(`${SUPABASE_URL}/rest/v1/user_scans`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        telegram_user_id: telegramUserId,
        scan_date: today,
        scans_used: 0,
        scans_accumulated: 10,
      }),
    });

    // Marcar bonus como dado
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?telegram_user_id=eq.${telegramUserId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ welcome_bonus_given: true }),
      }
    );

    return new Response(JSON.stringify({ ok: true, bonus: true, scans: 10 }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
  }
}