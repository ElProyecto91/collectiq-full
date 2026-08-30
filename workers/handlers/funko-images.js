// workers/handlers/funko-images.js
// Fase 2: Rellena imágenes de items Funko sin imagen
// Procesa 20 items por llamada
// Llama repetidamente hasta que pending === 0

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const BATCH_SIZE = 20;
const PLACEHOLDER = 'https://funkypriceguide.com/static/icon-512.png';

async function sbHeaders() {
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  };
}

async function getItemsWithoutImage() {
  const headers = await sbHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?tcg=eq.funko&image_url=is.null&funko_slug=not.is.null&select=id,funko_slug&order=created_at.asc&limit=${BATCH_SIZE}`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

async function fetchImage(slug) {
  // Items de eBay ya tienen imagen, solo buscar en funkypriceguide
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
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return res.ok;
}

export async function handleFunkoImages(request) {
  if (request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const items = await getItemsWithoutImage();
  const results = { processed: 0, updated: 0, failed: 0 };

  for (const item of items) {
    const imageUrl = await fetchImage(item.funko_slug);
    const ok = await updateImage(item.id, imageUrl);
    if (ok) results.updated++;
    else results.failed++;
    results.processed++;
    // Pequeña pausa para no saturar
    await new Promise(r => setTimeout(r, 100));
  }

  results.pending_approx = items.length === BATCH_SIZE ? 'más items pendientes' : 0;
  results.done = items.length < BATCH_SIZE;
  results.ran_at = new Date().toISOString();

  if (request) return jsonResponse({ ok: true, ...results });
  return results;
}