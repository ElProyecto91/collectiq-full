// ── Cache API helpers ─────────────────────────────────────────
var DEFAULT_TTL = 3600; // 1 hora

export async function fetchWithCache(cacheKey, apiUrl, ttl) {
  if (!ttl) ttl = DEFAULT_TTL;
  var cache = caches.default;
  var cached = await cache.match(new Request(cacheKey));
  if (cached) return await cached.json();
  var r = await fetch(apiUrl);
  if (!r.ok) return [];
  var data = await r.json();
  var toStore = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=' + ttl,
    },
  });
  await cache.put(new Request(cacheKey), toStore);
  return data;
}