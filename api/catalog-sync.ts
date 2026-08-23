export const config = { runtime: 'nodejs' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EBAY_APP_ID = process.env.EBAY_APP_ID!;
const ADMIN_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

// ──────────────────────────────────────────────
// Helpers Supabase
// ──────────────────────────────────────────────
async function supabaseQuery(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ──────────────────────────────────────────────
// eBay: precio por nombre (ventas completadas)
// ──────────────────────────────────────────────
async function getEbayPrice(name: string, tcg: string): Promise<number | null> {
  try {
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(EBAY_APP_ID + ':' + process.env.EBAY_CERT_ID).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return null;

    const query = tcg === 'funko' ? `Funko Pop ${name}` : name;
    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=buyingOptions:{FIXED_PRICE},conditions:{USED|VERY_GOOD|GOOD}&limit=10&sort=endTime`,
      { headers: { Authorization: `Bearer ${access_token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_ES' } }
    );
    const data = await searchRes.json();
    const items = data.itemSummaries ?? [];
    if (items.length === 0) return null;

    const prices = items
      .map((i: any) => parseFloat(i.price?.value ?? '0'))
      .filter((p: number) => p > 0);
    if (prices.length === 0) return null;

    // Mediana para evitar outliers
    prices.sort((a: number, b: number) => a - b);
    return prices[Math.floor(prices.length / 2)];
  } catch { return null; }
}

// ──────────────────────────────────────────────
// Pokémon: actualizar precios via pokemontcg.io
// ──────────────────────────────────────────────
async function syncPokemonPrices(batchSize = 100) {
  // Tomar los items de Pokémon con precio más antiguo
  const items = await supabaseQuery(
    `/catalog_items?tcg=eq.pokemon&order=price_updated_at.asc.nullsfirst&limit=${batchSize}&select=id,external_id,name`
  );

  let updated = 0;
  for (const item of items) {
    if (!item.external_id) continue;
    try {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards/${item.external_id}`, {
        headers: { 'X-Api-Key': process.env.VITE_POKEMONTCG_API_KEY ?? '' },
      });
      if (!res.ok) continue;
      const { data: card } = await res.json();
      const priceEur = card.cardmarket?.prices?.averageSellPrice ?? null;
      const priceUsd = card.tcgplayer?.prices?.normal?.market ?? card.tcgplayer?.prices?.holofoil?.market ?? null;

      if (priceEur || priceUsd) {
        await supabaseQuery(`/catalog_items?id=eq.${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            price_eur: priceEur,
            price_usd: priceUsd,
            price_source: 'pokemontcg',
            price_updated_at: new Date().toISOString(),
          }),
        });
        updated++;
      }
    } catch { /* continuar */ }
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }
  return updated;
}

// ──────────────────────────────────────────────
// Yu-Gi-Oh: YGOPRODeck API (gratuita, sin key)
// ──────────────────────────────────────────────
async function syncYugioh() {
  try {
    const res = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?num=500&offset=0');
    if (!res.ok) return 0;
    const { data: cards } = await res.json();

    const records = cards.map((card: any) => ({
      tcg: 'yugioh',
      external_id: String(card.id),
      name: card.name,
      image_url: card.card_images?.[0]?.image_url_small ?? null,
      rarity: card.card_sets?.[0]?.set_rarity ?? null,
      series: card.type ?? null,
      notes: card.desc ?? null,
    }));

    await supabaseQuery('/catalog_items', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(records),
    });
    return records.length;
  } catch { return 0; }
}

// ──────────────────────────────────────────────
// Magic: Scryfall API (gratuita, sin key)
// ──────────────────────────────────────────────
async function syncMagic() {
  try {
    const res = await fetch('https://api.scryfall.com/cards/search?q=set_type:core&order=released');
    if (!res.ok) return 0;
    const { data: cards } = await res.json();

    const records = cards.map((card: any) => ({
      tcg: 'magic',
      external_id: card.id,
      name: card.name,
      image_url: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? null,
      rarity: card.rarity ?? null,
      series: card.set_name ?? null,
      number: card.collector_number ?? null,
      price_usd: card.prices?.usd ? parseFloat(card.prices.usd) : null,
      price_eur: card.prices?.eur ? parseFloat(card.prices.eur) : null,
      price_source: 'scryfall',
      price_updated_at: new Date().toISOString(),
    }));

    await supabaseQuery('/catalog_items', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(records),
    });
    return records.length;
  } catch { return 0; }
}

// ──────────────────────────────────────────────
// Funko: actualizar precios via eBay (rotación)
// ──────────────────────────────────────────────
async function syncFunkoPrices(batchSize = 50) {
  const items = await supabaseQuery(
    `/catalog_items?tcg=eq.funko&order=price_updated_at.asc.nullsfirst&limit=${batchSize}&select=id,name`
  );

  let updated = 0;
  for (const item of items) {
    const price = await getEbayPrice(item.name, 'funko');
    if (price) {
      await supabaseQuery(`/catalog_items?id=eq.${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          price_eur: price,
          price_source: 'ebay',
          price_updated_at: new Date().toISOString(),
        }),
      });
      updated++;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  return updated;
}

// ──────────────────────────────────────────────
// Funko: importar nuevos desde eBay trending
// ──────────────────────────────────────────────
async function importNewFunkosFromEbay() {
  try {
    const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(EBAY_APP_ID + ':' + process.env.EBAY_CERT_ID).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return 0;

    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=Funko+Pop&filter=buyingOptions:{FIXED_PRICE}&limit=50&sort=newlyListed`,
      { headers: { Authorization: `Bearer ${access_token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_ES' } }
    );
    const data = await searchRes.json();
    const items = data.itemSummaries ?? [];

    const records = items.map((item: any) => ({
      tcg: 'funko',
      external_id: `ebay_${item.itemId}`,
      name: item.title?.replace(/funko pop!?\s*/i, '').trim() ?? item.title,
      image_url: item.image?.imageUrl ?? null,
      price_eur: item.price?.currency === 'EUR' ? parseFloat(item.price.value) : null,
      price_usd: item.price?.currency === 'USD' ? parseFloat(item.price.value) : null,
      price_source: 'ebay',
      price_updated_at: new Date().toISOString(),
      line: 'Pop! Vinyl',
    }));

    await supabaseQuery('/catalog_items', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(records),
    });
    return records.length;
  } catch { return 0; }
}

// ──────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  // Verificar que es una llamada autorizada (cron o admin)
  const secret = req.headers['x-cron-secret'] ?? req.query?.secret;
  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const mode = req.query?.mode ?? 'prices'; // 'prices' | 'import' | 'full'

  try {
    const results: Record<string, number> = {};

    if (mode === 'prices' || mode === 'full') {
      results.pokemon_prices = await syncPokemonPrices(100);
      results.funko_prices = await syncFunkoPrices(50);
    }

    if (mode === 'import' || mode === 'full') {
      results.yugioh_imported = await syncYugioh();
      results.magic_imported = await syncMagic();
      results.funko_new = await importNewFunkosFromEbay();
    }

    res.status(200).json({ ok: true, results, timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
}