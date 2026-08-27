// ============================================================
// CollectIQ API Worker — Cloudflare Workers v2.0
// URL: https://collectiq-api.esxdinero.workers.dev/
// ============================================================

var SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
var ADMIN_ID = 1299079722;

function getEnv(key) {
  try { return globalThis[key] || ''; } catch(e) { return ''; }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, status) {
  if (!status) status = 200;
  var headers = corsHeaders();
  headers['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(data), { status: status, headers: headers });
}

function sbHeaders() {
  var key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
}

async function sbGet(table, query) {
  var r = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, { headers: sbHeaders() });
  return r.json();
}

async function sbPost(table, body, prefer) {
  var h = sbHeaders();
  if (prefer) h['Prefer'] = prefer;
  return fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST', headers: h, body: JSON.stringify(body)
  });
}

async function sbPatch(table, query, body) {
  return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(body)
  });
}

async function generateToken() {
  var array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// ── AUTH-TELEGRAM ─────────────────────────────────────────────
async function verifyTelegramData(initData, botToken) {
  var params = new URLSearchParams(initData);
  var hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  var entries = [];
  params.forEach(function(v, k) { entries.push(k + '=' + v); });
  entries.sort();
  var dataCheckString = entries.join('\n');
  var encoder = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var secretKey = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(botToken));
  var verifyKey = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var signature = await crypto.subtle.sign('HMAC', verifyKey, encoder.encode(dataCheckString));
  var computedHash = Array.from(new Uint8Array(signature)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  return computedHash === hash;
}

async function handleAuthTelegram(request) {
  if (request.method === 'GET') {
    var token = new URL(request.url).searchParams.get('token');
    if (!token) return jsonResponse({ error: 'No token' }, 400);
    var sessions = await sbGet('user_sessions', 'token=eq.' + token + '&select=*');
    if (!sessions.length) return jsonResponse({ error: 'Invalid session' }, 401);
    var session = sessions[0];
    if (new Date(session.expires_at) < new Date()) return jsonResponse({ error: 'Session expired' }, 401);
    return jsonResponse({ ok: true, user: session.user_data });
  }
  if (request.method === 'POST') {
    try {
      var body = await request.json();
      var initData = body.initData;
      if (!initData) return jsonResponse({ error: 'Missing data' }, 400);
      var isValid = await verifyTelegramData(initData, getEnv('TELEGRAM_BOT_TOKEN'));
      if (!isValid) return jsonResponse({ error: 'Invalid Telegram data' }, 401);
      var params = new URLSearchParams(initData);
      var user = JSON.parse(params.get('user') || '{}');
      var tok = await generateToken();
      await sbPost('user_sessions', { telegram_user_id: user.id, token: tok, user_data: user });
      var h = corsHeaders();
      h['Content-Type'] = 'application/json';
      h['Set-Cookie'] = 'collectiq_session=' + tok + '; Path=/; Max-Age=7776000; SameSite=None; Secure';
      return new Response(JSON.stringify({ ok: true, user: user, token: tok }), { headers: h });
    } catch(e) { return jsonResponse({ error: 'Server error' }, 500); }
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ── AUTH-CODE ─────────────────────────────────────────────────
async function handleAuthCode(request) {
  if (request.method === 'POST') {
    try {
      var body = await request.json();
      if (!body.telegramUserId) return jsonResponse({ error: 'Missing data' }, 400);
      var array = new Uint8Array(3);
      crypto.getRandomValues(array);
      var code = Array.from(array).map(function(b) { return b.toString(10).padStart(2, '0'); }).join('').slice(0, 6);
      await sbPost('auth_codes', { code: code, telegram_user_id: body.telegramUserId, user_data: body.userData });
      return jsonResponse({ ok: true, code: code });
    } catch(e) { return jsonResponse({ error: 'Server error' }, 500); }
  }
  if (request.method === 'GET') {
    var code = new URL(request.url).searchParams.get('code');
    if (!code) return jsonResponse({ error: 'No code' }, 400);
    var codes = await sbGet('auth_codes', 'code=eq.' + code + '&used=eq.false&select=*');
    if (!codes.length) return jsonResponse({ error: 'Invalid code' }, 401);
    var authCode = codes[0];
    if (new Date(authCode.expires_at) < new Date()) return jsonResponse({ error: 'Code expired' }, 401);
    await sbPatch('auth_codes', 'id=eq.' + authCode.id, { used: true });
    var token = await generateToken();
    await sbPost('user_sessions', { telegram_user_id: authCode.telegram_user_id, token: token, user_data: authCode.user_data });
    return jsonResponse({ ok: true, token: token, user: authCode.user_data });
  }
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ── BOT-WEBHOOK ───────────────────────────────────────────────
async function sendTgMessage(chatId, text) {
  await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
  });
}

async function handleBotWebhook(request) {
  if (request.method !== 'POST') return new Response('OK', { status: 200 });
  var secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (getEnv('TELEGRAM_WEBHOOK_SECRET') && secret !== getEnv('TELEGRAM_WEBHOOK_SECRET')) return new Response('Unauthorized', { status: 401 });
  try {
    var update = await request.json();
    if (update.pre_checkout_query) {
      await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/answerPreCheckoutQuery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
      });
      return new Response('OK', { status: 200 });
    }
    if (update.message && update.message.successful_payment) {
      var payment = update.message.successful_payment;
      var userId = update.message.from.id;
      var telegramUserId = userId;
      try { var payload = JSON.parse(payment.invoice_payload); telegramUserId = payload.telegramUserId || userId; } catch(e) {}
      var expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await sbPost('user_premium', { telegram_user_id: telegramUserId, plan: 'go', expires_at: expiresAt, stars_paid: payment.total_amount, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates');
      await sendTgMessage(userId, '<b>Bienvenido a CollectIQ GO!</b>\n\nTu plan esta activo.\n\nAbre la app: https://t.me/CollectIQ_bot/app');
      return new Response('OK', { status: 200 });
    }
    var message = update.message;
    if (!message) return new Response('OK', { status: 200 });
    var chatId = message.chat.id;
    var user = message.from;
    var startParam = (message.text || '').split(' ')[1] || '';
    if (startParam.indexOf('ref_') === 0) {
      var referrerId = parseInt(startParam.replace('ref_', ''));
      if (!isNaN(referrerId) && referrerId !== user.id) {
        await sbPost('referrals', { referrer_id: referrerId, referred_id: user.id, completed: false, cards_added: 0, reward_given: false, referred_registered_at: new Date().toISOString() });
        await sendTgMessage(chatId, '<b>Bienvenido a CollectIQ!</b>\n\nAnade 10 cartas y tu amigo recibira recompensas.');
        return new Response('OK', { status: 200 });
      }
    }
    var arr = new Uint8Array(3);
    crypto.getRandomValues(arr);
    var authCode = Array.from(arr).map(function(b) { return b.toString(10).padStart(2, '0'); }).join('').slice(0, 6);
    await sbPost('auth_codes', { code: authCode, telegram_user_id: user.id, user_data: { id: user.id, first_name: user.first_name, last_name: user.last_name, username: user.username } });
    await sendTgMessage(chatId, '<b>Tu codigo de acceso CollectIQ:</b>\n\n<code>' + authCode + '</code>\n\nIntroducelo en la app. Valido 5 minutos.');
    return new Response('OK', { status: 200 });
  } catch(e) { return new Response('OK', { status: 200 }); }
}

// ── TELEGRAM-CALLBACK ─────────────────────────────────────────
async function handleTelegramCallback(request) {
  var url = new URL(request.url);
  var params = {};
  url.searchParams.forEach(function(v, k) { params[k] = v; });
  var checkHash = params.hash;
  var keys = Object.keys(params).filter(function(k) { return k !== 'hash'; }).sort();
  var dataCheckString = keys.map(function(k) { return k + '=' + params[k]; }).join('\n');
  var encoder = new TextEncoder();
  var keyData = await crypto.subtle.digest('SHA-256', encoder.encode(getEnv('TELEGRAM_BOT_TOKEN')));
  var key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataCheckString));
  var computedHash = Array.from(new Uint8Array(signature)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  if (computedHash !== checkHash) return new Response('Invalid data', { status: 401 });
  var user = { id: parseInt(params.id), first_name: params.first_name, last_name: params.last_name, username: params.username, photo_url: params.photo_url };
  var token = await generateToken();
  await sbPost('user_sessions', { telegram_user_id: user.id, token: token, user_data: user });
  var h = { 'Location': '/', 'Set-Cookie': 'collectiq_session=' + token + '; Path=/; Max-Age=7776000; SameSite=Lax; Secure' };
  return new Response(null, { status: 302, headers: h });
}

// ── VISION ────────────────────────────────────────────────────
async function validatePokemonCard(name, number, setCode) {
  var headers = { 'Content-Type': 'application/json' };
  var apiKey = getEnv('VITE_POKEMONTCG_API_KEY');
  if (apiKey) headers['X-Api-Key'] = apiKey;
  var attempts = [];
  if (number && setCode) attempts.push('number:"' + number.split('/')[0] + '" set.id:"' + setCode + '"');
  if (number && name) attempts.push('name:"' + name + '" number:"' + number.split('/')[0] + '"');
  if (name) attempts.push('name:"' + name + '"');
  for (var i = 0; i < attempts.length; i++) {
    try {
      var r = await fetch('https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(attempts[i]) + '&pageSize=5&orderBy=-set.releaseDate', { headers: headers });
      if (r.ok) { var d = await r.json(); if (d.data && d.data.length > 0) return d.data[0]; }
    } catch(e) {}
  }
  return null;
}

async function handleVision(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.image) return jsonResponse({ error: 'Missing image' }, 400);
    var geminiBody = {
      contents: [{ parts: [
        { text: 'You are an expert Pokemon TCG card identifier. Return ONLY JSON with: name, number, set_code, language, variant, name_confidence, variant_confidence, is_pokemon_card.' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image } }
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: 256 }
    };
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody)
    });
    var gd = await gr.json();
    var rawContent = ((gd.candidates || [])[0] || {}).content;
    var text = ((rawContent || {}).parts || [])[0];
    text = (text || {}).text || '';
    var parsed = {};
    try { parsed = JSON.parse(text.replace(/json|/g, '').trim()); } catch(e) { return jsonResponse({ text: text.trim() }); }
    if (!parsed.is_pokemon_card) return jsonResponse({ text: '', error: 'No es una carta Pokemon' });
    var validated = await validatePokemonCard(parsed.name || '', parsed.number || null, parsed.set_code || null);
    return jsonResponse({
      text: validated ? validated.name : parsed.name,
      number: validated ? validated.number : parsed.number,
      set_code: validated ? null : parsed.set_code,
      validated_card_id: validated ? validated.id : null,
      validated_set_name: validated ? validated.set.name : null,
      language: parsed.language || 'en',
      variant: parsed.variant || 'normal',
      name_confidence: parsed.name_confidence || 0,
      variant_confidence: parsed.variant_confidence || 0,
      was_validated: validated !== null
    });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── SCANNER ───────────────────────────────────────────────────
