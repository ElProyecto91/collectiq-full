// api/cron-prices.ts
// Cron que actualiza precios de todos los TCGs activos automáticamente
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getPokemonPrice(cardId: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.pokemontcg.io/v2/cards/${cardId}`, {
      headers: { 'X-Api-Key': process.env.VITE_POKEMONTCG_API_KEY! }
    });
    const d = await r.json();
    const prices = d?.data?.tcgplayer?.prices;
    if (!prices) return null;
    const p = prices.holofoil ?? prices.normal ?? prices.reverseHolofoil ?? Object.values(prices)[0] as any;
    return p?.market ?? p?.mid ?? null;
  } catch { return null; }
}

async function getFunkoPrice(name: string): Promise<number | null> {
  try {
    const query = encodeURIComponent(`Funko POP ${name}`);
    const r = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&filter=conditionIds:{1000|1500|2000|2500|3000},buyingOptions:{FIXED_PRICE}&limit=10&sort=price`,
      { headers: { Authorization: `Bearer ${process.env.EBAY_APP_ID}` } }
    );
    const d = await r.json();
    const items = d?.itemSummaries ?? [];
    if (!items.length) return null;
    const prices = items.map((i: any) => parseFloat(i.price?.value ?? '0')).filter((p: number) => p > 0);
    if (!prices.length) return null;
    prices.sort((a: number, b: number) => a - b);
    return prices[Math.floor(prices.length / 2)];
  } catch { return null; }
}

async function getOnePiecePrice(cardId: string): Promise<number | null> {
  try {
    // One Piece TCG API (optcgdecks / cardmarket scrape)
    const r = await fetch(`https://api.cardtrader.com/api/v2/products?blueprint_id=${cardId}`, {
      headers: { Authorization: `Bearer ${process.env.CARDTRADER_API_KEY ?? ''}` }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const prices = (d?.products ?? []).map((p: any) => parseFloat(p.price?.cents ?? 0) / 100).filter((p: number) => p > 0);
    if (!prices.length) return null;
    prices.sort((a: number, b: number) => a - b);
    return prices[0]; // precio mínimo
  } catch { return null; }
}

export default async function handler(req: any, res: any) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Leer TCGs activos desde el registry
  const { data: tcgs } = await supabase
    .from('tcg_registry')
    .select('name_short, price_source')
    .eq('status', 'active');

  if (!tcgs?.length) return res.status(200).json({ message: 'No active TCGs' });

  const results: Record<string, number> = {};

  for (const tcg of tcgs) {
    const tcgKey = tcg.name_short;

    // Obtener todos los items de ese TCG con external_card_id
    const { data: items } = await supabase
      .from('user_collection')
      .select('id, name, external_card_id, market_value')
      .eq('tcg', tcgKey)
      .not('external_card_id', 'is', null);

    if (!items?.length) { results[tcgKey] = 0; continue; }

    // Deduplicar por external_card_id para no llamar la API N veces por la misma carta
    const uniqueCards = new Map<string, { id: string; name: string }>();
    for (const item of items) {
      if (item.external_card_id && !uniqueCards.has(item.external_card_id)) {
        uniqueCards.set(item.external_card_id, { id: item.id, name: item.name });
      }
    }

    const priceCache = new Map<string, number | null>();
    const historyRows: any[] = [];
    let updated = 0;

    for (const [cardId, cardData] of uniqueCards) {
      let price: number | null = null;

      if (tcgKey === 'pokemon') price = await getPokemonPrice(cardId);
      else if (tcgKey === 'funko') price = await getFunkoPrice(cardData.name);
      else if (tcgKey === 'onepiece') price = await getOnePiecePrice(cardId);

      priceCache.set(cardId, price);

      if (price && price > 0) {
        historyRows.push({
          external_card_id: cardId,
          tcg: tcgKey,
          price_eur: price,
          source: tcg.price_source ?? tcgKey,
        });
      }

      await new Promise(r => setTimeout(r, 150));
    }

    // Actualizar todos los items con el precio cacheado
    for (const item of items) {
      const price = priceCache.get(item.external_card_id ?? '');
      if (price && price > 0) {
        await supabase
          .from('user_collection')
          .update({ market_value: price, updated_at: new Date().toISOString() })
          .eq('id', item.id);
        updated++;
      }
    }

    if (historyRows.length > 0) {
      await supabase.from('price_history').insert(historyRows);
    }

    results[tcgKey] = updated;
    await new Promise(r => setTimeout(r, 500));
  }

  return res.status(200).json({ ok: true, results });
}