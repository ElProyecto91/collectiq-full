// ── AUTH handlers ─────────────────────────────────────────────
import { jsonResponse, corsHeaders, getEnv } from '../lib/cors.js';
import { sbGet, sbPost, sbPatch, sbFetch } from '../lib/supabase.js';
import { sendTgMessage, generateToken, APP_URL, ADMIN_ID } from '../lib/telegram.js';

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

export async function handleAuthTelegram(request) {
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

export async function handleAuthCode(request) {
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

export async function handleBotWebhook(request) {
  if (request.method !== 'POST') return new Response('OK', { status: 200 });
  var secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (getEnv('TELEGRAM_WEBHOOK_SECRET') && secret !== getEnv('TELEGRAM_WEBHOOK_SECRET')) return new Response('Unauthorized', { status: 401 });
  try {
    var update = await request.json();
    if (update.pre_checkout_query) {
      await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/answerPreCheckoutQuery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
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

export async function handleTelegramCallback(request) {
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

export async function handleAdminVerify(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.telegramUserId) return jsonResponse({ ok: false }, 400);
    var sessions = await sbGet('user_sessions', 'telegram_user_id=eq.' + body.telegramUserId + '&select=telegram_user_id&limit=1');
    return jsonResponse({ ok: body.telegramUserId === ADMIN_ID && sessions && sessions.length > 0 });
  } catch(e) { return jsonResponse({ ok: false }, 500); }
}

export async function handleAdminGiveGo(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var telegramUserId = Number(body.telegramUserId);
    var adminId = Number(body.adminId);
    if (adminId !== ADMIN_ID) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (!telegramUserId) return jsonResponse({ error: 'Missing telegramUserId' }, 400);
    var days = body.days || 30;
    var expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    if (body.revoke) {
      await sbFetch('/user_premium?telegram_user_id=eq.' + telegramUserId, { method: 'PATCH', body: { is_active: false }, prefer: 'return=minimal' });
      return jsonResponse({ ok: true, revoked: true });
    }
    await sbPost('user_premium', { telegram_user_id: telegramUserId, plan: 'go', expires_at: expiresAt, is_active: true, stars_paid: 0, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates');
    return jsonResponse({ ok: true, expires_at: expiresAt, days: days });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

export async function handleCreateInvoice(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    if (!body.telegramUserId) return jsonResponse({ error: 'Missing telegramUserId' }, 400);
    var res = await fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/createInvoiceLink', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'CollectIQ GO', description: 'Escaneos ilimitados y todas las funciones premium durante 30 dias.', payload: JSON.stringify({ telegramUserId: body.telegramUserId, type: 'go_monthly' }), currency: 'XTR', prices: [{ label: 'CollectIQ GO - 1 mes', amount: 75 }] }),
    });
    var data = await res.json();
    if (!data.ok) return jsonResponse({ error: data.description }, 500);
    return jsonResponse({ invoiceLink: data.result });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

export async function handleAnalytics(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    await sbPost('analytics_events', {
      telegram_user_id: body.telegramUserId || null,
      event_type: body.eventType || 'unknown',
      platform: body.platform || 'unknown',
      app_version: body.appVersion || null,
      is_premium: body.isPremium || false,
      page: (body.properties || {}).page || null,
      properties: body.properties || {},
    });
    return jsonResponse({ ok: true });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}