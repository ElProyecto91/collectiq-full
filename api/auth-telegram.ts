export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function verifyTelegramData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const secretKey = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(botToken));

  const verifyKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', verifyKey, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === hash;
}

async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: Request) {
  if (req.method === 'GET') {
    // Verificar sesión existente
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return new Response(JSON.stringify({ error: 'No token' }), { status: 400 });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${token}&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const sessions = await res.json();
    if (!sessions.length) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });

    const session = sessions[0];
    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 });
    }

    return new Response(JSON.stringify({ ok: true, user: session.user_data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'POST') {
    try {
      const { initData } = await req.json();
      const botToken = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';

      if (!initData || !botToken) {
        return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });
      }

      const isValid = await verifyTelegramData(initData, botToken);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid Telegram data' }), { status: 401 });
      }

      const params = new URLSearchParams(initData);
      const user = JSON.parse(params.get('user') ?? '{}');
      const token = await generateToken();

      // Guardar sesión en Supabase
      await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_user_id: user.id,
          token,
          user_data: user,
        }),
      });

      return new Response(JSON.stringify({ ok: true, user, token }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}