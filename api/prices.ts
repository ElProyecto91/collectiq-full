// api/prices.ts
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
    return prices[Math.floor(prices.length / 2)]; // mediana
  } catch { return null; }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  let telegram_user_id: number;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    telegram_user_id = payload.telegram_user_id;
    if (!telegram_user_id) throw new Error();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { tcg } = req.body;
  if (!tcg) return res.status(400).json({ error: 'tcg es obligatorio' });

  // Obtener items de la colección del usuario para ese TCG
  const { data: items, error } = await supabase
    .from('user_collection')
    .select('id, name, external_card_id, market_value')
    .eq('telegram_user_id', telegram_user_id)
    .eq('tcg', tcg);

  if (error) return res.status(500).json({ error: error.message });
  if (!items?.length) return res.status(200).json({ updated: 0 });

  let updated = 0;
  const historyRows: any[] = [];

  for (const item of items) {
    let price: number | null = null;

    if (tcg === 'pokemon' && item.external_card_id) {
      price = await getPokemonPrice(item.external_card_id);
    } else if (tcg === 'funko') {
      price = await getFunkoPrice(item.name);
    }
    // Aquí se añadirán más TCGs en Fase 5 (magic → scryfall, etc.)

    if (price && price > 0) {
      await supabase
        .from('user_collection')
        .update({ market_value: price, updated_at: new Date().toISOString() })
        .eq('id', item.id);

      historyRows.push({
        external_card_id: item.external_card_id,
        tcg,
        price_eur: price,
        source: tcg === 'pokemon' ? 'pokemontcg_io' : 'ebay'
      });

      updated++;
    }

    // Pausa para no saturar las APIs
    await new Promise(r => setTimeout(r, 100));
  }

  // Guardar historial en bloque
  if (historyRows.length > 0) {
    await supabase.from('price_history').insert(historyRows);
  }

  return res.status(200).json({ updated, total: items.length });
}