// ── OAuth 1.0a (HMAC-SHA1) for the BrickLink API ───────────────────────────────
// BrickLink signs every request with consumer key/secret + token/token secret (no callback, no user flow).
// Implements RFC 5849 section 3.4: percent-encoding, sorted parameters, signature base string.

export function pctEncode(s) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
}

function b64(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function hmacSha1Base64(key, message) {
  var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  var sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message));
  return b64(new Uint8Array(sig));
}

// params: every query/body parameter of the request (not the oauth_* ones); creds: { key, secret, token, tokenSecret }
// extra: optional { nonce, timestamp } so tests can pin them.
export async function oauth1Signature(method, baseUrl, params, creds, oauth) {
  var all = [];
  Object.keys(params || {}).forEach(function (k) { all.push([pctEncode(k), pctEncode(params[k])]); });
  Object.keys(oauth).forEach(function (k) { if (k !== 'oauth_signature') all.push([pctEncode(k), pctEncode(oauth[k])]); });
  all.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); });
  var paramString = all.map(function (p) { return p[0] + '=' + p[1]; }).join('&');
  var base = method.toUpperCase() + '&' + pctEncode(baseUrl) + '&' + pctEncode(paramString);
  var key = pctEncode(creds.secret) + '&' + pctEncode(creds.tokenSecret || '');
  return hmacSha1Base64(key, base);
}

function nonce() {
  var bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

// The Authorization header for one request.
export async function oauth1Header(method, baseUrl, params, creds, fixed) {
  var oauth = {
    oauth_consumer_key: creds.key,
    oauth_nonce: (fixed && fixed.nonce) || nonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String((fixed && fixed.timestamp) || Math.floor(Date.now() / 1000)),
    oauth_token: creds.token,
    oauth_version: '1.0',
  };
  oauth.oauth_signature = await oauth1Signature(method, baseUrl, params, creds, oauth);
  return 'OAuth ' + Object.keys(oauth).map(function (k) { return pctEncode(k) + '="' + pctEncode(oauth[k]) + '"'; }).join(', ');
}
