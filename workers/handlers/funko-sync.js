// workers/handlers/funko-sync.js
// Fase 1: Sincroniza slugs y nombres de TODOS los tipos Funko desde funkypriceguide.com
// Sin imágenes (eso lo hace funko-images.js en Fase 2)
// Cron: cada domingo 4am | Manual: /funko-sync?secret=CRON_SECRET

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

// Catálogo completo de checklists de funkypriceguide.com
const FUNKO_CHECKLISTS = [
  // Main Lines
  { type: 'pop',     line: '8-Bit',          url: 'https://funkypriceguide.com/checklist/funko-pop-8-bit/' },
  { type: 'pop',     line: 'Ad Icons',        url: 'https://funkypriceguide.com/checklist/funko-pop-ad-icons/' },
  { type: 'pop',     line: 'Albums',          url: 'https://funkypriceguide.com/checklist/funko-pop-albums/' },
  { type: 'pop',     line: 'Animation',       url: 'https://funkypriceguide.com/checklist/funko-pop-animation/' },
  { type: 'pop',     line: 'Art Series',      url: 'https://funkypriceguide.com/checklist/funko-pop-art-series/' },
  { type: 'pop',     line: 'Asia',            url: 'https://funkypriceguide.com/checklist/funko-pop-asia/' },
  { type: 'pop',     line: 'Basketball',      url: 'https://funkypriceguide.com/checklist/funko-pop-basketball/' },
  { type: 'bitty',   line: 'Bitty Pop',       url: 'https://funkypriceguide.com/checklist/bitty-pop/' },
  { type: 'pop',     line: 'Books',           url: 'https://funkypriceguide.com/checklist/funko-pop-books/' },
  { type: 'pop',     line: 'Comics',          url: 'https://funkypriceguide.com/checklist/funko-pop-comics/' },
  { type: 'pop',     line: 'DC',              url: 'https://funkypriceguide.com/checklist/funko-pop-dc/' },
  { type: 'pop',     line: 'Deluxe',          url: 'https://funkypriceguide.com/checklist/funko-pop-deluxe/' },
  { type: 'pop',     line: 'Digital',         url: 'https://funkypriceguide.com/checklist/funko-pop-digital/' },
  { type: 'pop',     line: 'Disney',          url: 'https://funkypriceguide.com/checklist/funko-pop-disney/' },
  { type: 'pop',     line: 'Football',        url: 'https://funkypriceguide.com/checklist/funko-pop-football/' },
  { type: 'pop',     line: 'Games',           url: 'https://funkypriceguide.com/checklist/funko-pop-games/' },
  { type: 'pop',     line: 'Gold',            url: 'https://funkypriceguide.com/checklist/funko-pop-gold-vinyl-figures/' },
  { type: 'pop',     line: 'Harry Potter',    url: 'https://funkypriceguide.com/checklist/funko-pop-harry-potter/' },
  { type: 'pop',     line: 'Heroes',          url: 'https://funkypriceguide.com/checklist/funko-pop-heroes/' },
  { type: 'pop',     line: 'Marvel',          url: 'https://funkypriceguide.com/checklist/funko-pop-marvel/' },
  { type: 'moments', line: 'Moments',         url: 'https://funkypriceguide.com/checklist/funko-pop-movie-moments/' },
  { type: 'pop',     line: 'Movies',          url: 'https://funkypriceguide.com/checklist/funko-pop-movies/' },
  { type: 'pop',     line: 'Myths',           url: 'https://funkypriceguide.com/checklist/funko-pop-myths/' },
  { type: 'pop',     line: 'Rocks',           url: 'https://funkypriceguide.com/checklist/funko-pop-rocks/' },
  { type: 'rides',   line: 'Rides',           url: 'https://funkypriceguide.com/checklist/funko-pop-rides/' },
  { type: 'pop',     line: 'Sports',          url: 'https://funkypriceguide.com/checklist/funko-pop-sports/' },
  { type: 'pop',     line: 'Star Wars',       url: 'https://funkypriceguide.com/checklist/funko-pop-star-wars/' },
  { type: 'pop',     line: 'Television',      url: 'https://funkypriceguide.com/checklist/funko-pop-television/' },
  { type: 'pop',     line: 'Town',            url: 'https://funkypriceguide.com/checklist/funko-pop-town/' },
  { type: 'pop',     line: 'Trains',          url: 'https://funkypriceguide.com/checklist/funko-pop-trains/' },
  // Soda
  { type: 'soda',    line: 'Soda',            url: 'https://funkypriceguide.com/checklist/all-funko-soda-figures/' },
  // Variants
  { type: 'pop',     line: 'Black Light',     url: 'https://funkypriceguide.com/checklist/funko-pop-black-light/' },
  { type: 'pop',     line: 'Chase',           url: 'https://funkypriceguide.com/checklist/funko-pop-chases/' },
  { type: 'pop',     line: 'Diamond',         url: 'https://funkypriceguide.com/checklist/funko-pop-diamond-collection/' },
  { type: 'pop',     line: 'Flocked',         url: 'https://funkypriceguide.com/checklist/funko-pop-flocked/' },
  { type: 'pop',     line: 'Glow',            url: 'https://funkypriceguide.com/checklist/funko-pop-glow-in-the-dark/' },
  { type: 'pop',     line: 'Metallic',        url: 'https://funkypriceguide.com/checklist/funko-pop-metallic/' },
  // Special sizes
  { type: 'pop',     line: '10 Inch',         url: 'https://funkypriceguide.com/checklist/funko-pop-10-inch/' },
  { type: 'pop',     line: '6 Inch',          url: 'https://funkypriceguide.com/checklist/funko-pop-6-inch/' },
  { type: 'pop',     line: '2-Pack',          url: 'https://funkypriceguide.com/checklist/funko-pop-2-pack/' },
  { type: 'pop',     line: 'Jumbo',           url: 'https://funkypriceguide.com/checklist/jumbo/' },
];

