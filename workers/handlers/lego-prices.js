// ── LEGO PRICES: Brick Owl price history in euros, cached in Supabase ─────────────
// The app asks for a few items at a time (route lego-prices). Fresh rows come from the cache table lego_prices;
// missing or stale ones are fetched from Brick Owl:
//   1. catalog/id_lookup  -> the part's BOIDs ("771344-38" = part 771344 in Brick Owl colour 38; one call lists every colour)
//   2. catalog/color_list -> Brick Owl colours with their BrickLink names/ids, matched to the Rebrickable colour by name
//   3. catalog/price_history(boid) -> average sale prices in GBP (6 months, 2 years, current offers) -> converted to EUR
// Needs the Worker secret BRICKOWL_API_KEY. Terms: unique User-Agent; prices are attributed to Brick Owl in the app.
// Rows reuse the columns of lego_prices: bl_item holds the BOID, bl_color the Brick Owl colour id.
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbFetch } from '../lib/supabase.js';
import { sessionUserId } from '../lib/session.js';
import { ADMIN_ID } from '../lib/telegram.js';

var BO = 'https://api.brickowl.com/v1/';
var USER_AGENT = 'CollectIQ-personal-collection-tool/1.0';
var ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
var FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=GBP&to=EUR';
var MAX_ITEMS = 6;                 // ~3 Brick Owl calls per item + a few Supabase calls stay under 50 subrequests
var FRESH_MS = 30 * 24 * 3600 * 1000;
var RETRY_ERROR_MS = 3600 * 1000;
var CACHE_MS = 12 * 3600 * 1000;
var NUM_RE = /^[A-Za-z0-9.\-]{1,30}$/;

function apiKey() { return getEnv('BRICKOWL_API_KEY') || null; }

