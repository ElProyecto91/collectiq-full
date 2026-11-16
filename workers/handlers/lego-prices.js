// ── LEGO PRICES: BrickLink price guide in euros, cached in Supabase ──────────────
// The app asks for a few items at a time (route lego-prices). Fresh rows come from the cache table
// lego_prices; missing or stale ones are fetched from BrickLink (average SOLD price, new and used; when nothing
// sold in the last 6 months, the average of the current offers) and saved. Needs the Worker secrets
// BRICKLINK_CONSUMER_KEY, BRICKLINK_CONSUMER_SECRET, BRICKLINK_TOKEN, BRICKLINK_TOKEN_SECRET.
// See supabase/migrations/20261116090000_lego_prices.sql
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbFetch } from '../lib/supabase.js';
import { sessionUserId } from '../lib/session.js';
import { oauth1Header } from '../lib/oauth1.js';
import { ADMIN_ID } from '../lib/telegram.js';

var BL = 'https://api.bricklink.com/api/store/v1';
var MAX_ITEMS = 6;                 // 2-3 BrickLink calls per item + a few Supabase calls stay under 50 subrequests
var FRESH_MS = 30 * 24 * 3600 * 1000;
var RETRY_ERROR_MS = 3600 * 1000;
var NUM_RE = /^[A-Za-z0-9.\-]{1,30}$/;

function creds() {
  var c = { key: getEnv('BRICKLINK_CONSUMER_KEY'), secret: getEnv('BRICKLINK_CONSUMER_SECRET'), token: getEnv('BRICKLINK_TOKEN'), tokenSecret: getEnv('BRICKLINK_TOKEN_SECRET') };
  return c.key && c.secret && c.token && c.tokenSecret ? c : null;
}

