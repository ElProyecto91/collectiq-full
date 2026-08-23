export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const SUPABASE_SERVICE_KEY = (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY ?? '';
const TCGAPI_KEY = (globalThis as any).process?.env?.TCGAPI_KEY ?? '';
const POKEMONTCG_KEY = (globalThis as any).process?.env?.VITE_POKEMONTCG_API_KEY ?? '';

async function getPriceFromTCGApi(cardName: string, setName: string, cardNumber: string): Promise<number | null> {
  try {
    const query = encodeURIComponent(`${cardName} ${setName}`);
    const res = await fetch(
      `https://api.tcgapi.dev/v1/cards?game=pokemon&q=${query}&limit=5`,
      { headers: { 'Authorization': `Bearer ${TCGAPI_KEY}` } }
    );
    const data = await res.json();
    const cards = data.data ?? [];
    // Buscar coincidencia exacta por número
    const match = cards.find((c: any) =>
      c.number === cardNumber ||
      c.name?.toLowerCase() === cardName?.toLowerCase()
    ) ?? cards[0];
    if (!match) return null;
    return match.prices?.market ?? match.prices?.low ?? null;
  } catch {
    return null;
  }
}

async function getPriceFromPokemonTCG(cardId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards/${cardId}`,
      { headers: { 'X-Api-Key': POKEMONTCG_KEY } }
    );
    const data = await res.json();
    const prices = data.data?.tcgplayer?.prices;
    if (!prices) return null;
    return prices.holofoil?.market
      ?? prices.normal?.market
      ?? prices.reverseHolofoil?.market
      ?? prices['1stEditionHolofoil']?.market
      ?? prices.unlimited?.market
      ?? null;
  } catch {
    return null;
  }
}

async function getPriceFromEbay(cardName: string, setName: string): Promise<number | null> {
  try {
    const EBAY_APP_ID = (globalThis as any).process?.env?.EBAY_APP_ID ?? '';
    const EBAY_CERT_ID = (globalThis as any).process?.env?.EBAY_CERT_ID ?? '';
    const credentials = btoa(`${EBAY_APP_ID}:${EBAY_CERT_ID}`);
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) return null;

    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?` +
      `q=${encodeURIComponent(cardName + ' ' + setName + ' pokemon card')}&` +
      `filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=10&` +
      `marketplace_ids=EBAY_ES`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_ES',
        },
      }
    );
    const searchData = await searchRes.json();
    const items = searchData.itemSummaries ?? [];
    const prices = items
      .map((i: any) => parseFloat(i.price?.value ?? '0'))
      .filter((p: number) => p > 0 && p < 1000)
      .sort((a: number, b: number) => a - b);
    if (!prices.length) return null;
    return prices[Math.floor(prices.length / 2)];
  } catch {
    return null;
  }
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const { telegramUserId } = await req.json();
    if (!telegramUserId) return new Response(JSON.stringify({ error: 'telegramUserId required' }), { status: 400 });

    // Obtener todas las cartas del usuario sin precio o con precio 0
    const cardsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/collection_items?telegram_user_id=eq.${telegramUserId}&select=id,card_id,card_name,set_name,card_number,market_price`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const cards = await cardsRes.json();
    if (!cards?.length) return new Response(JSON.stringify({ updated: 0, total: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });

    let updated = 0;
    let failed = 0;
    const results: { name: string; price: number | null; source: string }[] = [];

    for (const card of cards) {
      let price: number | null = null;
      let source = '';

      // Fuente 1: tcgapi.dev — mejor cobertura
      price = await getPriceFromTCGApi(card.card_name, card.set_name, card.card_number);
      if (price) source = 'tcgapi';

      // Fuente 2: pokemontcg.io — fallback
      if (!price && card.card_id) {
        price = await getPriceFromPokemonTCG(card.card_id);
        if (price) source = 'pokemontcg';
      }

      // Fuente 3: eBay — último recurso para cartas antiguas
      if (!price) {
        price = await getPriceFromEbay(card.card_name, card.set_name);
        if (price) source = 'ebay';
      }

      if (price) {
        await fetch(`${SUPABASE_URL}/rest/v1/collection_items?id=eq.${card.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            market_price: price,
            updated_at: new Date().toISOString(),
          }),
        });
        updated++;
        results.push({ name: card.card_name, price, source });
      } else {
        failed++;
      }

      // Pequeña pausa para no saturar las APIs
      await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({
      ok: true,
      updated,
      failed,
      total: cards.length,
      coverage: Math.round((updated / cards.length) * 100) + '%',
      results,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
}