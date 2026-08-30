// workers/handlers/funko-sync.js
import { getEnv } from '../lib/cors.js';
import { sbFetch } from '../lib/supabase.js';

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

function parseSlugs(html) {
  const matches = [...html.matchAll(/href="\/collectible\/([^"\/]+)\/"/g)];
  const slugs = matches
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i); // dedup
  return slugs;
}

function parseItem(slug, type) {
  // slug ejemplos: "101-trafalgar-law", "2-pack-goku-vegeta", "toji-fushiguro-chase"
  const firstPart = slug.split('-')[0];
  const isNumber = /^\d+$/.test(firstPart);
  const number = isNumber ? firstPart : null;
  const nameParts = isNumber ? slug.split('-').slice(1) : slug.split('-');
  const name = nameParts
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    tcg: 'funko',
    funko_type: type,
    funko_slug: slug,
    name,
    number,
    line: type,
    region: 'en',
    is_chase: slug.includes('chase'),
    is_flocked: slug.includes('flocked'),
    is_glow: slug.includes('glow') || slug.includes('gitd'),
    is_metallic: slug.includes('metallic'),
    last_synced_at: new Date().toISOString(),
  };
}

async function fetchImageForSlug(slug) {
  try {
    const res = await fetch(`https://funkypriceguide.com/collectible/${slug}/`);
    const html = await res.text();
    const match = html.match(/property="og:image"\s+content="([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function upsertItem(env, item) {
  const SUPABASE_URL = getEnv('SUPABASE_URL') || 'https://ajuinjefipjrnbimcdxz.supabase.co';
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/catalog_items?on_conflict=funko_slug&funko_slug=eq.${item.funko_slug}`,
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

export async function handleFunkoSync(env, request) {
  // Seguridad: solo cron o admin
  const url = new URL(request?.url || 'http://x');
  const secret = url.searchParams.get('secret');
  if (secret !== getEnv('CRON_SECRET') && request) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = { types: {}, total: 0, errors: [] };

  for (const { type, url: typeUrl } of FUNKO_TYPES) {
    try {
      const html = await fetch(typeUrl, {
        headers: { 'User-Agent': 'CollectIQ/1.0' }
      }).then(r => r.text());

      const slugs = parseSlugs(html);
      results.types[type] = { found: slugs.length, inserted: 0 };

      for (const slug of slugs) {
        const item = parseItem(slug, type);

        // Imagen: solo si no existe ya (para no spamear funkypriceguide)
        if (!item.image_url) {
          item.image_url = await fetchImageForSlug(slug);
        }

        const ok = await upsertItem(env, item);
        if (ok) {
          results.types[type].inserted++;
          results.total++;
        }
      }

    } catch (err) {
      results.errors.push({ type, error: err.message });
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}