async function handleScanner(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.image_base64) return jsonResponse({ error: 'image_base64 requerido' }, 400);
    var geminiBody = {
      contents: [{ parts: [
        { text: 'Analiza esta imagen y devuelve SOLO JSON con: tcg (pokemon|funko|magic|yugioh|onepiece|unknown), name, set_name, number, rarity, variant, language, confidence (0-1).' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image_base64 } }
      ]}]
    };
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody)
    });
    var gd = await gr.json();
    var text = (((gd.candidates || [])[0] || {}).content || {});
    text = ((text.parts || [])[0] || {}).text || '';
    var result = JSON.parse(text.replace(/json|/g, '').trim());
    return jsonResponse({ result: result, validated: false, scans_remaining: 99 });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── FUNKO-IMPORT ──────────────────────────────────────────────
async function handleFunkoImport(request) {
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

// ── FUNKO-PRICE ───────────────────────────────────────────────
async function getEbayToken() {
  var credentials = btoa(getEnv('EBAY_APP_ID') + ':' + getEnv('EBAY_CERT_ID'));
  var res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + credentials, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });
  var data = await res.json();
  return data.access_token;
}

async function handleFunkoPrice(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  var name = new URL(request.url).searchParams.get('name');
  if (!name) return jsonResponse({ error: 'name required' }, 400);
  try {
    var token = await getEbayToken();
    var searchRes = await fetch('https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(name + ' funko pop') + '&filter=buyingOptions:{FIXED_PRICE}&sort=price&limit=20&marketplace_ids=EBAY_ES', {
      headers: { 'Authorization': 'Bearer ' + token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_ES' }
    });
    var data = await searchRes.json();
    var prices = (data.itemSummaries || []).map(function(i) { return parseFloat((i.price || {}).value || '0'); }).filter(function(p) { return p > 0 && p < 500; }).sort(function(a, b) { return a - b; });
    if (!prices.length) return jsonResponse({ price: null, confidence: 'low', count: 0 });
    var median = prices[Math.floor(prices.length / 2)];
    var avg = prices.reduce(function(s, p) { return s + p; }, 0) / prices.length;
    return jsonResponse({ price: Math.round(median * 100) / 100, avg: Math.round(avg * 100) / 100, min: prices[0], max: prices[prices.length - 1], count: prices.length, confidence: prices.length >= 10 ? 'high' : prices.length >= 5 ? 'medium' : 'low', currency: 'EUR' });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── ADMIN-VERIFY ──────────────────────────────────────────────
async function handleAdminVerify(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.telegramUserId) return jsonResponse({ ok: false }, 400);
    var sessions = await sbGet('user_sessions', 'telegram_user_id=eq.' + body.telegramUserId + '&select=telegram_user_id&limit=1');
    return jsonResponse({ ok: body.telegramUserId === ADMIN_ID && sessions && sessions.length > 0 });
  } catch(e) { return jsonResponse({ ok: false }, 500); }
}

