export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BOT_TOKEN = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';
const MAX_REFERRALS_PER_USER = 5;

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function addScans(telegramUserId: number, amount: number) {
  const today = new Date().toISOString().split('T')[0];
  await fetch(`${SUPABASE_URL}/rest/v1/user_scans`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      scan_date: today,
      scans_accumulated: amount,
    }),
  });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId, totalCards } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), { status: 400 });

    // Verificar count real en Supabase
    const realCountRes = await fetch(
      `${SUPABASE_URL}/rest/v1/collection_items?telegram_user_id=eq.${telegramUserId}&select=id`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' } }
    );
    const contentRange = realCountRes.headers.get('content-range') ?? '';
    const realCount = parseInt(contentRange.split('/')[1] ?? '0');

    if (Math.abs(realCount - totalCards) > 5) {
      return new Response(JSON.stringify({ ok: true, rewarded: false, reason: 'count_mismatch' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar referido pendiente
    const refRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referrals?referred_id=eq.${telegramUserId}&completed=eq.false&reward_given=eq.false&select=*`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const referrals = await refRes.json();
    if (!referrals?.length) return new Response(JSON.stringify({ ok: true, rewarded: false }), {
      headers: { 'Content-Type': 'application/json' },
    });

    const referral = referrals[0];

    // Verificar antigüedad mínima de 48h
    const registeredAt = new Date(referral.referred_registered_at ?? referral.created_at);
    const hoursSinceRegistration = (Date.now() - registeredAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRegistration < 48) {
      await fetch(`${SUPABASE_URL}/rest/v1/referrals?id=eq.${referral.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cards_added: realCount }),
      });
      return new Response(JSON.stringify({ ok: true, rewarded: false, reason: 'too_new' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verificar límite de referidos del referrer (máx 5)
    const referrerCountRes = await fetch(
      `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${referral.referrer_id}&reward_given=eq.true&select=id`,
      { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' } }
    );
    const referrerRange = referrerCountRes.headers.get('content-range') ?? '';
    const referrerCount = parseInt(referrerRange.split('/')[1] ?? '0');

    // Actualizar contador de cartas
    await fetch(`${SUPABASE_URL}/rest/v1/referrals?id=eq.${referral.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cards_added: realCount }),
    });

    if (realCount >= 10 && !referral.reward_given) {

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

      // 2. Dar +10 escaneos al referred (tu amigo)
      await addScans(telegramUserId, 10);

      // 3. Notificar al referred
      await sendMessage(telegramUserId,
        `🎁 <b>¡Has desbloqueado tu recompensa!</b>\n\n` +
        `Has añadido 10 cartas a tu colección.\n` +
        `<b>+10 escaneos extra</b> añadidos a tu cuenta. 🎴\n\n` +
        `Abre la app: https://t.me/CollectIQ_bot/app`
      );

      // 4. Dar 6h GO al referrer (tú) solo si no ha llegado al límite
      if (referrerCount < MAX_REFERRALS_PER_USER) {
        const now = new Date();
        // Si ya tiene GO activo, extender 6h
        const currentGoRes = await fetch(
          `${SUPABASE_URL}/rest/v1/user_premium?telegram_user_id=eq.${referral.referrer_id}&select=plan,expires_at`,
          { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        const currentGo = await currentGoRes.json();
        const current = currentGo?.[0];

        let expiresAt: string;
        if (current?.plan === 'go' && current?.expires_at && new Date(current.expires_at) > now) {
          expiresAt = new Date(new Date(current.expires_at).getTime() + 6 * 60 * 60 * 1000).toISOString();
        } else {
          expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
        }

        await fetch(`${SUPABASE_URL}/rest/v1/user_premium`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            telegram_user_id: referral.referrer_id,
            plan: 'go',
            expires_at: expiresAt,
            stars_paid: 0,
            updated_at: new Date().toISOString(),
          }),
        });

        // 5. Notificar al referrer
        await sendMessage(referral.referrer_id,
          `🎉 <b>¡Tu amigo ha completado el reto!</b>\n\n` +
          `Has ganado <b>6 horas de CollectIQ GO</b> por tu invitación. ⭐\n` +
          `Referidos completados: ${referrerCount + 1}/${MAX_REFERRALS_PER_USER}\n\n` +
          `Abre la app para disfrutarlo: https://t.me/CollectIQ_bot/app`
        );

        // 6. Notificación interna al referrer
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
            body: `Tu amigo completó el reto. ¡Has ganado 6h GO! (${referrerCount + 1}/${MAX_REFERRALS_PER_USER} referidos)`,
            data: { hours: 6 },
            read: false,
          }),
        });
      } else {
        // Referrer llegó al límite — solo notificar
        await sendMessage(referral.referrer_id,
          `ℹ️ <b>Tu amigo completó el reto</b>, pero ya has alcanzado el límite de ${MAX_REFERRALS_PER_USER} referidos recompensados.\n\n` +
          `Gracias por difundir CollectIQ. 🙌`
        );
      }

      return new Response(JSON.stringify({ ok: true, rewarded: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, rewarded: false, progress: realCount }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
  }
}