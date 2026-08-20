export const config = { runtime: 'edge' };

const ADMIN_ID = 1299079722;
const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ ok: false }), { status: 400 });

    // Verificar que el usuario existe en sesiones reales
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?telegram_user_id=eq.${telegramUserId}&select=telegram_user_id&limit=1`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const sessions = await res.json();

    // Verificar que es el admin real
    const isAdmin = telegramUserId === ADMIN_ID && sessions?.length > 0;

    return new Response(JSON.stringify({ ok: isAdmin }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}