// ── ONE PIECE handlers ────────────────────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';
import { fetchWithCache } from '../lib/cache.js';
import { searchEbayPrices } from '../lib/ebay.js';

var OP_CACHE_KEY_SET   = 'https://collectiq-cache/onepiece-set-cards';
var OP_CACHE_KEY_ST    = 'https://collectiq-cache/onepiece-st-cards';
var OP_CACHE_KEY_SETS  = 'https://collectiq-cache/onepiece-sets';
var OP_CACHE_KEY_DECKS = 'https://collectiq-cache/onepiece-decks';

function normalizeColor(c) {
  if (!c) return [];
  if (Array.isArray(c)) return c.filter(Boolean);
  if (typeof c === 'string' && c.includes('/')) return c.split('/').map(function(s) { return s.trim(); }).filter(Boolean);
  if (typeof c === 'string') return [c.trim()].filter(Boolean);
  return [];
}

function mapCard(c) {
  var imgUrl = c.image_url || c.card_image || '';
  if (imgUrl && !imgUrl.startsWith('http')) imgUrl = 'https://optcgapi.com' + imgUrl;
  var cardId = c.card_id || c.id || '';
  if (!cardId && imgUrl) {
    var imgMatch = imgUrl.match(/\/([A-Z0-9]+-\d+[a-z]?)\.(?:jpg|png|webp)/i);
    if (imgMatch) cardId = imgMatch[1];
  }
  var setId = c.set_id || '';
  if (!setId && cardId) {
    var m = cardId.match(/^([A-Z]+\d+)-/i);
    if (m) setId = m[1].toUpperCase();
  }
  var priceRaw = c.market_price || c.price || c.tcgplayer_price || null;
  return {
    id: String(cardId), name: c.card_name || c.name || '',
    number: String(cardId), rarity: c.card_rarity || c.rarity || '',
    type: c.card_type || c.type || '', color: normalizeColor(c.card_color || c.color),
    power: c.card_power != null ? c.card_power : (c.power != null ? c.power : null),
    cost: c.card_cost != null ? c.card_cost : (c.cost != null ? c.cost : null),
    counter: c.card_counter != null ? c.card_counter : null,
    attribute: c.card_attribute || c.attribute || '',
    effect: c.card_effect || c.effect || '',
    image_url: imgUrl, image_url_jp: c.image_url_jp || c.card_image_jp || imgUrl,
    set_id: setId, set_name: c.set_name || setId || '',
    price_eur: priceRaw ? parseFloat(priceRaw) : null,
  };
}

async function getAllCards() {
  var results = await Promise.all([
    fetchWithCache(OP_CACHE_KEY_SET, 'https://optcgapi.com/api/allSetCards/').catch(function() { return []; }),
    fetchWithCache(OP_CACHE_KEY_ST,  'https://optcgapi.com/api/allSTCards/').catch(function() { return []; }),
  ]);
  return (results[0] || []).concat(results[1] || []);
}

export async function handleOnePieceCards(request) {
  var url    = new URL(request.url);
  var q      = (url.searchParams.get('q')      || '').toLowerCase().trim();
  var set    = (url.searchParams.get('set')    || '').toUpperCase().trim();
  var lang   = url.searchParams.get('lang')   || 'en';
  var rarity = (url.searchParams.get('rarity') || '').trim();
  var color  = (url.searchParams.get('color')  || '').trim();
  var type   = (url.searchParams.get('type')   || '').trim();
  var page   = Math.max(1, parseInt(url.searchParams.get('page')  || '1') || 1);
  var limit  = Math.min(50, parseInt(url.searchParams.get('limit') || '20') || 20);
  try {
    var allRaw   = await getAllCards();
    var allCards = allRaw.map(mapCard);
    var seen = new Set();
    allCards = allCards.filter(function(c) {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id); return true;
    });
    if (q)      allCards = allCards.filter(function(c) { return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q); });
    if (set)    allCards = allCards.filter(function(c) { return c.set_id.toUpperCase() === set; });
    if (rarity) allCards = allCards.filter(function(c) { return c.rarity === rarity; });
    if (color)  allCards = allCards.filter(function(c) { return c.color.includes(color); });
    if (type)   allCards = allCards.filter(function(c) { return c.type === type; });
    var total     = allCards.length;
    var pageCards = allCards.slice((page - 1) * limit, page * limit);
    if (lang === 'jp') pageCards = pageCards.map(function(c) { return Object.assign({}, c, { image_url: c.image_url_jp || c.image_url }); });
    var colorSet = new Set(); var raritySet = new Set();
    allCards.forEach(function(c) { c.color.forEach(function(col) { colorSet.add(col); }); if (c.rarity) raritySet.add(c.rarity); });
    var availableColors = []; colorSet.forEach(function(c) { availableColors.push(c); }); availableColors.sort();
    var availableRarities = []; raritySet.forEach(function(r) { availableRarities.push(r); });
    return jsonResponse({ cards: pageCards, total: total, page: page, limit: limit, available_colors: availableColors, available_rarities: availableRarities });
  } catch(e) { return jsonResponse({ cards: [], total: 0, error: e.message }); }
}

