// ── LEGO part scanner ─────────────────────────────────────────
// POST /lego-scan  (multipart: image)  Authorization: Bearer <app session token>
// Forwards the photo to Brickognize and returns up to 5 candidate parts. The app asks the
// user to confirm one, choose a color and a quantity; nothing is saved here except a scan
// counter row (lego_scans) used for "scans today" and a safety cap.
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbGet, sbPost } from '../lib/supabase.js';

var BRICKOGNIZE = 'https://api.brickognize.com';
// "/predict/parts/" is tried first; "/predict/" is the general endpoint (parts, sets, minifigs).
// Neither path nor response shape could be verified against the official docs when this was
// written, so both are handled defensively and the real shape is reported on mismatch.
var PREDICT_PATHS = ['/predict/parts/', '/predict/'];
var MAX_IMAGE_BYTES = 3 * 1024 * 1024;
var MAX_CANDIDATES = 5;
var TIMEOUT_MS = 20000;
var DEFAULT_DAILY_LIMIT = 300;

function startOfTodayUtc() {
  var d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

// Rebrickable part number from the external links Brickognize returns, when it gives one.
function rebrickableNum(item) {
  var sites = item && item.external_sites;
  if (!Array.isArray(sites)) return null;
  for (var i = 0; i < sites.length; i++) {
    var url = sites[i] && (sites[i].url || sites[i].link);
    var m = typeof url === 'string' && url.match(/rebrickable\.com\/parts\/([^\/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

export function normalizeCandidates(body) {
  var items = body && (body.items || body.results);
  if (!Array.isArray(items)) return null;
  var out = [];
  for (var i = 0; i < items.length && out.length < MAX_CANDIDATES; i++) {
    var it = items[i] || {};
    if (it.id === undefined || it.id === null) continue;
    if (it.type && String(it.type).toLowerCase() !== 'part') continue; // skip sets / minifigs
    var score = it.score !== undefined ? it.score : it.confidence;
    out.push({
      id: String(it.id),
      name: it.name ? String(it.name) : '',
      img_url: it.img_url || it.image_url || null,
      score: typeof score === 'number' ? score : (score !== undefined && score !== null && !isNaN(Number(score)) ? Number(score) : null),
      rb_part_num: rebrickableNum(it),
    });
  }
  return out;
}

async function callBrickognize(file) {
  var last = null;
  for (var i = 0; i < PREDICT_PATHS.length; i++) {
    var form = new FormData();
    form.append('query_image', file, 'scan.jpg');
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(BRICKOGNIZE + PREDICT_PATHS[i], { method: 'POST', body: form, headers: { 'accept': 'application/json' }, signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    if (res.status === 404 || res.status === 405) { last = res; continue; } // wrong path: try the next one
    return res;
  }
  return last;
}

export async function handleLegoScan(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  // 1) who is it: the same session token the app already uses
  var auth = request.headers.get('Authorization') || '';
  var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401);
  var sessions = await sbGet('user_sessions', 'token=eq.' + encodeURIComponent(token) + '&select=telegram_user_id,expires_at&limit=1');
  var session = Array.isArray(sessions) ? sessions[0] : null;
  if (!session) return jsonResponse({ error: 'unauthorized' }, 401);
  if (session.expires_at && new Date(session.expires_at) < new Date()) return jsonResponse({ error: 'session_expired' }, 401);
  var uid = session.telegram_user_id;

  // 2) the photo
  var file;
  try {
    var form = await request.formData();
    file = form.get('image');
  } catch (e) { return jsonResponse({ error: 'bad_request' }, 400); }
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return jsonResponse({ error: 'image_required' }, 400);
  if (!/^image\//.test(file.type || '')) return jsonResponse({ error: 'not_an_image' }, 400);
  if (file.size > MAX_IMAGE_BYTES) return jsonResponse({ error: 'image_too_large', max_bytes: MAX_IMAGE_BYTES }, 413);

  // 3) safety cap per day (a runaway loop must not hammer Brickognize)
  var limit = parseInt(getEnv('LEGO_SCAN_DAILY_LIMIT'), 10) || DEFAULT_DAILY_LIMIT;
  var today = await sbGet('lego_scans', 'select=id&telegram_user_id=eq.' + uid + '&scanned_at=gte.' + encodeURIComponent(startOfTodayUtc()) + '&limit=' + limit);
  var usedToday = Array.isArray(today) ? today.length : 0;
  if (usedToday >= limit) return jsonResponse({ error: 'daily_limit', limit: limit, scans_today: usedToday }, 429);

  // 4) recognize
  var res;
  try { res = await callBrickognize(file); }
  catch (e) { return jsonResponse({ error: 'brickognize_unreachable' }, 502); }
  if (!res || res.status === 429) return jsonResponse({ error: 'brickognize_rate_limited' }, 429);
  if (!res.ok) return jsonResponse({ error: 'brickognize_error', status: res.status }, 502);
  var body;
  try { body = await res.json(); } catch (e) { return jsonResponse({ error: 'unexpected_response', detail: 'not json' }, 502); }
  var candidates = normalizeCandidates(body);
  if (candidates === null) {
    // report the real shape so the parser can be fixed without guessing
    return jsonResponse({ error: 'unexpected_response', keys: body && typeof body === 'object' ? Object.keys(body).slice(0, 20) : typeof body }, 502);
  }

  // 5) count it (best effort: a logging failure must not lose the result)
  try {
    await sbPost('lego_scans', {
      telegram_user_id: uid, candidates: candidates.length,
      top_part: candidates[0] ? candidates[0].id : null, top_score: candidates[0] ? candidates[0].score : null, ok: true,
    }, 'return=minimal');
  } catch (e) { /* ignore */ }

  return jsonResponse({ candidates: candidates, scans_today: usedToday + 1, limit: limit });
}
