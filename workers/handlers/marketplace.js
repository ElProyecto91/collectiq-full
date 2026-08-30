// ── MARKETPLACE handlers ──────────────────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbFetch, sbPost } from '../lib/supabase.js';

var APP_URL = 'https://collectiq-full.vercel.app';
var FREE_LISTING_LIMIT = 3;

async function notifyWishlistUsers(listing) {
  var tcg = listing.tcg;
  var item_name = listing.item_name;
  var set_name = listing.set_name;
  var price = listing.price;
  var wishlistUsers = [];

  try {
    if (tcg === 'funko') {
      // Buscar en funko_wishlist (legacy) via funko_items
      var res1 = await sbFetch('/funko_wishlist?select=telegram_user_id,target_price,funko_id');
      var res2 = await sbFetch('/funko_items?name=ilike.*' + encodeURIComponent(item_name.substring(0, 30)) + '*&select=id,name');
      var matchIdsLegacy = new Set((res2.data || []).map(function(i) { return i.id; }));
      var legacyWish = (res1.data || []).filter(function(w) { return matchIdsLegacy.has(w.funko_id); });

      // Buscar en funko_wishlist via catalog_items (nuevo catálogo)
      var res3 = await sbFetch('/catalog_items?tcg=eq.funko&name=ilike.*' + encodeURIComponent(item_name.substring(0, 30)) + '*&select=id,name');
      var matchIdsNew = new Set((res3.data || []).map(function(i) { return i.id; }));
      var newWish = (res1.data || []).filter(function(w) { return matchIdsNew.has(w.funko_id); });

      // Combinar y deduplicar por telegram_user_id
      var allWish = [...legacyWish, ...newWish];
      var seen = new Set();
      wishlistUsers = allWish.filter(function(w) {
        if (seen.has(w.telegram_user_id)) return false;
        seen.add(w.telegram_user_id);
        return true;
      });
    } else {
      // Para otros TCGs buscar en wishlist_items
      var res4 = await sbFetch('/wishlist_items?tcg=eq.' + encodeURIComponent(tcg) + '&item_name=ilike.*' + encodeURIComponent(item_name.substring(0, 30)) + '*&select=telegram_user_id,max_price');
      wishlistUsers = res4.data || [];
    }

    // Excluir al propio vendedor
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
      var msg = '🔔 *¡Tienes suerte!*\n\nUn artículo de tu wishlist acaba de publicarse en el Marketplace:\n\n📦 *' + item_name + '*' + setText + '\n' + priceText + maxAlert + '\n\n👉 [Ver anuncio](' + APP_URL + '/marketplace)';

      fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: w.telegram_user_id, text: msg, parse_mode: 'Markdown', disable_web_page_preview: false }),
      }).catch(function() {});
    }
  } catch(e) {
    console.error('[marketplace] wishlist notify error:', e.message);
  }
}

export async function handleMarketplaceList(request) {
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

  if (user_id) query = '/marketplace_listings?telegram_user_id=eq.' + user_id + '&status=neq.deleted&order=created_at.desc&limit=' + limit;

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

export async function handleMarketplaceStats(request) {
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

export async function handleMarketplaceCreate(request) {
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

    if (!isPremium) {
      var existRes = await sbFetch('/marketplace_listings?telegram_user_id=eq.' + telegram_user_id + '&status=eq.active&select=id');
      if ((existRes.data || []).length >= FREE_LISTING_LIMIT) {
        return jsonResponse({ error: 'Los usuarios FREE pueden tener máximo ' + FREE_LISTING_LIMIT + ' anuncios activos.', limit_reached: true }, 403);
      }
    }

    var price = body.price != null ? body.price : null;

    // Usar username del telegramUser si no se pasa contact_telegram
    var finalContactTelegram = contact_telegram || body.username || '';

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
      contact_telegram: finalContactTelegram,
      original_price: price,
      price_history: [],
      status: 'active',
    };

    var createRes = await sbFetch('/marketplace_listings', { method: 'POST', body: listing, prefer: 'return=representation' });
    if (!createRes.ok) return jsonResponse({ error: 'Error creando anuncio' }, 500);
    var created = (createRes.data || [])[0] || createRes.data;

    // Notificar a usuarios con wishlist que coincida — fire and forget
    notifyWishlistUsers(listing).catch(function() {});

    return jsonResponse({ listing: created });
  } catch(e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function handleMarketplaceUpdate(request) {
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
  } catch(e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function handleMarketplaceDelete(request) {
  if (request.method !== 'DELETE' && request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    var body = await request.json();
    var id = body.id;
    var telegram_user_id = body.telegram_user_id;
    if (!id || !telegram_user_id) return jsonResponse({ error: 'Faltan campos' }, 400);
    await sbFetch('/marketplace_listings?id=eq.' + id + '&telegram_user_id=eq.' + telegram_user_id, { method: 'PATCH', body: { status: 'deleted' }, prefer: 'return=minimal' });
    return jsonResponse({ success: true });
  } catch(e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function handleMarketplaceOffer(request) {
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

    await sbFetch('/marketplace_offers', { method: 'POST', body: { listing_id: listing_id, from_user_id: from_user_id, from_username: body.from_username || 'Usuario', message: message, offer_price: body.offer_price || null }, prefer: 'return=minimal' });
    await sbFetch('/marketplace_listings?id=eq.' + listing_id, { method: 'PATCH', body: { offers_count: (listing.offers_count || 0) + 1 }, prefer: 'return=minimal' });

    var itemLabel = listing.set_name ? listing.item_name + ' (' + listing.set_name + ')' : listing.item_name;
    var offerText = body.offer_price ? ' — Oferta: ' + body.offer_price + '€' : '';
    var username = body.from_username || 'usuario';
    var msg = '🛍️ *Nueva oferta en tu anuncio*\n\n📦 ' + itemLabel + '\n👤 De: @' + username + '\n💬 "' + message + '"' + offerText + '\n\nResponde directamente a @' + username + ' en Telegram.';

    fetch('https://api.telegram.org/bot' + getEnv('TELEGRAM_BOT_TOKEN') + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: listing.telegram_user_id, text: msg, parse_mode: 'Markdown' }),
    }).catch(function() {});

    return jsonResponse({ success: true });
  } catch(e) {
    return jsonResponse({ error: e.message }, 500);
  }
}