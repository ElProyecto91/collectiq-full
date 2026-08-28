// ── FUNKO handlers ────────────────────────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbHeaders } from '../lib/supabase.js';
import { searchEbayPrices } from '../lib/ebay.js';

var SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
var ADMIN_ID = 1299079722;

export async function handleFunkoImport(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var offset = body.offset || 0;
    var limit = body.limit || 500;
    if (body.adminId !== ADMIN_ID) return jsonResponse({ error: 'Unauthorized' }, 401);
    var dataRes = await fetch('https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json');
    var allData = await dataRes.json();
    var batch = allData.slice(offset, offset + limit);
    var records = batch.map(function(item) {
      return { name: item.title || 'Unknown', franchise: (item.series || [])[0] || null, series: (item.series || []).join(', ') || null, image_url: item.imageName || null, type: 'pop' };
    });
    var h = sbHeaders();
    h['Prefer'] = 'resolution=ignore-duplicates';
    var res = await fetch(SUPABASE_URL + '/rest/v1/funko_items', { method: 'POST', headers: h, body: JSON.stringify(records) });
    if (!res.ok) return jsonResponse({ error: await res.text() }, 500);
    return jsonResponse({ ok: true, imported: records.length, total: allData.length, nextOffset: offset + limit, done: offset + limit >= allData.length });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

export async function handleFunkoPrice(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  var name = new URL(request.url).searchParams.get('name');
  if (!name) return jsonResponse({ error: 'name required' }, 400);
  try {
    var result = await searchEbayPrices(name + ' funko pop', 'EBAY_ES', 500);
    if (!result) return jsonResponse({ price: null, confidence: 'low', count: 0 });
    return jsonResponse(result);
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}