// ── ADMIN-GIVE-GO ─────────────────────────────────────────────
async function handleAdminGiveGo(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var telegramUserId = Number(body.telegramUserId);
    var targetUserId = Number(body.targetUserId);
    var months = body.months || 1;
    var days = body.days || 0;
    if (telegramUserId !== ADMIN_ID) return jsonResponse({ error: 'Unauthorized' }, 401);
    var ms = (months * 30 * 24 * 60 * 60 * 1000) + (days * 24 * 60 * 60 * 1000);
    var expiresAt = new Date(Date.now() + ms).toISOString();
    await sbPost('user_premium', { telegram_user_id: targetUserId, plan: 'go', expires_at: expiresAt, stars_paid: 0, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates');
    return jsonResponse({ ok: true, expiresAt: expiresAt });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── ANALYTICS ─────────────────────────────────────────────────
async function handleAnalytics(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.eventName) return jsonResponse({ error: 'Missing eventName' }, 400);
    await sbPost('analytics_events', {
      app_id: body.appId || 'collectiq',
      telegram_user_id: body.telegramUserId || null,
      session_id: body.sessionId || null,
      event_name: body.eventName,
      platform: body.platform || 'unknown',
      app_version: body.appVersion || null,
      is_premium: body.isPremium || false,
      page: (body.properties || {}).page || null,
      properties: body.properties || {}
    });
    return jsonResponse({ ok: true });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── CREATE-INVOICE ────────────────────────────────────────────
async function handleCreateInvoice(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.telegramUserId) return jsonResponse({ error: 'Missing telegramUserId' }, 400);
    var res = await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/createInvoiceLink', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'CollectIQ GO', description: 'Escaneos ilimitados y todas las funciones premium durante 30 dias.', payload: JSON.stringify({ telegramUserId: body.telegramUserId, type: 'go_monthly' }), currency: 'XTR', prices: [{ label: 'CollectIQ GO - 1 mes', amount: 75 }] })
    });
    var data = await res.json();
    if (!data.ok) return jsonResponse({ error: data.description }, 500);
    return jsonResponse({ invoiceLink: data.result });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}
