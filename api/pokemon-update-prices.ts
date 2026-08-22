export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'telegramUserId required' }), { status: 400 });

    // Obtener todas las cartas del usuario
    const cardsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/collection_items?telegram_user_id=eq.${telegramUserId}&select=id,card_id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const cards = await cardsRes.json();
    if (!cards?.length) return new Response(JSON.stringify({ updated: 0 }), { headers: { 'Content-Type': 'application/json' } });

    let updated = 0;
    // Procesar en batches de 20
    for (let i = 0; i < cards.length; i += 20) {
      const batch = cards.slice(i, i + 20);
      const ids = batch.map((c: any) => c.card_id).join(',');

      const tcgRes = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=id:(${ids})&pageSize=20`,
        { headers: { 'X-Api-Key': (globalThis as any).process?.env?.VITE_POKEMONTCG_API_KEY ?? '' } }
      );
      const tcgData = await tcgRes.json();
      const tcgCards = tcgData.data ?? [];

      for (const tcgCard of tcgCards) {
        const marketPrice = tcgCard.tcgplayer?.prices?.holofoil?.market
          ?? tcgCard.tcgplayer?.prices?.normal?.market
          ?? tcgCard.tcgplayer?.prices?.reverseHolofoil?.market
          ?? null;
        const tcgplayerPrice = tcgCard.tcgplayer?.prices?.holofoil?.mid
          ?? tcgCard.tcgplayer?.prices?.normal?.mid
          ?? null;

        if (!marketPrice && !tcgplayerPrice) continue;

        const collectionItem = batch.find((c: any) => c.card_id === tcgCard.id);
        if (!collectionItem) continue;

        await fetch(`${SUPABASE_URL}/rest/v1/collection_items?id=eq.${collectionItem.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            market_price: marketPrice,
            tcgplayer_price: tcgplayerPrice,
            updated_at: new Date().toISOString(),
          }),
        });
        updated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, updated, total: cards.length }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
}