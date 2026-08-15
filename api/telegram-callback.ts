export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTelegramLogin(data: Record<string, string>, botToken: string): Promise<boolean> {
  const checkHash = data.hash;
  const dataCheckArr = Object.keys(data)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${data[k]}`);
  const dataCheckString = dataCheckArr.join('\n');

  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));
  const computedHash = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === checkHash;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => params[k] = v);

  const botToken = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';
  const isValid = await verifyTelegramLogin(params, botToken);

  if (!isValid) {
    return new Response('Invalid data', { status: 401 });
  }

  const user = {
    id: parseInt(params.id),
    first_name: params.first_name,
    last_name: params.last_name,
    username: params.username,
    photo_url: params.photo_url,
  };

  const token = await generateToken();

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

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `collectiq_session=${token}; Path=/; Max-Age=${90 * 24 * 60 * 60}; SameSite=Lax; Secure`,
    },
  });
}