// One GET. Returns { code, message, data }: code is the HTTP status; never throws.
export async function boGet(path, params, key) {
  var q = new URLSearchParams();
  Object.keys(params || {}).forEach(function (k) { q.set(k, params[k]); });
  q.set('key', key);
  var res;
  try {
    res = await fetch(BO + path + '?' + q.toString(), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  } catch (e) { return { code: 0, message: 'unreachable', data: null }; }
  var body = null;
  try { body = await res.json(); } catch (e) { /* not JSON */ }
  var msg = body && typeof body.error === 'string' ? body.error : (body && body.message ? String(body.message) : '');
  return { code: res.status, message: msg, data: body };
}

// what a failed call means for the whole batch
function fatal(r) {
  if (r.code === 429 || /quota|rate.?limit|too many/i.test(r.message || '')) return 'rate_limited';
  if (r.code === 401 || r.code === 403) return 'brickowl_auth';
  return null;
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// ── Brick Owl colours <-> Rebrickable colours ──────────────────────────────────
var colorCache = { list: null, at: 0 };

// tests only: forget what this isolate has cached
export function _resetCaches() { colorCache = { list: null, at: 0 }; fx = { rate: null, at: 0 }; }

async function loadColors(key) {
  if (colorCache.list && Date.now() - colorCache.at < CACHE_MS) return { colors: colorCache.list };
  var r = await boGet('catalog/color_list', {}, key);
  if (r.code !== 200 || !r.data || typeof r.data !== 'object') return { error: r };
  var list = Object.keys(r.data).map(function (k) { return r.data[k]; }).filter(function (c) { return c && c.id != null; });
  colorCache = { list: list, at: Date.now() };
  return { colors: list };
}

// Candidate Brick Owl colour ids for a Rebrickable colour, best first: same BrickLink name, same Brick Owl name,
// then the same hex when it is unambiguous. Rebrickable names follow BrickLink's, hence the first rule.
export function matchBoColors(colors, name, hex) {
  var n = norm(name), out = [];
  function add(id) { id = String(id); if (out.indexOf(id) < 0) out.push(id); }
  if (n) {
    colors.forEach(function (c) { if ((c.bl_names || []).some(function (b) { return norm(b) === n; })) add(c.id); });
    colors.forEach(function (c) { if (norm(c.name) === n) add(c.id); });
  }
  var h = String(hex || '').replace('#', '').toLowerCase();
  if (h && !out.length) {
    var same = colors.filter(function (c) { return String(c.hex || '').replace('#', '').toLowerCase() === h; });
    if (same.length === 1) add(same[0].id);
  }
  return out;
}

// ── GBP -> EUR ─────────────────────────────────────────────────────────────────
var fx = { rate: null, at: 0 };

async function eurPerGbp() {
  if (fx.rate && Date.now() - fx.at < CACHE_MS) return fx.rate;
  var rate = null;
  try {
    var res = await fetch(ECB_URL);
    if (res.ok) {
      var m = /currency=['"]GBP['"]\s+rate=['"]([0-9.]+)['"]/.exec(await res.text());
      if (m) rate = 1 / parseFloat(m[1]);        // ECB publishes how many GBP one EUR buys
    }
  } catch (e) { /* try the fallback */ }
  if (!rate) {
    try {
      var r2 = await fetch(FRANKFURTER_URL);
      if (r2.ok) { var j = await r2.json(); if (j && j.rates && j.rates.EUR) rate = Number(j.rates.EUR); }
    } catch (e) { /* no rate */ }
  }
  if (!rate || !isFinite(rate) || rate < 0.5 || rate > 2) return null;   // implausible: better no price than a wrong one
  fx = { rate: rate, at: Date.now() };
  return rate;
}

// ── price_history -> one price per condition ──────────────────────────────────
function positive(d, k) { var x = parseFloat(d && d[k]); return isFinite(x) && x > 0 ? x : null; }

// Average SALE price of the last 6 months; if nothing sold, of the last 2 years; if still nothing, the average of
// the CURRENT offers (flagged 'stock'). Prices are GBP here.
export function pickPrices(d) {
  var nw = positive(d, '6months_average_new'), us = positive(d, '6months_average_used'), basis = 'sold';
  if (nw == null && us == null) { nw = positive(d, '2year_average_new'); us = positive(d, '2year_average_used'); }
  if (nw == null && us == null) { nw = positive(d, 'current_average_new'); us = positive(d, 'current_average_used'); basis = 'stock'; }
  return { nw: nw, us: us, basis: basis };
}

// ── cache ──────────────────────────────────────────────────────────────────────
function isStale(row) {
  var age = Date.now() - new Date(row.fetched_at).getTime();
  return row.status === 'error' ? age > RETRY_ERROR_MS : age > FRESH_MS;
}
function keyOf(kind, num, color) { return kind + '|' + num + '|' + color; }

function boidsOf(r) { return r.code === 200 && r.data && Array.isArray(r.data.boids) ? r.data.boids.map(String) : []; }

// BOIDs of a part (all its colours) or of a set. Tries the Rebrickable number as LEGO design id, then as BrickLink id.
async function lookup(item, ctx) {
  var ck = item.kind + '|' + item.num + '|' + (item.bl_num || '');
  if (ctx.lookups[ck]) return ctx.lookups[ck];
  ctx.lookups[ck] = (async function () {
    if (item.kind === 'set') {
      var s = await boGet('catalog/id_lookup', { id: item.num, type: 'Set', id_type: 'set_number' }, ctx.key);
      return { boids: boidsOf(s), res: s };
    }
    var a = await boGet('catalog/id_lookup', { id: item.num, type: 'Part', id_type: 'design_id' }, ctx.key);
    if (boidsOf(a).length || fatal(a)) return { boids: boidsOf(a), res: a };
    var blId = item.bl_num || item.num;
    var b = await boGet('catalog/id_lookup', { id: blId, type: 'Part', id_type: 'bl_item_no' }, ctx.key);
    return { boids: boidsOf(b), res: b };
  })();
  return ctx.lookups[ck];
}

async function fetchItem(item, ctx) {
  var base = { kind: item.kind, item_num: item.num, color_id: item.kind === 'set' ? -1 : item.color_id, currency: 'EUR', fetched_at: new Date().toISOString() };
  var notFound = function (boid, color) { return { row: Object.assign(base, { status: 'not_found', bl_item: boid || null, bl_color: color == null ? null : Number(color) }) }; };

  var found = await lookup(item, ctx);
  var f = fatal(found.res);
  if (f) return { stop: f, message: found.res.message };
  if (!found.boids.length) return notFound(null, null);

  var boid = null, color = null;
  if (item.kind === 'set') {
    boid = found.boids[0];
  } else {
    var root = found.boids[0].split('-')[0];
    var cands = matchBoColors(ctx.colors, item.color_name, item.color_rgb);
    for (var i = 0; i < cands.length; i++) {
      if (found.boids.indexOf(root + '-' + cands[i]) >= 0) { color = cands[i]; boid = root + '-' + cands[i]; break; }
    }
    if (!boid) return notFound(root, null);       // Brick Owl does not sell this part in that colour
  }

  var ph = await boGet('catalog/price_history', { boid: boid }, ctx.key);
  var pf = fatal(ph);
  if (pf) return { stop: pf, message: ph.message };
  if (ph.code === 404 || ph.code === 400) return notFound(boid, color);
  if (ph.code !== 200 || !ph.data) return { row: Object.assign(base, { status: 'error', bl_item: boid, bl_color: color == null ? null : Number(color) }) };

  var p = pickPrices(ph.data);
  if (p.nw == null && p.us == null) return notFound(boid, color);
  var eur = function (x) { return x == null ? null : Math.round(x * ctx.rate * 10000) / 10000; };
  return { row: Object.assign(base, {
    status: 'ok', bl_item: boid, bl_color: color == null ? null : Number(color),
    new_avg: eur(p.nw), new_qty: null, new_basis: p.nw == null ? null : p.basis,
    used_avg: eur(p.us), used_qty: null, used_basis: p.us == null ? null : p.basis,
  }) };
}

function validItems(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_ITEMS) return null;
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    if ((it.kind !== 'part' && it.kind !== 'set') || !NUM_RE.test(String(it.num || ''))) return null;
    if (it.bl_num != null && !NUM_RE.test(String(it.bl_num))) return null;
    if (it.kind === 'part' && !Number.isInteger(it.color_id)) return null;
    out.push({ kind: it.kind, num: String(it.num), color_id: it.kind === 'set' ? -1 : it.color_id, color_name: String(it.color_name || '').slice(0, 80), color_rgb: String(it.color_rgb || '').slice(0, 8), bl_num: it.bl_num ? String(it.bl_num) : null });
  }
  return out;
}

function failure(code, message) {
  return jsonResponse({ error: code, message: message || '' }, code === 'rate_limited' ? 429 : 502);
}

export async function handleLegoPrices(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  var uid = await sessionUserId(request);
  if (!uid) return jsonResponse({ error: 'unauthorized' }, 401);
  var key = apiKey();
  if (!key) return jsonResponse({ error: 'not_configured' }, 503);

  var body = {};
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'bad_json' }, 400); }
  var items = validItems(body && body.items);
  if (!items) return jsonResponse({ error: 'bad_items' }, 400);

  // cache
  var cached = {};
  var kinds = ['part', 'set'];
  for (var k = 0; k < kinds.length; k++) {
    var nums = items.filter(function (i) { return i.kind === kinds[k]; }).map(function (i) { return i.num; });
    if (!nums.length) continue;
    var r = await sbFetch('/lego_prices?kind=eq.' + kinds[k] + '&item_num=in.(' + nums.map(function (n) { return '"' + n + '"'; }).join(',') + ')&select=*');
    if (r.ok && Array.isArray(r.data)) r.data.forEach(function (row) { cached[keyOf(row.kind, row.item_num, row.color_id)] = row; });
  }
  var todo = items.filter(function (i) { var row = cached[keyOf(i.kind, i.num, i.color_id)]; return !row || isStale(row); });

  var stop = null, fetched = 0;
  if (todo.length) {
    var rate = await eurPerGbp();
    if (!rate) return failure('fx_unavailable', 'exchange rate');
    var colors = [];
    if (todo.some(function (i) { return i.kind === 'part'; })) {
      var loaded = await loadColors(key);
      if (loaded.error) return failure(fatal(loaded.error) || 'brickowl_error', loaded.error.message);
      colors = loaded.colors;
    }
    var ctx = { key: key, rate: rate, colors: colors, lookups: {} };
    var results = await Promise.all(todo.map(function (i) { return fetchItem(i, ctx); }));
    var rows = [];
    results.forEach(function (res) {
      if (res.stop) { stop = stop || { error: res.stop, message: res.message }; return; }
      rows.push(res.row);
      cached[keyOf(res.row.kind, res.row.item_num, res.row.color_id)] = res.row;
    });
    if (rows.length) {
      await sbFetch('/lego_prices?on_conflict=kind,item_num,color_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: rows });
      fetched = rows.length;
    }
  }
  var prices = items.map(function (i) { return cached[keyOf(i.kind, i.num, i.color_id)]; }).filter(Boolean);
  if (stop && !prices.length) return failure(stop.error, stop.message);
  return jsonResponse({ prices: prices, fetched: fetched, stopped: stop ? stop.error : null });
}

