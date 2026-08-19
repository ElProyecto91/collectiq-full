export const config = { runtime: 'edge' };

const BOT_TOKEN = (globalThis as any).process?.env?.TELEGRAM_BOT_TOKEN ?? '';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), { status: 400 });

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CollectIQ GO',
        description: 'Escaneos ilimitados, sin publicidad y acceso a todas las funciones premium durante 30 días.',
        payload: JSON.stringify({ telegramUserId, type: 'go_monthly' }),
        currency: 'XTR', // Telegram Stars
        prices: [{ label: 'CollectIQ GO — 1 mes', amount: 150 }], // 150 Stars
      }),
    });

    const data = await res.json();
    if (!data.ok) return new Response(JSON.stringify({ error: data.description }), { status: 500 });

    return new Response(JSON.stringify({ invoiceLink: data.result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500 });
  }
}