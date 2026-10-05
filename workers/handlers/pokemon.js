// ── POKEMON handlers ──────────────────────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbFetch } from '../lib/supabase.js';
import { sessionUserId } from '../lib/session.js';
import { cardmarketEur, tcgplayerUsd } from '../lib/pricing.js';

// Pokémon TCG API q= text: quotes and backslashes in a name read from a photo would change the query.
function esc(v) { return String(v == null ? '' : v).replace(/["\\]/g, '').trim(); }

async function validatePokemonCard(name, number, setCode) {
  var headers = { 'Content-Type': 'application/json' };
  var apiKey = getEnv('VITE_POKEMONTCG_API_KEY');
  if (apiKey) headers['X-Api-Key'] = apiKey;
  var attempts = [];
  name = esc(name); setCode = esc(setCode);
  var num = number ? esc(String(number).split('/')[0]) : '';
  if (num && setCode) attempts.push('number:"' + num + '" set.id:"' + setCode + '"');
  if (num && name) attempts.push('name:"' + name + '" number:"' + num + '"');
  if (name) attempts.push('name:"' + name + '"');
  for (var i = 0; i < attempts.length; i++) {
    try {
      var r = await fetch('https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(attempts[i]) + '&pageSize=5&orderBy=-set.releaseDate', { headers: headers });
      if (r.ok) { var d = await r.json(); if (d.data && d.data.length > 0) return d.data[0]; }
    } catch(e) {}
  }
  return null;
}

export async function handleVision(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  // these calls spend the Gemini quota: only a logged-in user may make them
  if (!(await sessionUserId(request))) return jsonResponse({ error: 'unauthorized' }, 401);
  try {
    var body = await request.json();
    if (!body.image) return jsonResponse({ error: 'Missing image' }, 400);
    var geminiBody = {
      contents: [{ parts: [
        { text: 'You are an expert Pokemon TCG card identifier. Return ONLY JSON with: name, number, set_code, language, variant, name_confidence, variant_confidence, is_pokemon_card.' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image } },
      ]}],
      generationConfig: { temperature: 0, maxOutputTokens: 256 },
    };
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody),
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
      language: parsed.language || 'en', variant: parsed.variant || 'normal',
      name_confidence: parsed.name_confidence || 0, variant_confidence: parsed.variant_confidence || 0,
      was_validated: validated !== null,
    });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

export async function handleScanner(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!(await sessionUserId(request))) return jsonResponse({ error: 'unauthorized' }, 401);
  try {
    var body = await request.json();
    if (!body.image_base64) return jsonResponse({ error: 'image_base64 requerido' }, 400);
    var geminiBody = {
      contents: [{ parts: [
        { text: 'Analiza esta imagen y devuelve SOLO JSON con: tcg (pokemon|funko|magic|yugioh|onepiece|unknown), name, set_name, number, rarity, variant, language, confidence (0-1).' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image_base64 } },
      ]}],
    };
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody),
    });
    var gd = await gr.json();
    var text = (((gd.candidates || [])[0] || {}).content || {});
    text = ((text.parts || [])[0] || {}).text || '';
    var result;
    try { result = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch (e) { return jsonResponse({ error: 'unexpected_response' }, 502); }
    return jsonResponse({ result: result, validated: false });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

// Daily price refresh. Each run takes the cards that were refreshed longest ago, so every card is
// reached in turn even on Cloudflare's free plan (50 subrequests per run: 1 list + 1 prices call + 1 update each).
// market_price = euros (Cardmarket) for the card's variant; tcgplayer_price = dollars (TCGplayer). They are never mixed.
export async function handleCronPrices(limit) {
  var results = [];
  var batch = parseInt(limit, 10) || parseInt(getEnv('PRICE_BATCH'), 10) || 20;
  if (batch > 200) batch = 200;
  try {
    var listed = await sbFetch('/collection_items?tcg=eq.pokemon&card_id=not.is.null&select=id,card_id,variant&order=updated_at.asc&limit=' + batch);
    var items = Array.isArray(listed.data) ? listed.data : [];
    var headers = { 'Content-Type': 'application/json' };
    var apiKey = getEnv('VITE_POKEMONTCG_API_KEY');
    if (apiKey) headers['X-Api-Key'] = apiKey;

    // one request for all the cards of the batch
    var ids = [];
    for (var i = 0; i < items.length; i++) { var cid = esc(items[i].card_id); if (cid && ids.indexOf(cid) < 0) ids.push(cid); }
    var byId = {};
    var apiOk = false;
    if (ids.length) {
      var q = ids.map(function(x) { return 'id:"' + x + '"'; }).join(' OR ');
      var r = await fetch('https://api.pokemontcg.io/v2/cards?q=' + encodeURIComponent(q) + '&pageSize=250&select=id,cardmarket,tcgplayer', { headers: headers });
      if (r.ok) {
        apiOk = true;
        var d = await r.json();
        var list = (d && d.data) || [];
        for (var k = 0; k < list.length; k++) byId[list[k].id] = list[k];
      }
    }

    var updated = 0, noPrice = 0, failed = 0;
    for (var j = 0; j < items.length && apiOk; j++) {
      var item = items[j];
      var card = byId[item.card_id];
      var patch = { updated_at: new Date().toISOString() }; // touched either way, so the next run reaches other cards
      if (card) {
        var eur = cardmarketEur(card, item.variant);
        var usd = tcgplayerUsd(card, item.variant);
        if (eur !== null) patch.market_price = eur;
        if (usd !== null) patch.tcgplayer_price = usd;
        patch.currency = 'EUR';
        if (eur === null && usd === null) noPrice++; else updated++;
      } else { noPrice++; }
      var pr = await sbFetch('/collection_items?id=eq.' + item.id, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
      if (!pr.ok) failed++;
    }
    results.push({ tcg: 'pokemon', batch: items.length, updated: updated, no_price: noPrice, failed: failed, api_ok: apiOk });
    await sbFetch('/marketplace_listings?status=eq.active&expires_at=lt.' + new Date().toISOString(), { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' });
    results.push({ task: 'marketplace_expire', ok: true });
  } catch(e) { results.push({ error: e.message }); }
  return results;
}
