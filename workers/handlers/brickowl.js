// ── BRICK OWL probe (admin only) ───────────────────────────────────────────────
// Brick Owl's docs do not show response bodies, so before building the price feature the admin can run a few
// read-only catalog calls and see the RAW answer. The key (Worker secret BRICKOWL_API_KEY) is added here and never
// returned. Terms: every request carries a User-Agent unique to this tool.
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sessionUserId } from '../lib/session.js';
import { ADMIN_ID } from '../lib/telegram.js';

var BASE = 'https://api.brickowl.com/v1/';
var USER_AGENT = 'CollectIQ-personal-collection-tool/1.0';
var ENDPOINTS = ['catalog/id_lookup', 'catalog/price_history', 'catalog/availability', 'catalog/lookup'];
var PARAMS = ['id', 'type', 'id_type', 'boid', 'country', 'condition'];
var MAX_BODY = 6000;

export async function handleBrickOwlProbe(request) {
  var uid = await sessionUserId(request);
  if (!uid || Number(uid) !== Number(ADMIN_ID)) return jsonResponse({ error: 'unauthorized' }, 401);
  var key = getEnv('BRICKOWL_API_KEY');
  if (!key) return jsonResponse({ ok: false, error: 'not_configured' });

  var url = new URL(request.url);
  var endpoint = url.searchParams.get('endpoint') || '';
  if (ENDPOINTS.indexOf(endpoint) < 0) return jsonResponse({ error: 'bad_endpoint', allowed: ENDPOINTS }, 400);

  var q = new URLSearchParams();
  PARAMS.forEach(function (p) {
    var v = url.searchParams.get(p);
    if (v !== null && v !== '' && v.length <= 60) q.set(p, v);
  });
  q.set('key', key);

  var started = Date.now();
  var res;
  try {
    res = await fetch(BASE + endpoint + '?' + q.toString(), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  } catch (e) { return jsonResponse({ ok: false, error: 'unreachable' }, 502); }
  var text = '';
  try { text = await res.text(); } catch (e) { /* empty */ }
  // never hand the key back, even if an error page echoes the request
  text = text.split(key).join('[key]');
  return jsonResponse({
    ok: res.ok, status: res.status, ms: Date.now() - started, truncated: text.length > MAX_BODY,
    body: text.slice(0, MAX_BODY),
  });
}
