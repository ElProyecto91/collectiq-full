// workers/handlers/funko-images.js
// Fase 2: Rellena imágenes de items sin imagen en catalog_items
// Procesa 30 items por llamada para no superar el límite de subrequests
// Manual: /funko-images?secret=CRON_SECRET
// Llámalo varias veces hasta que devuelva pending: 0

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
const BATCH_SIZE = 30;

async function getItemsWithoutImage() {
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?tcg=eq.funko&image_url=is.null&funko_slug=not.is.null&select=id,funko_slug&limit=${BATCH_SIZE}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  if (!res.ok) return [];
  return res.json();
}

async function countPending() {
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?tcg=eq.funko&image_url=is.null&funko_slug=not.is.null&select=id`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    }
  );
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const match = range.match(/\/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

async function fetchImage(slug) {
  try {
    const res = await fetch(`https://funkypriceguide.com/collectible/${slug}/`, {
      headers: { 'User-Agent': 'CollectIQ/1.0' },
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function updateImage(id, imageUrl) {
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
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
    await new Promise(r => setTimeout(r, 200)); // 200ms entre requests

    if (imageUrl) {
      const ok = await updateImage(item.id, imageUrl);
      if (ok) results.updated++;
      else results.failed++;
    } else {
      // Si no hay imagen, poner placeholder para no volver a intentarlo
      await updateImage(item.id, 'https://funkypriceguide.com/static/icon-512.png');
      results.failed++;
    }

    results.processed++;
  }

  const pending = await countPending();
  results.pending = pending;
  results.done = pending === 0;
  results.ran_at = new Date().toISOString();

  if (request) return jsonResponse({ ok: true, ...results });
  return results;
}