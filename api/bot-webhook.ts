export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BOT_TOKEN = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';
const WEBHOOK_SECRET = (globalThis as any).process?.env?.TELEGRAM_WEBHOOK_SECRET ?? '';

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function answerPreCheckoutQuery(preCheckoutQueryId: string, ok: boolean, errorMessage?: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pre_checkout_query_id: preCheckoutQueryId, ok, error_message: errorMessage }),
  });
}

async function activateGO(telegramUserId: number, starsPaid: number) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/user_premium?telegram_user_id=eq.${telegramUserId}&select=stars_paid`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const existingData = await existing.json();
  const previousStars = existingData?.[0]?.stars_paid ?? 0;

  await fetch(`${SUPABASE_URL}/rest/v1/user_premium`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      plan: 'go',
      expires_at: expiresAt,
      stars_paid: previousStars + starsPaid,
      updated_at: new Date().toISOString(),
    }),
  });

  return expiresAt;
}

function isValidUser(user: any): boolean {
  if (user?.is_bot) return false;
  if (!user?.first_name && !user?.username) return false;
  return true;
}

async function registerReferral(referrerId: number, referredId: number, referredUser: any) {
  if (referrerId === referredId) return;
  if (!isValidUser(referredUser)) return;

  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/referrals?referred_id=eq.${referredId}&select=id`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const existingData = await existing.json();
  if (existingData?.length > 0) return;

  await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      referrer_id: referrerId,
      referred_id: referredId,
      completed: false,
      cards_added: 0,
      reward_given: false,
      referred_registered_at: new Date().toISOString(),
    }),
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  // ✅ Verificar firma de Telegram
  const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const update = await req.json();

    // — Pago pendiente —
    if (update.pre_checkout_query) {
      await answerPreCheckoutQuery(update.pre_checkout_query.id, true);
      return new Response('OK', { status: 200 });
    }

    // — Pago completado —
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const userId = update.message.from.id;
      const starsPaid = payment.total_amount;

      let telegramUserId = userId;
      try {
        const payload = JSON.parse(payment.invoice_payload);
        telegramUserId = payload.telegramUserId ?? userId;
      } catch {}

      const expiresAt = await activateGO(telegramUserId, starsPaid);

      await sendMessage(userId,
        `⭐ <b>¡Bienvenido a CollectIQ GO!</b>\n\n` +
        `Tu plan está activo hasta el <b>${new Date(expiresAt).toLocaleDateString('es-ES')}</b>.\n\n` +
        `Disfruta de escaneos ilimitados y todas las funciones premium. 🚀\n\n` +
        `Abre la app: https://t.me/CollectIQ_bot/app`
      );

      return new Response('OK', { status: 200 });
    }

    // — Mensaje normal —
    const message = update.message;
    if (!message) return new Response('OK', { status: 200 });

    const chatId = message.chat.id;
    const user = message.from;
    const startParam = message.text?.split(' ')?.[1] ?? '';

    // Detectar referido
    if (startParam.startsWith('ref_')) {
      const referrerId = parseInt(startParam.replace('ref_', ''));
      if (!isNaN(referrerId) && isValidUser(user)) {
        await registerReferral(referrerId, user.id, user);
        await sendMessage(chatId,
  `👋 <b>¡Bienvenido a CollectIQ!</b>\n\n` +
  `Has sido invitado por un amigo. Añade <b>10 cartas</b> a tu colección y recibirás <b>6 horas de CollectIQ GO gratis</b>. 🎁\n\n` +
  `Abre la app: https://t.me/CollectIQ_bot/app`
);
return new Response('OK', { status: 200 });
      }
    }
// Mensaje de bienvenida
if (message.text === '/start' || (message.text?.startsWith('/start') && !startParam.startsWith('ref_'))) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: 'HTML',
      text:
        `🃏 <b>CollectIQ — Tu colección, reinventada.</b>\n\n` +
`Gestiona, analiza y comparte tu colección de cartas TCG como un profesional.\n\n` +
`⚡ <b>Lo que puedes hacer:</b>\n` +
`🔍 Escanea cartas con IA en segundos\n` +
`💰 Consulta precios de mercado en tiempo real\n` +
`📊 Analiza el valor y ROI de tu colección\n` +
`🏆 Crea mazos y compártelos con la comunidad\n` +
`❤️ Guarda una wishlist con alertas de precio\n` +
`🎯 Completa misiones y sube de nivel\n` +
`📦 Organiza por sets, rarezas y ubicación física\n` +
`🤝 Conecta con otros coleccionistas\n\n` +
`🚀 <b>¿Listo para empezar?</b>`,
        `👇 Pulsa el botón para abrir la app:`,
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Abrir CollectIQ', web_app: { url: 'https://collectiq-full.vercel.app' } }
        ]]
      }
    }),
  });
  return new Response('OK', { status: 200 });
}

    // Generar código de acceso normal
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
      `🔑 <b>Tu código de acceso CollectIQ:</b>\n\n<code>${code}</code>\n\n` +
      `Introdúcelo en la app para iniciar sesión.\n` +
      `⏰ Válido durante 5 minutos.`
    );

    return new Response('OK', { status: 200 });
  } catch {
    return new Response('OK', { status: 200 });
  }
}