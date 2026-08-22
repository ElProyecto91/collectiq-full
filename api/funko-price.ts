export const config = { runtime: 'edge' };

const EBAY_APP_ID = (globalThis as any).process?.env?.EBAY_APP_ID ?? '';
const EBAY_CERT_ID = (globalThis as any).process?.env?.EBAY_CERT_ID ?? '';

async function getEbayToken(): Promise<string> {
  const credentials = btoa(`${EBAY_APP_ID}:${EBAY_CERT_ID}`);
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req: Request) {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });

  try {
    const token = await getEbayToken();

    // Buscar ventas completadas en eBay España/Europa
    const searchRes = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?` +
      `q=${encodeURIComponent(name + ' funko pop')}&` +
      `filter=buyingOptions:{FIXED_PRICE},conditions:{USED|NEW}&` +
      `sort=price&limit=20&` +
      `marketplace_ids=EBAY_ES`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_ES',
        },
      }
    );

    const searchData = await searchRes.json();
    const items = searchData.itemSummaries ?? [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ price: null, confidence: 'low', count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calcular precio medio, mediana y rango
    const prices = items
      .map((i: any) => parseFloat(i.price?.value ?? '0'))
      .filter((p: number) => p > 0 && p < 500)
      .sort((a: number, b: number) => a - b);

    if (prices.length === 0) {
      return new Response(JSON.stringify({ price: null, confidence: 'low', count: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const avg = prices.reduce((s: number, p: number) => s + p, 0) / prices.length;
    const median = prices[Math.floor(prices.length / 2)];
    const min = prices[0];
    const max = prices[prices.length - 1];
    const confidence = prices.length >= 10 ? 'high' : prices.length >= 5 ? 'medium' : 'low';

    return new Response(JSON.stringify({
      price: Math.round(median * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      count: prices.length,
      confidence,
      currency: 'EUR',
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
}