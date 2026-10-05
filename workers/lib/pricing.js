// ── Card prices (ES5 copy of src/lib/card-pricing.ts — keep both in step) ─────
// market_price is ALWAYS euros (Cardmarket) and follows the variant the collector owns;
// TCGplayer prices are dollars and go to their own column.

export function normalizeVariant(raw) {
  var v = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!v) return 'normal';
  if (v === 'holofoil' || v === 'holo' || v === 'fullart' || v === 'secretrare') return 'holofoil';
  if (v === 'reverseholofoil' || v === 'reverseholo') return 'reverseHolofoil';
  if (v === 'firstedition' || v === '1stedition') return 'firstEdition';
  if (v === 'promo') return 'promo';
  return 'normal';
}

function num(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : null; }
function first() { for (var i = 0; i < arguments.length; i++) { if (arguments[i] !== null) return arguments[i]; } return null; }

export function cardmarketEur(card, variant) {
  var p = card && card.cardmarket && card.cardmarket.prices;
  if (!p) return null;
  var normal = first(num(p.averageSellPrice), num(p.trendPrice), num(p.avg30));
  if (normalizeVariant(variant) === 'reverseHolofoil') {
    return first(num(p.reverseHoloTrend), num(p.reverseHoloSell), num(p.reverseHoloAvg30), normal);
  }
  return normal;
}

var TCGPLAYER_KEYS = {
  normal: ['normal', 'unlimitedNormal', '1stEditionNormal', 'holofoil', 'reverseHolofoil'],
  holofoil: ['holofoil', 'unlimitedHolofoil', '1stEditionHolofoil', 'normal', 'reverseHolofoil'],
  reverseHolofoil: ['reverseHolofoil', 'holofoil', 'normal'],
  firstEdition: ['1stEditionHolofoil', '1stEditionNormal', 'holofoil', 'normal'],
  promo: ['holofoil', 'normal', 'reverseHolofoil'],
};

export function tcgplayerUsd(card, variant) {
  var p = card && card.tcgplayer && card.tcgplayer.prices;
  if (!p) return null;
  var keys = TCGPLAYER_KEYS[normalizeVariant(variant)];
  for (var i = 0; i < keys.length; i++) {
    var m = num(p[keys[i]] && p[keys[i]].market);
    if (m !== null) return m;
  }
  return null;
}
