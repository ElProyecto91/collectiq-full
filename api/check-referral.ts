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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId, totalCards } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), { status: 400 });

    // Buscar referido pendiente
    const refRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referrals?referred_id=eq.${telegramUserId}&completed=eq.false&reward_given=eq.false&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const referrals = await refRes.json();
    if (!referrals?.length) return new Response(JSON.stringify({ ok: true, rewarded: false }), { headers: { 'Content-Type': 'application/json' } });

    const referral = referrals[0];

    // Actualizar contador de cartas
    await fetch(`${SUPABASE_URL}/rest/v1/referrals?id=eq.${referral.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cards_added: totalCards }),
    });

    // Si alcanza 10 cartas y no se ha dado recompensa
    if (totalCards >= 10 && !referral.reward_given) {

      // 1. Marcar como completado
      await fetch(`${SUPABASE_URL}/rest/v1/referrals?id=eq.${referral.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: true,
          reward_given: true,
          completed_at: new Date().toISOString(),
        }),
      });

      // 2. Dar 12h GO al referred
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
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
          stars_paid: 0,
          updated_at: new Date().toISOString(),
        }),
      });

      // 3. Dar +10 escaneos acumulados al referrer (via notificación al frontend)
      // Guardamos en user_notifications para que el frontend lo procese
      await fetch(`${SUPABASE_URL}/rest/v1/user_notifications`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegram_user_id: referral.referrer_id,
          type: 'referral_reward',
          title: '🎉 ¡Recompensa de referido!',
          body: 'Tu amigo ha añadido 10 cartas. ¡Has ganado +10 escaneos!',
          data: { scans: 10 },
          read: false,
        }),
      });

      // 4. Notificar al referred por Telegram
      await sendMessage(telegramUserId,
        `🎁 <b>¡Has desbloqueado tu recompensa!</b>\n\n` +
        `Has añadido 10 cartas a tu colección.\n` +
        `<b>12 horas de CollectIQ GO</b> activadas. ✨\n\n` +
        `Abre la app para disfrutarlo: https://t.me/CollectIQ_bot/app`
      );

      // 5. Notificar al referrer por Telegram
      await sendMessage(referral.referrer_id,
        `🎉 <b>¡Tu amigo ha completado el reto!</b>\n\n` +
        `Has ganado <b>+10 escaneos</b> por tu invitación. 🎴\n\n` +
        `Abre la app para usarlos: https://t.me/CollectIQ_bot/app`
      );

      return new Response(JSON.stringify({ ok: true, rewarded: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, rewarded: false, progress: totalCards }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
  }
}