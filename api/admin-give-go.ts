export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ADMIN_ID = 1299079722;

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await req.json();
    const telegramUserId = Number(body.telegramUserId);
    const targetUserId = Number(body.targetUserId);
    const months = body.months ?? 1;
    const days = body.days ?? 0;

    if (telegramUserId !== ADMIN_ID) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const ms = (months * 30 * 24 * 60 * 60 * 1000) + (days * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + ms).toISOString();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_premium`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        telegram_user_id: targetUserId,
        plan: 'go',
        expires_at: expiresAt,
        stars_paid: 0,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, expiresAt }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
}