// ── SECCIÓN: ONE PIECE CARDS ──────────────────────────────────
// Busca cartas de One Piece via APITCG (con API key)
async function fetchOnePieceFromAPI(q, set, page) {
  var limit = 20;
    var offset = (page - 1) * limit;
      var url = 'https://api.apitcg.com/api/products?tcg=one-piece&type=card&limit=' + limit + '&page=' + page;
        if (q) url += '&name=' + encodeURIComponent(q);
          if (set) url += '&set=' + encodeURIComponent(set);
            var r = await fetch(url, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
              if (!r.ok) return { cards: [], total: 0 };
                var data = await r.json();
                  var items = data.data || data.results || data.products || [];
                    var cards = items.map(function(c) {
                        var images = c.images || {};
                            return {
                                  id: String(c._id || c.id || ''),
                                        name: c.name || '',
                                              number: (c.attributes || {}).Number || (c.attributes || {}).CardNumber || '',
                                                    rarity: (c.attributes || {}).Rarity || '',
                                                          type: (c.attributes || {}).Type || (c.attributes || {}).CardType || '',
                                                                color: [(c.attributes || {}).Color || ''].filter(Boolean),
                                                                      power: (c.attributes || {}).Power || null,
                                                                            cost: (c.attributes || {}).Cost || null,
                                                                                  image_url: images.small || images.large || images.full || '',
                                                                                        set_id: (c.set || {})._id || (c.set || {}).id || '',
                                                                                              set_name: (c.set || {}).name || '',
                                                                                                    price_eur: null,
                                                                                                        };
                                                                                                          });
                                                                                                            return { cards: cards, total: data.total || cards.length };
                                                                                                            }

                                                                                                            async function handleOnePieceCards(request) {
                                                                                                              var url = new URL(request.url);
                                                                                                                var q = url.searchParams.get('q') || '';
                                                                                                                  var set = url.searchParams.get('set') || '';
                                                                                                                    var page = parseInt(url.searchParams.get('page') || '1') || 1;
                                                                                                                      try {
                                                                                                                          var result = await fetchOnePieceFromAPI(q, set, page);
                                                                                                                              return jsonResponse(result);
                                                                                                                                } catch(e) {
                                                                                                                                    return jsonResponse({ cards: [], total: 0, error: e.message });
                                                                                                                                      }
                                                                                                                                      }

                                                                                                                                      async function handleOnePieceSets(request) {
                                                                                                                                        try {
                                                                                                                                            var r = await fetch('https://api.apitcg.com/api/sets?tcg=one-piece&limit=100', {
                                                                                                                                                  headers: { 'x-api-key': getEnv('APITCG_API_KEY') }
                                                                                                                                                      });
                                                                                                                                                          if (!r.ok) return jsonResponse({ sets: [] });
                                                                                                                                                              var data = await r.json();
                                                                                                                                                                  var sets = (data.data || []).map(function(s) {
                                                                                                                                                                        return { id: s._id || s.id, name: s.name, total: s.total || 0 };
                                                                                                                                                                            });
                                                                                                                                                                                return jsonResponse({ sets: sets });
                                                                                                                                                                                  } catch(e) {
                                                                                                                                                                                      return jsonResponse({ sets: [], error: e.message });
                                                                                                                                                                                        }
                                                                                                                                                                                        }
// ── ROUTER PRINCIPAL ──────────────────────────────────────────
addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }
  var url = new URL(request.url);
  var route = url.pathname.replace(/^\//, '').split('/')[0] || url.searchParams.get('route') || '';

  if (route === 'auth-telegram') return handleAuthTelegram(request);
  if (route === 'auth-code') return handleAuthCode(request);
  if (route === 'bot-webhook') return handleBotWebhook(request);
  if (route === 'telegram-callback') return handleTelegramCallback(request);
  if (route === 'vision') return handleVision(request);
  if (route === 'scanner') return handleScanner(request);
  if (route === 'funko-import') return handleFunkoImport(request);
  if (route === 'funko-price') return handleFunkoPrice(request);
  if (route === 'admin-verify') return handleAdminVerify(request);
  if (route === 'admin-give-go') return handleAdminGiveGo(request);
  if (route === 'analytics') return handleAnalytics(request);
  if (route === 'create-invoice') return handleCreateInvoice(request);
  if (route === 'onepiece-cards') return handleOnePieceCards(request);
  if (route === 'onepiece-sets') return handleOnePieceSets(request);addEventListener
  return jsonResponse({ ok: true, service: 'CollectIQ API', version: '2.0', routes: ['auth-telegram','auth-code','bot-webhook','telegram-callback','vision','scanner','funko-import','funko-price','admin-verify','admin-give-go','analytics','create-invoice'] });
}
