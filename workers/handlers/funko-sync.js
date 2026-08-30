// workers/handlers/funko-sync.js
// Sincroniza Soda, Rides, Moments, Gold, 8-Bit, Albums, Bitty, Rewind, Deluxe, Digital
// desde funkypriceguide.com hacia catalog_items en Supabase
// Se ejecuta automáticamente cada domingo a las 4am (cron)
// O manualmente: /funko-sync?secret=CRON_SECRET

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

const FUNKO_TYPES = [
  { type: 'soda',    url: 'https://funkypriceguide.com/checklists/?type=2' },
  { type: 'rides',   url: 'https://funkypriceguide.com/checklist/funko-pop-rides/' },
  { type: 'moments', url: 'https://funkypriceguide.com/checklist/funko-pop-movie-moments/' },
  { type: '8bit',    url: 'https://funkypriceguide.com/checklist/funko-pop-8-bit/' },
  { type: 'albums',  url: 'https://funkypriceguide.com/checklist/funko-pop-albums/' },
  { type: 'gold',    url: 'https://funkypriceguide.com/checklist/funko-pop-gold-vinyl-figures/' },
  { type: 'bitty',   url: 'https://funkypriceguide.com/checklist/bitty-pop/' },
  { type: 'rewind',  url: 'https://funkypriceguide.com/checklist/funko-pop-rewind/' },
  { type: 'deluxe',  url: 'https://funkypriceguide.com/checklist/funko-pop-deluxe/' },
  { type: 'digital', url: 'https://funkypriceguide.com/checklist/funko-pop-digital/' },
];

// Extrae slugs únicos del HTML de funkypriceguide
function parseSlugs(html) {
  const matches = [...html.matchAll(/href="\/collectible\/([^"\/]+)\/"/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// Convierte un slug en un objeto item para Supabase
// Ejemplos: "101-trafalgar-law", "2-pack-goku-vegeta", "toji-fushiguro-chase"
function parseItem(slug, type) {
  const parts = slug.split('-');
  const isNumber = /^\d+$/.test(parts[0]);
  const number = isNumber ? parts[0] : null;
  const nameParts = isNumber ? parts.slice(1) : parts;
  const name = nameParts
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    tcg: 'funko',
    funko_type: type,
    funko_slug: slug,
    name,
    number,
    line: type,
    region: 'en',
    is_chase:    slug.includes('chase'),
    is_flocked:  slug.includes('flocked'),
    is_glow:     slug.includes('glow') || slug.includes('gitd'),
    is_metallic: slug.includes('metallic'),
    is_blacklight: slug.includes('black-light') || slug.includes('blacklight'),
    last_synced_at: new Date().toISOString(),
  };
}

// Obtiene la imagen OG de la página de detalle del coleccionable
async function fetchImageForSlug(slug) {
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

// Upsert en Supabase usando funko_slug como clave de conflicto
async function upsertItem(item) {
  const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(item),
    }
  );
  return res.ok;
}

// Handler principal — llamado desde cron o ruta manual
export async function handleFunkoSync(request) {
  // Si viene de HTTP (ruta manual), verificar secret
  if (request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders() });
    }
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== getEnv('CRON_SECRET')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  const results = { types: {}, total_inserted: 0, total_found: 0, errors: [] };
  const startedAt = Date.now();

  for (const { type, url: typeUrl } of FUNKO_TYPES) {
    try {
      console.log(`[funko-sync] Fetching type: ${type}`);

      const html = await fetch(typeUrl, {
        headers: { 'User-Agent': 'CollectIQ/1.0' },
      }).then(r => r.text());

      const slugs = parseSlugs(html);
      results.types[type] = { found: slugs.length, inserted: 0, skipped: 0 };
      results.total_found += slugs.length;

      for (const slug of slugs) {
        const item = parseItem(slug, type);

        // Obtener imagen (con delay para no saturar funkypriceguide)
        item.image_url = await fetchImageForSlug(slug);
        await new Promise(r => setTimeout(r, 150)); // 150ms entre requests

        const ok = await upsertItem(item);
        if (ok) {
          results.types[type].inserted++;
          results.total_inserted++;
        } else {
          results.types[type].skipped++;
        }
      }

      console.log(`[funko-sync] ${type}: ${slugs.length} found, ${results.types[type].inserted} inserted`);

    } catch (err) {
      console.error(`[funko-sync] Error on type ${type}:`, err.message);
      results.errors.push({ type, error: err.message });
    }
  }

  results.duration_ms = Date.now() - startedAt;
  results.ran_at = new Date().toISOString();

  console.log('[funko-sync] Done:', JSON.stringify(results));

  if (request) {
    return jsonResponse({ ok: true, ...results });
  }
  return results;
}