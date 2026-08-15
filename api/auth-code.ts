export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function generateCode(): Promise<string> {
  const array = new Uint8Array(3);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(10).padStart(3, '0')).join('').slice(0, 6);
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  // POST — crear código desde Telegram
  if (req.method === 'POST') {
    try {
      const { telegramUserId, userData } = await req.json();
      if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });

      const code = await generateCode();

      await fetch(`${SUPABASE_URL}/rest/v1/auth_codes`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          telegram_user_id: telegramUserId,
          user_data: userData,
        }),
      });

      return new Response(JSON.stringify({ ok: true, code }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
  }

  // GET — verificar código desde PWA
  if (req.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) return new Response(JSON.stringify({ error: 'No code' }), { status: 400 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auth_codes?code=eq.${code}&used=eq.false&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const codes = await res.json();

    if (!codes.length) return new Response(JSON.stringify({ error: 'Invalid code' }), { status: 401 });

    const authCode = codes[0];
    if (new Date(authCode.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Code expired' }), { status: 401 });
    }

    // Marcar como usado
    await fetch(`${SUPABASE_URL}/rest/v1/auth_codes?id=eq.${authCode.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ used: true }),
    });

    // Crear sesión
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegram_user_id: authCode.telegram_user_id,
        token,
        user_data: authCode.user_data,
      }),
    });

    return new Response(JSON.stringify({ ok: true, token, user: authCode.user_data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
}