// ── MAGIC / YUGIOH / LORCANA handlers ────────────────────────
import { jsonResponse, getEnv } from '../lib/cors.js';

async function apitcgCards(tcg, request) {
  var url = new URL(request.url);
  var q = url.searchParams.get('q') || '';
  var set = url.searchParams.get('set') || '';
  var page = parseInt(url.searchParams.get('page') || '1') || 1;
  try {
    var apiUrl = 'https://api.apitcg.com/api/products?tcg=' + tcg + '&type=card&limit=20&page=' + page;
    if (q) apiUrl += '&name=' + encodeURIComponent(q);
    if (set) apiUrl += '&set=' + encodeURIComponent(set);
    var r = await fetch(apiUrl, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return jsonResponse({ cards: [], total: 0 });
    var data = await r.json();
    return data;
  } catch(e) { return null; }
}

async function apitcgSets(tcg) {
  var limit = tcg === 'lorcana' ? 100 : 200;
  try {
    var r = await fetch('https://api.apitcg.com/api/sets?tcg=' + tcg + '&limit=' + limit, { headers: { 'x-api-key': getEnv('APITCG_API_KEY') } });
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

export async function handleMagicCards(request) {
  var data = await apitcgCards('magic', request);
  if (!data) return jsonResponse({ cards: [], total: 0 });
  var items = data.data || data.results || [];
  var cards = items.map(function(c) {
    var images = c.images || {}; var attrs = c.attributes || {};
    return { id: String(c._id || c.id || ''), name: c.name || '', number: attrs.Number || '', rarity: attrs.Rarity || '', type: attrs.Type || '', mana_cost: attrs.ManaCost || '', image_url: images.small || images.large || images.full || '', set_id: (c.set || {})._id || (c.set || {}).id || '', set_name: (c.set || {}).name || '' };
  });
  return jsonResponse({ cards: cards, total: data.total || cards.length });
}

export async function handleMagicSets(request) {
  var data = await apitcgSets('magic');
  if (!data) return jsonResponse({ sets: [] });
  return jsonResponse({ sets: (data.data || []).map(function(s) { return { id: s._id || s.id, name: s.name, total: s.total || 0 }; }) });
}

export async function handleYugiohCards(request) {
  var data = await apitcgCards('yugioh', request);
  if (!data) return jsonResponse({ cards: [], total: 0 });
  var items = data.data || data.results || [];
  var cards = items.map(function(c) {
    var images = c.images || {}; var attrs = c.attributes || {};
    return { id: String(c._id || c.id || ''), name: c.name || '', number: attrs.Number || attrs.CardNumber || '', rarity: attrs.Rarity || '', type: attrs.Type || attrs.MonsterType || '', attribute: attrs.Attribute || '', atk: attrs.ATK || null, def: attrs.DEF || null, level: attrs.Level || null, image_url: images.small || images.large || images.full || '', set_id: (c.set || {})._id || (c.set || {}).id || '', set_name: (c.set || {}).name || '' };
  });
  return jsonResponse({ cards: cards, total: data.total || cards.length });
}

export async function handleYugiohSets(request) {
  var data = await apitcgSets('yugioh');
  if (!data) return jsonResponse({ sets: [] });
  return jsonResponse({ sets: (data.data || []).map(function(s) { return { id: s._id || s.id, name: s.name, total: s.total || 0 }; }) });
}

export async function handleLorcanaCards(request) {
  var data = await apitcgCards('lorcana', request);
  if (!data) return jsonResponse({ cards: [], total: 0 });
  var items = data.data || data.results || [];
  var cards = items.map(function(c) {
    var images = c.images || {}; var attrs = c.attributes || {};
    return { id: String(c._id || c.id || ''), name: c.name || '', number: attrs.Number || '', rarity: attrs.Rarity || '', type: attrs.Type || '', ink: attrs.Ink || attrs.Color || '', cost: attrs.Cost || null, image_url: images.small || images.large || images.full || '', set_id: (c.set || {})._id || (c.set || {}).id || '', set_name: (c.set || {}).name || '' };
  });
  return jsonResponse({ cards: cards, total: data.total || cards.length });
}

export async function handleLorcanaSets(request) {
  var data = await apitcgSets('lorcana');
  if (!data) return jsonResponse({ sets: [] });
  return jsonResponse({ sets: (data.data || []).map(function(s) { return { id: s._id || s.id, name: s.name, total: s.total || 0 }; }) });
}