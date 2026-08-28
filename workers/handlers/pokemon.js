// ── POKEMON handlers ──────────────────────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';
import { sbFetch } from '../lib/supabase.js';

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

export async function handleVision(request) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
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
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
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
  try {
    var body = await request.json();
    if (!body.image_base64) return jsonResponse({ error: 'image_base64 requerido' }, 400);
    var geminiBody = {
      contents: [{ parts: [
        { text: 'Analiza esta imagen y devuelve SOLO JSON con: tcg (pokemon|funko|magic|yugioh|onepiece|unknown), name, set_name, number, rarity, variant, language, confidence (0-1).' },
        { inline_data: { mime_type: 'image/jpeg', data: body.image_base64 } },
      ]}],
    };
    var gr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + getEnv('GEMINI_API_KEY'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody),
    });
    var gd = await gr.json();
    var text = (((gd.candidates || [])[0] || {}).content || {});
    text = ((text.parts || [])[0] || {}).text || '';
    var result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return jsonResponse({ result: result, validated: false, scans_remaining: 99 });
  } catch(e) { return jsonResponse({ error: e.message }, 500); }
}

export async function handleCronPrices() {
  var results = [];
  try {
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
              if (price[variants[v]] && price[variants[v]].market) { marketPrice = price[variants[v]].market; break; }
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
    await sbFetch('/marketplace_listings?status=eq.active&expires_at=lt.' + new Date().toISOString(), { method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal' });
    results.push({ task: 'marketplace_expire', ok: true });
  } catch(e) { results.push({ error: e.message }); }
  return results;
}