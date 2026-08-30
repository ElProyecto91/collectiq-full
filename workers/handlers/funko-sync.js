// workers/handlers/funko-sync.js
// Sincroniza catálogo Funko completo desde funkypriceguide.com
// Páginas de 5 checklists para no superar límite de subrequests
// Checklists JS-only (DC, Deluxe, Digital, Soda, Myths, Sports) → via eBay search
// Manual: /funko-sync?secret=X&page=0..7
// Cron domingo 4am ejecuta todas las páginas

import { getEnv, jsonResponse, corsHeaders } from '../lib/cors.js';

// ── Checklists scrapeables (HTML estático) ────────────────────
// Divididos en páginas de 5 para no superar el límite de subrequests
const FUNKO_CHECKLISTS = [
  // Página 0
  { type: 'pop',     line: '8-Bit',        url: 'https://funkypriceguide.com/checklist/funko-pop-8-bit/' },
  { type: 'pop',     line: 'Ad Icons',     url: 'https://funkypriceguide.com/checklist/funko-pop-ad-icons/' },
  { type: 'pop',     line: 'Albums',       url: 'https://funkypriceguide.com/checklist/funko-pop-albums/' },
  { type: 'pop',     line: 'Animation',    url: 'https://funkypriceguide.com/checklist/funko-pop-animation/' },
  { type: 'pop',     line: 'Art Series',   url: 'https://funkypriceguide.com/checklist/funko-pop-art-series/' },
  // Página 1
  { type: 'pop',     line: 'Asia',         url: 'https://funkypriceguide.com/checklist/funko-pop-asia/' },
  { type: 'pop',     line: 'Basketball',   url: 'https://funkypriceguide.com/checklist/funko-pop-basketball/' },
  { type: 'bitty',   line: 'Bitty Pop',    url: 'https://funkypriceguide.com/checklist/bitty-pop/' },
  { type: 'pop',     line: 'Books',        url: 'https://funkypriceguide.com/checklist/funko-pop-books/' },
  { type: 'pop',     line: 'Comics',       url: 'https://funkypriceguide.com/checklist/funko-pop-comics/' },
  // Página 2
  { type: 'pop',     line: 'Disney',       url: 'https://funkypriceguide.com/checklist/funko-pop-disney/' },
  { type: 'pop',     line: 'Football',     url: 'https://funkypriceguide.com/checklist/funko-pop-football/' },
  { type: 'pop',     line: 'Games',        url: 'https://funkypriceguide.com/checklist/funko-pop-games/' },
  { type: 'pop',     line: 'Gold',         url: 'https://funkypriceguide.com/checklist/funko-pop-gold-vinyl-figures/' },
  { type: 'pop',     line: 'Harry Potter', url: 'https://funkypriceguide.com/checklist/funko-pop-harry-potter/' },
  // Página 3
  { type: 'pop',     line: 'Heroes',       url: 'https://funkypriceguide.com/checklist/funko-pop-heroes/' },
  { type: 'pop',     line: 'Marvel',       url: 'https://funkypriceguide.com/checklist/funko-pop-marvel/' },
  { type: 'moments', line: 'Moments',      url: 'https://funkypriceguide.com/checklist/funko-pop-movie-moments/' },
  { type: 'pop',     line: 'Movies',       url: 'https://funkypriceguide.com/checklist/funko-pop-movies/' },
  { type: 'pop',     line: 'Rocks',        url: 'https://funkypriceguide.com/checklist/funko-pop-rocks/' },
  // Página 4
  { type: 'rides',   line: 'Rides',        url: 'https://funkypriceguide.com/checklist/funko-pop-rides/' },
  { type: 'pop',     line: 'Star Wars',    url: 'https://funkypriceguide.com/checklist/funko-pop-star-wars/' },
  { type: 'pop',     line: 'Television',   url: 'https://funkypriceguide.com/checklist/funko-pop-television/' },
  { type: 'pop',     line: 'Town',         url: 'https://funkypriceguide.com/checklist/funko-pop-town/' },
  { type: 'pop',     line: 'Trains',       url: 'https://funkypriceguide.com/checklist/funko-pop-trains/' },
  // Página 5
  { type: 'pop',     line: 'Black Light',  url: 'https://funkypriceguide.com/checklist/funko-pop-black-light/' },
  { type: 'pop',     line: 'Chase',        url: 'https://funkypriceguide.com/checklist/funko-pop-chases/' },
  { type: 'pop',     line: 'Diamond',      url: 'https://funkypriceguide.com/checklist/funko-pop-diamond-collection/' },
  { type: 'pop',     line: 'Flocked',      url: 'https://funkypriceguide.com/checklist/funko-pop-flocked/' },
  { type: 'pop',     line: 'Glow',         url: 'https://funkypriceguide.com/checklist/funko-pop-glow-in-the-dark/' },
  // Página 6
  { type: 'pop',     line: 'Metallic',     url: 'https://funkypriceguide.com/checklist/funko-pop-metallic/' },
  { type: 'pop',     line: '10 Inch',      url: 'https://funkypriceguide.com/checklist/funko-pop-10-inch/' },
  { type: 'pop',     line: '6 Inch',       url: 'https://funkypriceguide.com/checklist/funko-pop-6-inch/' },
  { type: 'pop',     line: '2-Pack',       url: 'https://funkypriceguide.com/checklist/funko-pop-2-pack/' },
  { type: 'pop',     line: 'Jumbo',        url: 'https://funkypriceguide.com/checklist/jumbo/' },
];

