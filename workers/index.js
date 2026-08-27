// ============================================================
// CollectIQ API Worker — Cloudflare Workers v3.0
// URL: https://collectiq-api.esxdinero.workers.dev/
// ============================================================

var SUPABASE_URL = 'https://ajuinjefipjrnbimcdxz.supabase.co';
var ADMIN_ID = 1299079722;
var APP_URL = 'https://collectiq-full.vercel.app';
var FREE_LISTING_LIMIT = 3;

function getEnv(key) {
  try { return globalThis[key] || ''; } catch(e) { return ''; }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

async function sbFetch(path, options) {
  if (!options) options = {};
  var h = sbHeaders();
  if (options.prefer) h['Prefer'] = options.prefer;
  if (options.headers) Object.assign(h, options.headers);
  var res = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: options.method || 'GET',
    headers: h,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  var text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch(e) { return { ok: res.ok, status: res.status, data: text }; }
}

async function generateToken() {
  var array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function sendTgMessage(chatId, text) {
  await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown', disable_web_page_preview: false })
  });
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
      await sendTgMessage(userId, '*¡Bienvenido a CollectIQ GO!*\n\nTu plan está activo 🎉\n\n[Abrir app](' + APP_URL + ')');
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
        await sendTgMessage(chatId, '*¡Bienvenido a CollectIQ!*\n\nAñade 10 cartas y tu amigo recibirá recompensas.');
        return new Response('OK', { status: 200 });
      }
    }
    var arr = new Uint8Array(3);
    crypto.getRandomValues(arr);
    var authCode = Array.from(arr).map(function(b) { return b.toString(10).padStart(2, '0'); }).join('').slice(0, 6);
    await sbPost('auth_codes', { code: authCode, telegram_user_id: user.id, user_data: { id: user.id, first_name: user.first_name, last_name: user.last_name, username: user.username } });
    await sendTgMessage(chatId, '*Tu código de acceso CollectIQ:*\n\n`' + authCode + '`\n\nIntrodúcelo en la app. Válido 5 minutos.');
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
    try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch(e) { return jsonResponse({ text: text.trim() }); }
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
    var result = JSON.parse(text.replace(/```json|```/g, '').trim());
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