// Admin only: one real price lookup (part 3001 in black) to prove the key, the colour match and the exchange rate work.
export async function handleLegoPricesCheck(request) {
  var uid = await sessionUserId(request);
  if (!uid || Number(uid) !== Number(ADMIN_ID)) return jsonResponse({ error: 'unauthorized' }, 401);
  var key = apiKey();
  if (!key) return jsonResponse({ ok: false, error: 'not_configured', missing: ['BRICKOWL_API_KEY'] });

  var rate = await eurPerGbp();
  var loaded = await loadColors(key);
  if (loaded.error) return jsonResponse({ ok: false, step: 'color_list', code: loaded.error.code, message: loaded.error.message, hint: loaded.error.code === 401 || loaded.error.code === 403 ? 'La clave de Brick Owl no tiene permiso de catálogo o está mal copiada.' : null });
  var ctx = { key: key, rate: rate || 0, colors: loaded.colors, lookups: {} };
  var item = { kind: 'part', num: '3001', color_id: 0, color_name: 'Black', color_rgb: '05131D', bl_num: null };
  var found = await lookup(item, ctx);
  if (!found.boids.length) return jsonResponse({ ok: false, step: 'id_lookup', code: found.res.code, message: found.res.message });
  var out = await fetchItem(item, ctx);
  if (out.stop) return jsonResponse({ ok: false, step: 'price_history', error: out.stop, message: out.message });
  var row = out.row;
  return jsonResponse({
    ok: row.status === 'ok' && !!rate, step: 'done', status: row.status, boid: row.bl_item, rate_eur_per_gbp: rate,
    sample: row.status === 'ok' ? { used_eur: row.used_avg, new_eur: row.new_avg } : null,
    hint: rate ? null : 'No se pudo obtener el tipo de cambio GBP→EUR.',
  });
}