// ── Checklists JS-only → se obtienen via eBay ─────────────────
// Página 7 especial: busca en eBay los tipos que funkypriceguide no sirve en HTML
const EBAY_TYPES = [
  { type: 'soda',    line: 'Soda',    query: 'Funko Soda' },
  { type: 'pop',     line: 'Deluxe',  query: 'Funko Pop Deluxe' },
  { type: 'digital', line: 'Digital', query: 'Funko Pop Digital' },
  { type: 'pop',     line: 'DC',      query: 'Funko Pop DC Comics' },
  { type: 'pop',     line: 'Myths',   query: 'Funko Pop Myths' },
  { type: 'pop',     line: 'Sports',  query: 'Funko Pop Sports' },
];

const PAGE_SIZE = 5;
const TOTAL_PAGES = Math.ceil(FUNKO_CHECKLISTS.length / PAGE_SIZE) + 1; // +1 para la página eBay

// ── Helpers ───────────────────────────────────────────────────

function parseSlugs(html) {
  const matches = [...html.matchAll(/href="\/collectible\/([^"\/]+)\/"/g)];
  return [...new Set(matches.map(m => m[1]))];
}

function parseItem(slug, type, line) {
  const parts = slug.split('-');
  const isNumber = /^\d+$/.test(parts[0]);
  const number = isNumber ? parts[0] : null;
  const nameParts = isNumber ? parts.slice(1) : parts;
  const name = nameParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();
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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_items?on_conflict=funko_slug`, {
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

// ── eBay token ────────────────────────────────────────────────

async function getEbayToken() {
  const appId = getEnv('EBAY_APP_ID');
  const certId = getEnv('EBAY_CERT_ID');
  const credentials = btoa(`${appId}:${certId}`);
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

// Busca en eBay y devuelve items únicos por título
async function searchEbayItems(query, type, line, token) {
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=200&category_ids=261068`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data.itemSummaries || []);

  // Deduplicar por título normalizado
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const slug = item.title
      .toLowerCase()
      .replace(/funko (pop|soda|digital|deluxe)!?\s*/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80);
    if (seen.has(slug)) continue;
    seen.add(slug);
    unique.push({
      tcg: 'funko',
      funko_type: type,
      funko_slug: `ebay-${type}-${slug}`,
      name: item.title.replace(/funko (pop|soda|digital|deluxe)!?\s*/i, '').trim(),
      line,
      image_url: item.image?.imageUrl || null,
      price_eur: item.price?.value ? parseFloat(item.price.value) : null,
      price_source: 'ebay',
      region: 'en',
      last_synced_at: new Date().toISOString(),
    });
  }
  return unique;
}

// ── Sync por página ───────────────────────────────────────────

async function syncPage(page) {
  const results = { page, checklists: {}, total_slugs: 0, total_inserted: 0, errors: [] };

  // Página especial eBay (última página)
  const ebayPage = Math.ceil(FUNKO_CHECKLISTS.length / PAGE_SIZE);
  if (page === ebayPage) {
    try {
      const token = await getEbayToken();
      for (const { type, line, query } of EBAY_TYPES) {
        const items = await searchEbayItems(query, type, line, token);
        results.checklists[line] = { found: items.length, inserted: 0, source: 'ebay' };
        results.total_slugs += items.length;
        if (items.length === 0) continue;
        for (let i = 0; i < items.length; i += 100) {
          const batch = items.slice(i, i + 100);
          const ok = await upsertBatch(batch);
          if (ok) {
            results.checklists[line].inserted += batch.length;
            results.total_inserted += batch.length;
          }
        }
      }
    } catch (err) {
      results.errors.push({ line: 'eBay', error: err.message });
    }
    results.total_pages = TOTAL_PAGES;
    results.next_page = null;
    results.ran_at = new Date().toISOString();
    return results;
  }

  // Páginas normales (scraping funkypriceguide)
  const start = page * PAGE_SIZE;
  const checklists = FUNKO_CHECKLISTS.slice(start, start + PAGE_SIZE);
  const seenSlugs = new Set();

  for (const { type, line, url: checklistUrl } of checklists) {
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
    } catch (err) {
      results.errors.push({ line, error: err.message });
    }
  }

  results.total_pages = TOTAL_PAGES;
  results.next_page = page + 1 < TOTAL_PAGES ? page + 1 : null;
  results.ran_at = new Date().toISOString();
  return results;
}

// ── Handler principal ─────────────────────────────────────────

export async function handleFunkoSync(request) {
  if (request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders() });
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
    const page = parseInt(url.searchParams.get('page') || '0');
    const results = await syncPage(page);
    return jsonResponse({ ok: true, ...results });
  }

  // Desde cron: ejecuta todas las páginas secuencialmente
  const allResults = [];
  for (let p = 0; p < TOTAL_PAGES; p++) {
    const r = await syncPage(p);
    allResults.push(r);
  }
  return allResults;
}