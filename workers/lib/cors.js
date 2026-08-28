// ── CORS + JSON response + env ────────────────────────────────
export var _ENV = {};

export function getEnv(key) {
  return _ENV[key] || '';
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(data, status) {
  if (!status) status = 200;
  var headers = corsHeaders();
  headers['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(data), { status: status, headers: headers });
}