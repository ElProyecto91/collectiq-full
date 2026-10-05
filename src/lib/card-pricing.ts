/**
 * Card prices, one place.
 *
 * - The money the app shows and adds up (`market_price`) is ALWAYS euros, from Cardmarket. TCGplayer
 *   prices are dollars and live in their own field (`tcgplayer_price`); the two are never mixed.
 * - The price follows the variant the collector owns (normal / holo / reverse holo / 1st edition).
 *
 * The Worker's cron has an ES5 copy of this logic (workers/lib/pricing.js); keep them in step (a test
 * runs both on the same cards).
 */
export type CanonicalVariant = 'normal' | 'holofoil' | 'reverseHolofoil' | 'firstEdition' | 'promo';

type PriceBlock = { market?: number | null };
export interface PricedCard {
  cardmarket?: { prices?: Record<string, number | null | undefined> } | null;
  tcgplayer?: { prices?: Record<string, PriceBlock | undefined> } | null;
}

/** App variants, plus the names the scanner's recognizer and old rows use. */
export function normalizeVariant(raw: string | null | undefined): CanonicalVariant {
  const v = (raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!v) return 'normal';
  if (v === 'holofoil' || v === 'holo' || v === 'fullart' || v === 'secretrare') return 'holofoil';
  if (v === 'reverseholofoil' || v === 'reverseholo') return 'reverseHolofoil';
  if (v === 'firstedition' || v === '1stedition') return 'firstEdition';
  if (v === 'promo') return 'promo';
  return 'normal';
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Euros, from Cardmarket. Reverse holo uses its own price; if the card has none, the normal one. */
export function cardmarketEur(card: PricedCard, variant: string | null | undefined): number | null {
  const p = card.cardmarket?.prices;
  if (!p) return null;
  const normal = num(p.averageSellPrice) ?? num(p.trendPrice) ?? num(p.avg30);
  if (normalizeVariant(variant) === 'reverseHolofoil') {
    return num(p.reverseHoloTrend) ?? num(p.reverseHoloSell) ?? num(p.reverseHoloAvg30) ?? normal;
  }
  return normal;
}

const TCGPLAYER_KEYS: Record<CanonicalVariant, string[]> = {
  normal: ['normal', 'unlimitedNormal', '1stEditionNormal', 'holofoil', 'reverseHolofoil'],
  holofoil: ['holofoil', 'unlimitedHolofoil', '1stEditionHolofoil', 'normal', 'reverseHolofoil'],
  reverseHolofoil: ['reverseHolofoil', 'holofoil', 'normal'],
  firstEdition: ['1stEditionHolofoil', '1stEditionNormal', 'holofoil', 'normal'],
  promo: ['holofoil', 'normal', 'reverseHolofoil'],
};

/** Dollars, from TCGplayer, for the variant (the first variant the card actually has a price for). */
export function tcgplayerUsd(card: PricedCard, variant: string | null | undefined): number | null {
  const p = card.tcgplayer?.prices;
  if (!p) return null;
  for (const key of TCGPLAYER_KEYS[normalizeVariant(variant)]) {
    const m = num(p[key]?.market);
    if (m !== null) return m;
  }
  return null;
}

/** What to store when a card is added: euros in market_price, dollars apart, currency fixed to EUR. */
export function pricesForCollection(card: PricedCard, variant: string | null | undefined) {
  return { marketPrice: cardmarketEur(card, variant), tcgplayerPrice: tcgplayerUsd(card, variant), currency: 'EUR' as const };
}

/**
 * Euro price to show for a variant in a picker. Cardmarket has one price per card (plus reverse holo),
 * so a variant is priced only when the card exists in it (TCGplayer lists the variants a card has).
 */
export function variantPriceEur(card: PricedCard, variant: string | null | undefined): number | null {
  const v = normalizeVariant(variant);
  const listed = Object.keys(card.tcgplayer?.prices ?? {});
  const has = (...keys: string[]) => keys.some((k) => listed.includes(k));
  if (listed.length === 0) return v === 'normal' || v === 'holofoil' ? cardmarketEur(card, v) : null;
  if (v === 'normal' && has('normal', 'unlimitedNormal')) return cardmarketEur(card, v);
  if (v === 'holofoil' && has('holofoil', 'unlimitedHolofoil')) return cardmarketEur(card, v);
  if (v === 'reverseHolofoil' && has('reverseHolofoil')) return cardmarketEur(card, v);
  return null;
}
