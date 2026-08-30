// workers/handlers/funko-images.js
// Rellena imágenes de items Funko sin imagen
// HTTP manual: procesa 20 items
// Cron automático: procesa hasta 500 items en batches de 20

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const PLACEHOLDER = 'https://funkypriceguide.com/static/icon-512.png';

async function sbHeaders() {
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  };
}

async function getItemsWithoutImage(limit) {
  const headers = await sbHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?tcg=eq.funko&image_url=is.null&funko_slug=not.is.null&select=id,funko_slug&order=created_at.asc&limit=${limit}`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

async function fetchImage(slug) {
  if (slug.startsWith('ebay-')) return PLACEHOLDER;
  try {
    const res = await fetch(`https://funkypriceguide.com/collectible/${slug}/`, {
      headers: { 'User-Agent': 'CollectIQ/1.0' },
    });
    if (!res.ok) return PLACEHOLDER;
    const html = await res.text();
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    return match ? match[1] : PLACEHOLDER;
  } catch {
    return PLACEHOLDER;
  }
}

async function updateImage(id, imageUrl) {
  const headers = await sbHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?id=eq.${id}`,
    { method: 'PATCH', headers, body: JSON.stringify({ image_url: imageUrl }) }
  );
  return res.ok;
}

async function processBatch(items) {
  let updated = 0, failed = 0;
  for (const item of items) {
    const imageUrl = await fetchImage(item.funko_slug);
    const ok = await updateImage(item.id, imageUrl);
    if (ok) updated++; else failed++;
    await new Promise(r => setTimeout(r, 100));
  }
  return { updated, failed };
}

export async function handleFunkoImages(request) {
  const isCron = !request;

  if (request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Cron procesa hasta 500, HTTP manual procesa 20
  const limit = isCron ? 500 : 20;
  const items = await getItemsWithoutImage(limit);

  const results = { processed: 0, updated: 0, failed: 0 };

  // Procesar en batches de 20
  for (let i = 0; i < items.length; i += 20) {
    const batch = items.slice(i, i + 20);
    const { updated, failed } = await processBatch(batch);
    results.processed += batch.length;
    results.updated += updated;
    results.failed += failed;
  }

  results.done = items.length < limit;
  results.ran_at = new Date().toISOString();

  if (request) return jsonResponse({ ok: true, ...results });
  return results;
}