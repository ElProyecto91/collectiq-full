// ── DB TOKEN: short-lived JWT so Supabase RLS can tell who is calling ─────────────
// The app's real identity is its own session token (user_sessions). Supabase cannot read that, so the
// Worker exchanges it for an HS256 JWT signed with the project's JWT secret (Worker secret
// SUPABASE_JWT_SECRET) carrying telegram_user_id. RLS policies read it via public.jwt_telegram_user_id().
// Without the secret this answers 503 and the client simply keeps using the anon key (nothing breaks).
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sessionUserId } from '../lib/session.js';

var SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
var TTL_SECONDS = 3600;

function b64url(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj) { return b64url(new TextEncoder().encode(JSON.stringify(obj))); }

export async function signJwt(claims, secret) {
  var head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  var payload = b64urlJson(claims);
  var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(head + '.' + payload));
  return head + '.' + payload + '.' + b64url(new Uint8Array(sig));
}

export async function handleAuthToken(request) {
  var userId = await sessionUserId(request);
  if (!userId) return jsonResponse({ error: 'unauthorized' }, 401);
  var secret = getEnv('SUPABASE_JWT_SECRET');
  if (!secret) return jsonResponse({ error: 'not_configured' }, 503);

  var now = Math.floor(Date.now() / 1000);
  var exp = now + TTL_SECONDS;
  var token = await signJwt({
    iss: 'collectiq-worker', aud: 'authenticated', role: 'authenticated',
    sub: String(userId), telegram_user_id: Number(userId), iat: now, exp: exp,
  }, secret);

  // ?check=1: ask the database what it sees, to prove the secret is the right one before RLS is closed.
  if (new URL(request.url).searchParams.get('check') === '1') {
    try {
      // apikey only has to be a valid project key; the ROLE comes from the Authorization JWT
      var apikey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
      var r = await fetch(SUPABASE_URL + '/rest/v1/rpc/jwt_telegram_user_id', {
        method: 'POST',
        headers: { 'apikey': apikey || '', 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: '{}',
      });
      var text = await r.text();
      var seen = null; try { seen = JSON.parse(text); } catch (e) { seen = text; }
      return jsonResponse({ ok: r.ok && String(seen) === String(userId), http: r.status, expected: Number(userId), seen: seen });
    } catch (e) { return jsonResponse({ ok: false, error: 'unreachable' }, 502); }
  }
  return jsonResponse({ token: token, expires_at: exp });
}