function parseSlugs(html) {
  const matches = [...html.matchAll(/href="\/collectible\/([^"\/]+)\/"/g)];
  return [...new Set(matches.map(m => m[1]))];
}

function parseItem(slug, type, line) {
  const parts = slug.split('-');
  const isNumber = /^\d+$/.test(parts[0]);
  const number = isNumber ? parts[0] : null;
  const nameParts = isNumber ? parts.slice(1) : parts;
  const name = nameParts
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim();

  return {
    tcg: 'funko',
    funko_type: type,
    funko_slug: slug,
    name,
    number,
    line,
    region: 'en',
    is_chase:      slug.includes('chase'),
    is_flocked:    slug.includes('flocked'),
    is_glow:       slug.includes('glow') || slug.includes('gitd'),
    is_metallic:   slug.includes('metallic'),
    is_blacklight: slug.includes('black-light') || slug.includes('blacklight'),
    last_synced_at: new Date().toISOString(),
  };
}

async function upsertBatch(items) {
  const SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
  const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(items),
  });

  return res.ok;
}

export async function handleFunkoSync(request) {
  if (request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const results = { checklists: {}, total_slugs: 0, total_inserted: 0, errors: [] };
  const startedAt = Date.now();
  const seenSlugs = new Set();

  for (const { type, line, url: checklistUrl } of FUNKO_CHECKLISTS) {
    try {
      const html = await fetch(checklistUrl, {
        headers: { 'User-Agent': 'CollectIQ/1.0' },
      }).then(r => r.text());

      const slugs = parseSlugs(html).filter(s => !seenSlugs.has(s));
      slugs.forEach(s => seenSlugs.add(s));

      results.checklists[line] = { found: slugs.length, inserted: 0 };
      results.total_slugs += slugs.length;

      if (slugs.length === 0) continue;

      const items = slugs.map(slug => parseItem(slug, type, line));

      for (let i = 0; i < items.length; i += 100) {
        const batch = items.slice(i, i + 100);
        const ok = await upsertBatch(batch);
        if (ok) {
          results.checklists[line].inserted += batch.length;
          results.total_inserted += batch.length;
        }
      }

      console.log(`[funko-sync] ${line}: ${slugs.length} slugs, ${results.checklists[line].inserted} upserted`);

    } catch (err) {
      console.error(`[funko-sync] Error on ${line}:`, err.message);
      results.errors.push({ line, error: err.message });
    }
  }

  results.duration_ms = Date.now() - startedAt;
  results.ran_at = new Date().toISOString();

  if (request) return jsonResponse({ ok: true, ...results });
  return results;
}