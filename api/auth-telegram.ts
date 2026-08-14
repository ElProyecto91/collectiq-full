export const config = { runtime: 'edge' };

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

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

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

    return new Response(JSON.stringify({ ok: true, user }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
}