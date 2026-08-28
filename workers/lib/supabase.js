// ── Supabase helpers ──────────────────────────────────────────
import { getEnv } from './cors.js';

var SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';

export function sbHeaders() {
  var key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
  };
}

export async function sbGet(table, query) {
  var r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, { headers: sbHeaders() });
  return r.json();
}

export async function sbPost(table, body, prefer) {
  var h = sbHeaders();
  if (prefer) h['Prefer'] = prefer;
  return fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: h, body: JSON.stringify(body),
  });
}

export async function sbPatch(table, query, body) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body),
  });
}

export async function sbFetch(path, options) {
  if (!options) options = {};
  var h = sbHeaders();
  if (options.prefer) h['Prefer'] = options.prefer;
  if (options.headers) Object.assign(h, options.headers);
  var res = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: options.method || 'GET',
    headers: h,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  var text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch(e) { return { ok: res.ok, status: res.status, data: text }; }
}