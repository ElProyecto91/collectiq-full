export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BOT_TOKEN = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  try {
    const update = await req.json();
    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const text = message.text ?? '';
    const chatId = message.chat.id;
    const user = message.from;

    if (text.startsWith('/start getcode') || text === '/getcode') {
      // Generar código
      const array = new Uint8Array(3);
      crypto.getRandomValues(array);
      const code = Array.from(array)
        .map(b => b.toString(10).padStart(2, '0'))
        .join('')
        .slice(0, 6);

      const userData = {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
      };

      await fetch(`${SUPABASE_URL}/rest/v1/auth_codes`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          telegram_user_id: user.id,
          user_data: userData,
        }),
      });

      await sendMessage(chatId,
        `🔑 <b>Tu código de acceso es:</b>\n\n<code>${code}</code>\n\n` +
        `Introdúcelo en CollectIQ para iniciar sesión.\n` +
        `⏰ Válido durante 5 minutos.`
      );
    }

    return new Response('OK', { status: 200 });
  } catch {
    return new Response('OK', { status: 200 });
  }
}