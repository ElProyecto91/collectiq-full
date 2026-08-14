import { createHmac } from 'crypto';

export const config = { runtime: 'edge' };

function verifyTelegramData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const computedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { initData } = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';

    if (!initData || !botToken) {
      return new Response(JSON.stringify({ error: 'Missing data' }), { status: 400 });
    }

    const isValid = verifyTelegramData(initData, botToken);
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