// ── ONE PIECE ─────────────────────────────────────────────────
async function handleOnePieceCards(request) {
  var url = new URL(request.url);
  var q = url.searchParams.get('q') || '';
  var set = url.searchParams.get('set') || '';
  var page = parseInt(url.searchParams.get('page') || '1') || 1;
  try {
    var apiUrl = 'https://api.apitcg.com/api/products?tcg=one-piece&type=card&limit=20&page=' + page;
    if (q) apiUrl += '&name=' + encodeURIComponent(q);
    if (set) apiUrl += '&set=' + encodeURIComponent(set);
    var r = await fetch(apiUrl, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return jsonResponse({ cards: [], total: 0 });
    var data = await r.json();
    var items = data.data || data.results || data.products || [];
    var cards = items.map(function(c) {
      var images = c.images || {};
      var attrs = c.attributes || {};
      return {
        id: String(c._id || c.id || ''),
        name: c.name || '',
        number: attrs.Number || attrs.CardNumber || '',
        rarity: attrs.Rarity || '',
        type: attrs.Type || attrs.CardType || '',
        color: [attrs.Color || ''].filter(Boolean),
        power: attrs.Power || null,
        cost: attrs.Cost || null,
        image_url: images.small || images.large || images.full || '',
        set_id: (c.set || {})._id || (c.set || {}).id || '',
        set_name: (c.set || {}).name || '',
        price_eur: null
      };
    });
    return jsonResponse({ cards: cards, total: data.total || cards.length });
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

// ── MAGIC ─────────────────────────────────────────────────────
async function handleMagicCards(request) {
  var url = new URL(request.url);
  var q = url.searchParams.get('q') || '';
  var set = url.searchParams.get('set') || '';
  var page = parseInt(url.searchParams.get('page') || '1') || 1;
  try {
    var apiUrl = 'https://api.apitcg.com/api/products?tcg=magic&type=card&limit=20&page=' + page;
    if (q) apiUrl += '&name=' + encodeURIComponent(q);
    if (set) apiUrl += '&set=' + encodeURIComponent(set);
    var r = await fetch(apiUrl, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return jsonResponse({ cards: [], total: 0 });
    var data = await r.json();
    var items = data.data || data.results || [];
    var cards = items.map(function(c) {
      var images = c.images || {};
      var attrs = c.attributes || {};
      return {
        id: String(c._id || c.id || ''),
        name: c.name || '',
        number: attrs.Number || '',
        rarity: attrs.Rarity || '',
        type: attrs.Type || '',
        mana_cost: attrs.ManaCost || '',
        image_url: images.small || images.large || images.full || '',
        set_id: (c.set || {})._id || (c.set || {}).id || '',
        set_name: (c.set || {}).name || ''
      };
    });
    return jsonResponse({ cards: cards, total: data.total || cards.length });
  } catch(e) {
    return jsonResponse({ cards: [], total: 0, error: e.message });
  }
}

async function handleMagicSets(request) {
  try {
    var r = await fetch('https://api.apitcg.com/api/sets?tcg=magic&limit=200', {
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

// ── YU-GI-OH ──────────────────────────────────────────────────
async function handleYugiohCards(request) {
  var url = new URL(request.url);
  var q = url.searchParams.get('q') || '';
  var set = url.searchParams.get('set') || '';
  var page = parseInt(url.searchParams.get('page') || '1') || 1;
  try {
    var apiUrl = 'https://api.apitcg.com/api/products?tcg=yugioh&type=card&limit=20&page=' + page;
    if (q) apiUrl += '&name=' + encodeURIComponent(q);
    if (set) apiUrl += '&set=' + encodeURIComponent(set);
    var r = await fetch(apiUrl, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return jsonResponse({ cards: [], total: 0 });
    var data = await r.json();
    var items = data.data || data.results || [];
    var cards = items.map(function(c) {
      var images = c.images || {};
      var attrs = c.attributes || {};
      return {
        id: String(c._id || c.id || ''),
        name: c.name || '',
        number: attrs.Number || attrs.CardNumber || '',
        rarity: attrs.Rarity || '',
        type: attrs.Type || attrs.MonsterType || '',
        attribute: attrs.Attribute || '',
        atk: attrs.ATK || null,
        def: attrs.DEF || null,
        level: attrs.Level || null,
        image_url: images.small || images.large || images.full || '',
        set_id: (c.set || {})._id || (c.set || {}).id || '',
        set_name: (c.set || {}).name || ''
      };
    });
    return jsonResponse({ cards: cards, total: data.total || cards.length });
  } catch(e) {
    return jsonResponse({ cards: [], total: 0, error: e.message });
  }
}

async function handleYugiohSets(request) {
  try {
    var r = await fetch('https://api.apitcg.com/api/sets?tcg=yugioh&limit=200', {
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

// ── LORCANA ───────────────────────────────────────────────────
async function handleLorcanaCards(request) {
  var url = new URL(request.url);
  var q = url.searchParams.get('q') || '';
  var set = url.searchParams.get('set') || '';
  var page = parseInt(url.searchParams.get('page') || '1') || 1;
  try {
    var apiUrl = 'https://api.apitcg.com/api/products?tcg=lorcana&type=card&limit=20&page=' + page;
    if (q) apiUrl += '&name=' + encodeURIComponent(q);
    if (set) apiUrl += '&set=' + encodeURIComponent(set);
    var r = await fetch(apiUrl, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return jsonResponse({ cards: [], total: 0 });
    var data = await r.json();
    var items = data.data || data.results || [];
    var cards = items.map(function(c) {
      var images = c.images || {};
      var attrs = c.attributes || {};
      return {
        id: String(c._id || c.id || ''),
        name: c.name || '',
        number: attrs.Number || '',
        rarity: attrs.Rarity || '',
        type: attrs.Type || '',
        ink: attrs.Ink || attrs.Color || '',
        cost: attrs.Cost || null,
        image_url: images.small || images.large || images.full || '',
        set_id: (c.set || {})._id || (c.set || {}).id || '',
        set_name: (c.set || {}).name || ''
      };
    });
    return jsonResponse({ cards: cards, total: data.total || cards.length });
  } catch(e) {
    return jsonResponse({ cards: [], total: 0, error: e.message });
  }
}

async function handleLorcanaSets(request) {
  try {
    var r = await fetch('https://api.apitcg.com/api/sets?tcg=lorcana&limit=100', {
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

// ── MARKETPLACE ───────────────────────────────────────────────
async function notifyWishlistUsers(listing) {
  var tcg = listing.tcg;
  var item_name = listing.item_name;
  var set_name = listing.set_name;
  var price = listing.price;
  var wishlistUsers = [];

  try {
    if (tcg === 'funko') {
      var res1 = await sbFetch('/funko_wishlist?select=telegram_user_id,target_price,funko_id');
      var res2 = await sbFetch('/catalog_items?tcg=eq.funko&name=ilike.*' + encodeURIComponent(item_name) + '*&select=id,name');
      var matchIds = new Set((res2.data || []).map(function(i) { return i.id; }));
      wishlistUsers = (res1.data || []).filter(function(w) { return matchIds.has(w.funko_id); });
    } else {
      var query = '/wishlist_items?tcg=eq.' + encodeURIComponent(tcg) + '&item_name=ilike.*' + encodeURIComponent(item_name) + '*&select=telegram_user_id,max_price';
      var res3 = await sbFetch(query);
      wishlistUsers = res3.data || [];
    }

    wishlistUsers = wishlistUsers.filter(function(w) { return w.telegram_user_id !== listing.telegram_user_id; });
    if (!wishlistUsers.length) return;

    var notified = new Set();
    for (var i = 0; i < wishlistUsers.length; i++) {
      var w = wishlistUsers[i];
      if (notified.has(w.telegram_user_id)) continue;
      notified.add(w.telegram_user_id);

      var priceText = price != null ? '💰 Precio: *' + Number(price).toFixed(2) + '€*' : '💰 Precio: a negociar';
      var maxAlert = (w.max_price && price != null && price <= w.max_price) ? '\n✅ ¡Está dentro de tu precio máximo!' : '';
      var setText = set_name ? ' (' + set_name + ')' : '';

      var msg = '🔔 *¡Tienes suerte!*\n\n' +
        'Un artículo de tu wishlist acaba de publicarse en el Marketplace:\n\n' +
        '📦 *' + item_name + '*' + setText + '\n' +
        priceText + maxAlert + '\n\n' +
        '👉 [Ver anuncio](' + APP_URL + '/marketplace)';

      fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: w.telegram_user_id, text: msg, parse_mode: 'Markdown', disable_web_page_preview: false })
      }).catch(function() {});
    }
  } catch(e) {}
}

async function handleMarketplaceList(request) {
  var url = new URL(request.url);
  var tcg = url.searchParams.get('tcg') || '';
  var listing_type = url.searchParams.get('listing_type') || '';
  var sort = url.searchParams.get('sort') || 'newest';
  var search = url.searchParams.get('search') || '';
  var page = parseInt(url.searchParams.get('page') || '0');
  var limit = parseInt(url.searchParams.get('limit') || '30');
  var user_id = url.searchParams.get('user_id') || '';
  var offset = page * limit;

  var query = '/marketplace_listings?status=eq.active&expires_at=gte.' + new Date().toISOString();
  if (tcg) query += '&tcg=eq.' + encodeURIComponent(tcg);
  if (listing_type) query += '&listing_type=eq.' + encodeURIComponent(listing_type);
  if (user_id) query += '&telegram_user_id=eq.' + user_id;
  if (search) query += '&item_name=ilike.*' + encodeURIComponent(search) + '*';

  if (sort === 'price_asc') query += '&order=price.asc';
  else if (sort === 'price_desc') query += '&order=price.desc';
  else if (sort === 'recent_change') query += '&order=updated_at.desc';
  else query += '&order=created_at.desc';

  query += '&limit=' + limit + '&offset=' + offset;

  // Mis anuncios: incluir todos los estados excepto deleted
  if (user_id) {
    query = '/marketplace_listings?telegram_user_id=eq.' + user_id + '&status=neq.deleted&order=created_at.desc&limit=' + limit;
  }

  var result = await sbFetch(query);
  if (!result.ok) return jsonResponse({ error: 'Error fetching listings' }, 500);

  var enriched = (result.data || []).map(function(l) {
    var history = l.price_history || [];
    var price_change = null;
    if (history.length >= 1 && l.price != null) {
      var prev = history[history.length - 1].price;
      if (prev != null && prev !== l.price) {
        price_change = { direction: l.price < prev ? 'down' : 'up', from: prev, to: l.price, pct: Math.round(((l.price - prev) / prev) * 100) };
      }
    }
    return Object.assign({}, l, { price_change: price_change });
  });

  return jsonResponse({ listings: enriched, page: page, limit: limit });
}

async function handleMarketplaceStats(request) {
  var url = new URL(request.url);
  var item_name = url.searchParams.get('item_name') || '';
  var set_name = url.searchParams.get('set_name') || '';
  var tcg = url.searchParams.get('tcg') || '';

  var allRes = await sbFetch('/marketplace_listings?status=eq.active&select=id,item_name,set_name,tcg,price,original_price,image_url,listing_type,condition,created_at,updated_at&order=created_at.desc&limit=100');
  var all = allRes.data || [];

  var drops = all.filter(function(l) { return l.price != null && l.original_price != null && l.price < l.original_price; }).slice(0, 6);
  var rises = all.filter(function(l) { return l.price != null && l.original_price != null && l.price > l.original_price; }).slice(0, 6);
  var newest = all.slice(0, 10);

  var itemStats = null;
  if (item_name) {
    var statsQuery = '/marketplace_price_stats?item_name=eq.' + encodeURIComponent(item_name);
    if (set_name) statsQuery += '&set_name=eq.' + encodeURIComponent(set_name);
    if (tcg) statsQuery += '&tcg=eq.' + encodeURIComponent(tcg);
    var statsRes = await sbFetch(statsQuery);
    itemStats = (statsRes.data || [])[0] || null;
  }

  return jsonResponse({ price_drops: drops, price_rises: rises, newest: newest, item_stats: itemStats });
}

async function handleMarketplaceCreate(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var telegram_user_id = body.telegram_user_id;
    var listing_type = body.listing_type;
    var tcg = body.tcg;
    var item_name = body.item_name;
    var contact_telegram = body.contact_telegram;

    if (!telegram_user_id || !listing_type || !tcg || !item_name || !contact_telegram) {
      return jsonResponse({ error: 'Faltan campos obligatorios' }, 400);
    }

    // Verificar premium
    var premRes = await sbFetch('/user_premium?telegram_user_id=eq.' + telegram_user_id + '&select=is_active,expires_at');
    var prem = (premRes.data || [])[0];
    var isPremium = prem && prem.is_active && new Date(prem.expires_at) > new Date();

    // Verificar límite FREE
    if (!isPremium) {
      var existRes = await sbFetch('/marketplace_listings?telegram_user_id=eq.' + telegram_user_id + '&status=eq.active&select=id');
      if ((existRes.data || []).length >= FREE_LISTING_LIMIT) {
        return jsonResponse({ error: 'Los usuarios FREE pueden tener máximo ' + FREE_LISTING_LIMIT + ' anuncios activos. Actualiza a GO para publicar ilimitado.', limit_reached: true }, 403);
      }
    }

    var price = body.price != null ? body.price : null;
    var listing = {
      telegram_user_id: telegram_user_id,
      username: body.username || null,
      listing_type: listing_type,
      tcg: tcg,
      item_name: item_name,
      set_name: body.set_name || null,
      card_number: body.card_number || null,
      rarity: body.rarity || null,
      condition: body.condition || null,
      variant: body.variant || null,
      language: body.language || 'es',
      image_url: body.image_url || null,
      price: price,
      currency: body.currency || 'EUR',
      accepts_trade: body.accepts_trade || false,
      description: body.description || null,
      contact_telegram: contact_telegram,
      original_price: price,
      price_history: [],
      status: 'active'
    };

    var createRes = await sbFetch('/marketplace_listings', { method: 'POST', body: listing, prefer: 'return=representation' });
    if (!createRes.ok) return jsonResponse({ error: 'Error creando anuncio' }, 500);
    var created = (createRes.data || [])[0] || createRes.data;

    // Notificar wishlist (fire and forget)
    notifyWishlistUsers(listing).catch(function() {});

    return jsonResponse({ listing: created });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

async function handleMarketplaceUpdate(request) {
  if (request.method !== 'PATCH') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var id = body.id;
    var telegram_user_id = body.telegram_user_id;
    if (!id || !telegram_user_id) return jsonResponse({ error: 'Faltan id o telegram_user_id' }, 400);

    var existRes = await sbFetch('/marketplace_listings?id=eq.' + id + '&telegram_user_id=eq.' + telegram_user_id + '&select=id,price,price_history');
    var current = (existRes.data || [])[0];
    if (!current) return jsonResponse({ error: 'Anuncio no encontrado o no autorizado' }, 404);

    var updates = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.description !== undefined) updates.description = body.description;
    if (body.accepts_trade !== undefined) updates.accepts_trade = body.accepts_trade;

    if (body.price !== undefined && body.price !== current.price) {
      var history = current.price_history || [];
      if (current.price != null) history.push({ price: current.price, date: new Date().toISOString() });
      updates.price = body.price;
      updates.price_history = history;
    }

    var updRes = await sbFetch('/marketplace_listings?id=eq.' + id, { method: 'PATCH', body: updates, prefer: 'return=representation' });
    if (!updRes.ok) return jsonResponse({ error: 'Error actualizando anuncio' }, 500);
    return jsonResponse({ listing: (updRes.data || [])[0] });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

async function handleMarketplaceDelete(request) {
  if (request.method !== 'DELETE' && request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var id = body.id;
    var telegram_user_id = body.telegram_user_id;
    if (!id || !telegram_user_id) return jsonResponse({ error: 'Faltan campos' }, 400);

    await sbFetch('/marketplace_listings?id=eq.' + id + '&telegram_user_id=eq.' + telegram_user_id, {
      method: 'PATCH', body: { status: 'deleted' }, prefer: 'return=minimal'
    });
    return jsonResponse({ success: true });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

async function handleMarketplaceOffer(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var listing_id = body.listing_id;
    var from_user_id = body.from_user_id;
    var message = body.message;
    if (!listing_id || !from_user_id || !message) return jsonResponse({ error: 'Faltan campos obligatorios' }, 400);

    var listRes = await sbFetch('/marketplace_listings?id=eq.' + listing_id + '&status=eq.active&select=telegram_user_id,item_name,set_name,contact_telegram,listing_type,price,offers_count');
    var listing = (listRes.data || [])[0];
    if (!listing) return jsonResponse({ error: 'Anuncio no encontrado o inactivo' }, 404);
    if (listing.telegram_user_id === from_user_id) return jsonResponse({ error: 'No puedes hacer una oferta en tu propio anuncio' }, 400);

    // Guardar oferta
    await sbFetch('/marketplace_offers', {
      method: 'POST',
      body: { listing_id: listing_id, from_user_id: from_user_id, from_username: body.from_username || 'Usuario', message: message, offer_price: body.offer_price || null },
      prefer: 'return=minimal'
    });

    // Incrementar contador
    await sbFetch('/marketplace_listings?id=eq.' + listing_id, {
      method: 'PATCH', body: { offers_count: (listing.offers_count || 0) + 1 }, prefer: 'return=minimal'
    });

    // Notificar al vendedor
    var itemLabel = listing.set_name ? listing.item_name + ' (' + listing.set_name + ')' : listing.item_name;
    var offerText = body.offer_price ? ' — Oferta: ' + body.offer_price + '€' : '';
    var username = body.from_username || 'usuario';
    var msg = '🛍️ *Nueva oferta en tu anuncio*\n\n' +
      '📦 ' + itemLabel + '\n' +
      '👤 De: @' + username + '\n' +
      '💬 "' + message + '"' + offerText + '\n\n' +
      'Responde directamente a @' + username + ' en Telegram.';

    fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: listing.telegram_user_id, text: msg, parse_mode: 'Markdown' })
    }).catch(function() {});

    return jsonResponse({ success: true });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// ── CRON PRECIOS ──────────────────────────────────────────────
// Se activa con un cron trigger diario desde Cloudflare
// En wrangler.toml añadir: [triggers] crons = ["0 3 * * *"]
async function handleCronPrices() {
  var results = [];
  try {
    // 1. Pokémon — actualizar market_price de collection_items usando pokemontcg.io
    var pokemonItems = await sbFetch('/collection_items?tcg=eq.pokemon&card_id=not.is.null&select=id,card_id&limit=100');
    var pokemonBatch = pokemonItems.data || [];
    var pokemonApiKey = getEnv('VITE_POKEMONTCG_API_KEY');
    var updated = 0;
    for (var i = 0; i < pokemonBatch.length; i++) {
      try {
        var item = pokemonBatch[i];
        var headers = { 'Content-Type': 'application/json' };
        if (pokemonApiKey) headers['X-Api-Key'] = pokemonApiKey;
        var cardRes = await fetch('https://api.pokemontcg.io/v2/cards/' + item.card_id, { headers: headers });
        if (cardRes.ok) {
          var cardData = await cardRes.json();
          var price = ((cardData.data || {}).tcgplayer || {}).prices;
          var marketPrice = null;
          if (price) {
            var variants = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil'];
            for (var v = 0; v < variants.length; v++) {
              if (price[variants[v]] && price[variants[v]].market) {
                marketPrice = price[variants[v]].market;
                break;
              }
            }
          }
          if (marketPrice) {
            await sbFetch('/collection_items?id=eq.' + item.id, { method: 'PATCH', body: { market_price: marketPrice, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
            updated++;
          }
        }
      } catch(e) {}
    }
    results.push({ tcg: 'pokemon', updated: updated });

    // 2. Marketplace — expirar anuncios vencidos
    await sbFetch('/marketplace_listings?status=eq.active&expires_at=lt.' + new Date().toISOString(), {
      method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal'
    });
    results.push({ task: 'marketplace_expire', ok: true });

  } catch(e) {
    results.push({ error: e.message });
  }
  return jsonResponse({ ok: true, results: results, ran_at: new Date().toISOString() });
}

// ── ROUTER PRINCIPAL ──────────────────────────────────────────
addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

// Para cron triggers
addEventListener('scheduled', function(event) {
  event.waitUntil(handleCronPrices());
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
  if (route === 'onepiece-sets') return handleOnePieceSets(request);
  if (route === 'magic-cards') return handleMagicCards(request);
  if (route === 'magic-sets') return handleMagicSets(request);
  if (route === 'yugioh-cards') return handleYugiohCards(request);
  if (route === 'yugioh-sets') return handleYugiohSets(request);
  if (route === 'lorcana-cards') return handleLorcanaCards(request);
  if (route === 'lorcana-sets') return handleLorcanaSets(request);
  if (route === 'marketplace-list') return handleMarketplaceList(request);
  if (route === 'marketplace-create') return handleMarketplaceCreate(request);
  if (route === 'marketplace-update') return handleMarketplaceUpdate(request);
  if (route === 'marketplace-delete') return handleMarketplaceDelete(request);
  if (route === 'marketplace-offer') return handleMarketplaceOffer(request);
  if (route === 'marketplace-stats') return handleMarketplaceStats(request);
  if (route === 'cron-prices') {
    var cronSecret = url.searchParams.get('secret') || '';
    if (cronSecret !== getEnv('CRON_SECRET')) return jsonResponse({ error: 'Unauthorized' }, 401);
    return handleCronPrices();
  }

  return jsonResponse({ ok: true, service: 'CollectIQ API', version: '3.0', routes: ['auth-telegram','auth-code','bot-webhook','telegram-callback','vision','scanner','funko-import','funko-price','admin-verify','admin-give-go','analytics','create-invoice','onepiece-cards','onepiece-sets','magic-cards','magic-sets','yugioh-cards','yugioh-sets','lorcana-cards','lorcana-sets','marketplace-list','marketplace-create','marketplace-update','marketplace-delete','marketplace-offer','marketplace-stats','cron-prices'] });
}