export async function handleOnePieceSets(request) {
  try {
    var rawSets = await fetchWithCache(OP_CACHE_KEY_SETS, 'https://optcgapi.com/api/allSets/').catch(function() { return []; });
    var sets = (Array.isArray(rawSets) ? rawSets : []).map(function(s) {
      return { id: s.set_id || s.id || '', name: s.set_name || s.name || '', total: s.card_count || s.total || 0, type: 'set' };
    }).filter(function(s) { return s.id; });
    try {
      var decksRaw = await fetchWithCache(OP_CACHE_KEY_DECKS, 'https://optcgapi.com/api/allDecks/');
      (Array.isArray(decksRaw) ? decksRaw : []).forEach(function(d) {
        var id = d.set_id || d.id || '';
        if (!id) return;
        sets.push({ id: id, name: d.set_name || d.name || id, total: d.card_count || d.total || 0, type: 'starter' });
      });
    } catch(e2) {}
    sets.sort(function(a, b) {
      if (a.type !== b.type) return a.type === 'set' ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    return jsonResponse({ sets: sets });
  } catch(e) { return jsonResponse({ sets: [], error: e.message }); }
}

// ── Precios por región ────────────────────────────────────────
// Mapeo idioma → marketplace eBay + términos de búsqueda
var REGION_CONFIG = {
  en: { marketplace: 'EBAY_US', suffix: 'english' },
  jp: { marketplace: 'EBAY_JP', suffix: 'japanese' },
  fr: { marketplace: 'EBAY_FR', suffix: 'french' },
  de: { marketplace: 'EBAY_DE', suffix: 'german' },
  es: { marketplace: 'EBAY_ES', suffix: 'spanish' },
  it: { marketplace: 'EBAY_IT', suffix: 'italian' },
  pt: { marketplace: 'EBAY_US', suffix: 'portuguese' },
  zh: { marketplace: 'EBAY_US', suffix: 'chinese' },
  th: { marketplace: 'EBAY_US', suffix: 'thai' },
};

export async function handleOnePiecePrice(request) {
  var url    = new URL(request.url);
  var name   = url.searchParams.get('name')   || '';
  var number = url.searchParams.get('number') || '';
  var lang   = url.searchParams.get('lang')   || 'en';
  if (!name && !number) return jsonResponse({ error: 'name or number required' }, 400);

  // Para EN primero intentamos optcgapi (más preciso)
  if (lang === 'en') {
    try {
      var allRaw = await getAllCards();
      var allCards = allRaw.map(mapCard);
      var found = allCards.find(function(c) {
        return (number && (c.number === number || c.id === number)) ||
               (name && c.name.toLowerCase() === name.toLowerCase());
      });
      if (found && found.price_eur != null) {
        return jsonResponse({ price: found.price_eur, source: 'optcgapi', currency: 'EUR', lang: lang });
      }
    } catch(e) {}
  }

  // Para todos los idiomas: eBay según región
  var config = REGION_CONFIG[lang] || REGION_CONFIG['en'];
  var query = name + (number ? ' ' + number : '') + ' one piece card game ' + config.suffix;
  try {
    var result = await searchEbayPrices(query, config.marketplace, 500);
    if (!result) return jsonResponse({ price: null, source: 'ebay', lang: lang });
    return jsonResponse(Object.assign({ source: 'ebay', lang: lang }, result));
  } catch(e) {
    return jsonResponse({ error: e.message }, 500);
  }
}