// One signed GET. Returns { code, message, data } where code is BrickLink's own status (meta.code), never throws.
export async function blGet(path, query, c) {
  var url = BL + path;
  var qs = Object.keys(query || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&');
  var auth = await oauth1Header('GET', url, query || {}, c);
  var res;
  try {
    res = await fetch(url + (qs ? '?' + qs : ''), { headers: { Authorization: auth, Accept: 'application/json' } });
  } catch (e) { return { code: 0, message: 'unreachable', data: null }; }
  var body = null;
  try { body = await res.json(); } catch (e) { /* not JSON */ }
  var meta = body && body.meta ? body.meta : null;
  var code = meta && typeof meta.code === 'number' ? meta.code : res.status;
  return { code: code, message: meta ? (meta.message || meta.description || '') : '', data: body ? body.data : null };
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// Rebrickable color -> BrickLink color id: same name first, then the same RGB when it is unique.
export function matchBlColor(blColors, name, rgb) {
  var n = norm(name);
  var byName = blColors.filter(function (c) { return norm(c.name) === n; });
  if (byName.length === 1) return byName[0].bl_id;
  if (byName.length > 1) return byName[0].bl_id;
  var hex = String(rgb || '').replace('#', '').toLowerCase();
  if (hex) {
    var byRgb = blColors.filter(function (c) { return String(c.rgb || '').replace('#', '').toLowerCase() === hex; });
    if (byRgb.length === 1) return byRgb[0].bl_id;
  }
  return null;
}

function num(v) { var x = parseFloat(v); return isFinite(x) ? x : null; }

// average sold price (last 6 months); if nothing sold, average of the current offers
async function guide(path, base, newOrUsed, c) {
  var q = Object.assign({}, base, { guide_type: 'sold', new_or_used: newOrUsed, currency_code: 'EUR' });
  var r = await blGet(path, q, c);
  if (r.code !== 200) return { code: r.code, message: r.message };
  var d = r.data || {};
  var qty = parseInt(d.total_quantity, 10) || 0;
  var avg = num(d.avg_price);
  if (qty > 0 && avg !== null && avg > 0) return { code: 200, avg: avg, qty: qty, basis: 'sold' };
  q.guide_type = 'stock';
  var s = await blGet(path, q, c);
  if (s.code !== 200) return { code: s.code, message: s.message };
  var sd = s.data || {};
  var sq = parseInt(sd.total_quantity, 10) || 0;
  var sa = num(sd.avg_price);
  if (sq > 0 && sa !== null && sa > 0) return { code: 200, avg: sa, qty: sq, basis: 'stock' };
  return { code: 200, avg: null, qty: 0, basis: null };
}

async function loadBlColors(c) {
  var have = await sbFetch('/lego_bl_colors?select=bl_id,name,rgb,color_type&limit=2000');
  if (have.ok && Array.isArray(have.data) && have.data.length) return { colors: have.data };
  var r = await blGet('/colors', {}, c);
  if (r.code !== 200 || !Array.isArray(r.data)) return { error: r };
  var rows = r.data.map(function (x) { return { bl_id: x.color_id, name: x.color_name, rgb: x.color_code || null, color_type: x.color_type || null }; });
  await sbFetch('/lego_bl_colors?on_conflict=bl_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: rows });
  return { colors: rows };
}

function isStale(row) {
  var age = Date.now() - new Date(row.fetched_at).getTime();
  return row.status === 'error' ? age > RETRY_ERROR_MS : age > FRESH_MS;
}

function keyOf(kind, num, color) { return kind + '|' + num + '|' + color; }

// one item -> { row } | { stop: 'rate_limited' | 'bricklink_auth', message }
async function fetchItem(item, blColors, c) {
  var base = { kind: item.kind, item_num: item.num, color_id: item.kind === 'set' ? -1 : item.color_id, currency: 'EUR', fetched_at: new Date().toISOString() };
  var blItem = item.bl_num || item.num;
  var path, params = {}, blColor = null;
  if (item.kind === 'set') {
    path = '/items/set/' + encodeURIComponent(blItem) + '/price';
  } else {
    blColor = matchBlColor(blColors, item.color_name, item.color_rgb);
    if (blColor === null) return { row: Object.assign(base, { status: 'not_found', bl_item: blItem, bl_color: null }) };
    path = '/items/part/' + encodeURIComponent(blItem) + '/price';
    params = { color_id: String(blColor) };
  }
  var both = await Promise.all([guide(path, params, 'N', c), guide(path, params, 'U', c)]);
  for (var i = 0; i < both.length; i++) {
    var code = both[i].code;
    if (code === 429) return { stop: 'rate_limited', message: both[i].message };
    if (code === 401 || code === 403) return { stop: 'bricklink_auth', message: both[i].message };
  }
  var nf = both[0].code === 404 && both[1].code === 404;
  var bad = both.some(function (g) { return g.code !== 200 && g.code !== 404; });
  var N = both[0].code === 200 ? both[0] : {}, U = both[1].code === 200 ? both[1] : {};
  var status = bad ? 'error' : (nf || (N.avg == null && U.avg == null) ? 'not_found' : 'ok');
  return { row: Object.assign(base, {
    status: status, bl_item: blItem, bl_color: blColor,
    new_avg: N.avg == null ? null : N.avg, new_qty: N.avg == null ? null : N.qty, new_basis: N.avg == null ? null : N.basis,
    used_avg: U.avg == null ? null : U.avg, used_qty: U.avg == null ? null : U.qty, used_basis: U.avg == null ? null : U.basis,
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

export async function handleLegoPrices(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  var uid = await sessionUserId(request);
  if (!uid) return jsonResponse({ error: 'unauthorized' }, 401);
  var c = creds();
  if (!c) return jsonResponse({ error: 'not_configured' }, 503);

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
    var blColors = [];
    if (todo.some(function (i) { return i.kind === 'part'; })) {
      var loaded = await loadBlColors(c);
      if (loaded.error) {
        var ec = loaded.error.code;
        return jsonResponse({ error: ec === 401 || ec === 403 ? 'bricklink_auth' : ec === 429 ? 'rate_limited' : 'bricklink_error', code: ec, message: loaded.error.message }, ec === 429 ? 429 : 502);
      }
      blColors = loaded.colors;
    }
    var results = await Promise.all(todo.map(function (i) { return fetchItem(i, blColors, c); }));
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
  if (stop && !prices.length) return jsonResponse({ error: stop.error, message: stop.message }, stop.error === 'rate_limited' ? 429 : 502);
  return jsonResponse({ prices: prices, fetched: fetched, stopped: stop ? stop.error : null });
}

// Admin only: one cheap call to prove the credentials work (and which error BrickLink gives if not).
export async function handleLegoPricesCheck(request) {
  var uid = await sessionUserId(request);
  if (!uid || Number(uid) !== Number(ADMIN_ID)) return jsonResponse({ error: 'unauthorized' }, 401);
  var c = creds();
  if (!c) return jsonResponse({ ok: false, error: 'not_configured', missing: ['BRICKLINK_CONSUMER_KEY', 'BRICKLINK_CONSUMER_SECRET', 'BRICKLINK_TOKEN', 'BRICKLINK_TOKEN_SECRET'].filter(function (n) { return !getEnv(n); }) });
  var r = await blGet('/items/part/3001/price', { color_id: '11', guide_type: 'sold', new_or_used: 'U', currency_code: 'EUR' }, c);
  var hint = r.code === 200 ? null : r.code === 401 || r.code === 403 ? 'Credenciales o IP no válidas: el token de BrickLink está ligado a una IP; regístralo como 0.0.0.0 (cualquier IP).' : r.code === 429 ? 'Límite diario de BrickLink alcanzado.' : 'Respuesta inesperada de BrickLink.';
  return jsonResponse({ ok: r.code === 200, code: r.code, message: r.message, sample: r.code === 200 && r.data ? { avg_price_eur: r.data.avg_price, total_quantity: r.data.total_quantity } : null, hint: hint });
}
