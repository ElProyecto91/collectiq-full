/**
 * Pokémon TCG rarities.
 *
 * The Pokémon TCG API returns the rarity as free text ("Rare Holo VMAX", "Special Illustration Rare"...),
 * and every few years a set adds names. This module groups them into a short, ordered list of tiers
 * the app can sort, filter and color, and falls back to keywords for names it has never seen.
 *
 * Sources: the API's own rarity list (docs.pokemontcg.io), Pokémon's Scarlet & Violet rarity-symbol
 * announcement (pokemon.com) and the Black Bolt / White Flare set guides (Black White Rare).
 */
export type RarityTier =
  | 'common' | 'uncommon' | 'rare' | 'holo' | 'featured' | 'ultra' | 'shiny'
  | 'illustration' | 'special_illustration' | 'secret' | 'promo' | 'unknown';

export interface RarityInfo {
  tier: RarityTier;
  /** Higher is rarer; use it to sort. 0 = unknown. */
  order: number;
  /** What the card prints, as text (● circle, ◆ diamond, ★ star ...). */
  symbol: string;
  labelEs: string;
  labelEn: string;
  /** One line that says what the tier covers (for a legend or tooltip). */
  hintEs: string;
  /** Tailwind classes: text color and a soft background + border for a badge. */
  text: string;
  badge: string;
}

export const RARITY_TIERS: Record<RarityTier, RarityInfo> = {
  common: { tier: 'common', order: 10, symbol: '●', labelEs: 'Común', labelEn: 'Common', hintEs: 'Círculo negro', text: 'text-gray-400', badge: 'text-gray-300 bg-white/5 border-white/10' },
  uncommon: { tier: 'uncommon', order: 20, symbol: '◆', labelEs: 'Infrecuente', labelEn: 'Uncommon', hintEs: 'Rombo negro', text: 'text-emerald-400', badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  rare: { tier: 'rare', order: 30, symbol: '★', labelEs: 'Rara', labelEn: 'Rare', hintEs: 'Estrella negra', text: 'text-blue-400', badge: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
  holo: { tier: 'holo', order: 40, symbol: '★', labelEs: 'Rara Holo', labelEn: 'Holo Rare', hintEs: 'Estrella negra con ilustración holográfica', text: 'text-cyan-400', badge: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  featured: { tier: 'featured', order: 50, symbol: '★★', labelEs: 'Destacada (ex / V / GX…)', labelEn: 'Featured (ex / V / GX…)', hintEs: 'Doble Rara, EX, GX, V, VMAX, VSTAR, BREAK, Prisma, ACE SPEC, Radiante', text: 'text-indigo-400', badge: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  ultra: { tier: 'ultra', order: 60, symbol: '☆☆', labelEs: 'Ultra Rara', labelEn: 'Ultra Rare', hintEs: 'Dos estrellas plateadas, arte completo', text: 'text-purple-400', badge: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
  shiny: { tier: 'shiny', order: 65, symbol: '✦', labelEs: 'Variocolor (Shiny)', labelEn: 'Shiny', hintEs: 'Pokémon variocolor', text: 'text-pink-400', badge: 'text-pink-300 bg-pink-500/10 border-pink-500/20' },
  illustration: { tier: 'illustration', order: 70, symbol: '☆', labelEs: 'Ilustración Rara', labelEn: 'Illustration Rare', hintEs: 'Una estrella dorada, arte alternativo', text: 'text-amber-400', badge: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  special_illustration: { tier: 'special_illustration', order: 80, symbol: '☆☆', labelEs: 'Ilustración Especial Rara', labelEn: 'Special Illustration Rare', hintEs: 'Dos estrellas doradas, arte alternativo de ex o entrenador', text: 'text-orange-400', badge: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
  secret: { tier: 'secret', order: 90, symbol: '☆☆☆', labelEs: 'Secreta / Hiperrara', labelEn: 'Secret / Hyper Rare', hintEs: 'Tres estrellas doradas, arcoíris, Negro y Blanco', text: 'text-yellow-300', badge: 'text-yellow-200 bg-yellow-500/10 border-yellow-500/30' },
  promo: { tier: 'promo', order: 5, symbol: 'P', labelEs: 'Promo', labelEn: 'Promo', hintEs: 'Carta promocional', text: 'text-gray-400', badge: 'text-gray-300 bg-white/5 border-white/10' },
  unknown: { tier: 'unknown', order: 0, symbol: '', labelEs: 'Sin rareza', labelEn: 'No rarity', hintEs: '', text: 'text-gray-500', badge: 'text-gray-400 bg-white/5 border-white/10' },
};

/** Tiers from the most common to the rarest (promo and unknown excluded): the order of a filter row. */
export const RARITY_TIER_ORDER: RarityTier[] = ['common', 'uncommon', 'rare', 'holo', 'featured', 'ultra', 'shiny', 'illustration', 'special_illustration', 'secret', 'promo'];

/** The rarity names the API is known to return, per tier (used to filter by tier in an API query). */
export const API_RARITIES_BY_TIER: Record<Exclude<RarityTier, 'unknown'>, string[]> = {
  common: ['Common'],
  uncommon: ['Uncommon'],
  rare: ['Rare'],
  holo: ['Rare Holo', 'Rare Holo LV.X', 'Rare Holo Star', 'Rare Prime', 'LEGEND'],
  featured: ['Double Rare', 'Rare Holo EX', 'Rare Holo GX', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR', 'Rare BREAK', 'Rare Prism Star', 'Rare ACE', 'ACE SPEC Rare', 'Radiant Rare', 'Amazing Rare'],
  ultra: ['Ultra Rare', 'Rare Ultra', 'Trainer Gallery Rare Holo'],
  shiny: ['Shiny Rare', 'Shiny Ultra Rare', 'Rare Shiny', 'Rare Shiny GX', 'Rare Shining'],
  illustration: ['Illustration Rare'],
  special_illustration: ['Special Illustration Rare'],
  secret: ['Hyper Rare', 'Rare Secret', 'Rare Rainbow', 'Black White Rare'],
  promo: ['Promo'],
};

const EXACT = new Map<string, RarityTier>();
for (const [tier, names] of Object.entries(API_RARITIES_BY_TIER)) for (const n of names) EXACT.set(n.toLowerCase(), tier as RarityTier);

/** The tier of a rarity text, from the exact API names first and by keywords for anything new. */
export function rarityTier(raw: string | null | undefined): RarityTier {
  const r = (raw ?? '').trim().toLowerCase();
  if (!r) return 'unknown';
  const exact = EXACT.get(r);
  if (exact) return exact;
  // keywords, most specific first: a name the API adds later still lands in a sensible tier
  if (r.includes('special illustration')) return 'special_illustration';
  if (r.includes('illustration')) return 'illustration';
  if (/(hyper|secret|rainbow|black white|black & white|\bbwr\b|gold)/.test(r)) return 'secret';
  if (/(shiny|shining|variocolor)/.test(r)) return 'shiny';
  if (/(ultra|trainer gallery|full art|\bsar\b)/.test(r)) return 'ultra';
  if (/(double|\bex\b|\bgx\b|\bvmax\b|\bvstar\b|\bv\b|break|prism|\bace\b|radiant|amazing|legend)/.test(r)) return 'featured';
  if (r.includes('promo')) return 'promo';
  if (r.includes('holo')) return 'holo';
  if (r.includes('uncommon')) return 'uncommon';
  if (r.includes('common')) return 'common';
  if (r.includes('rare')) return 'rare';
  return 'unknown';
}

export function rarityInfo(raw: string | null | undefined): RarityInfo {
  return RARITY_TIERS[rarityTier(raw)];
}

/** Compare two rarity texts, rarest first when used with sort(). */
export function compareRarityDesc(a: string | null | undefined, b: string | null | undefined): number {
  return rarityInfo(b).order - rarityInfo(a).order;
}

/**
 * Tiers a printed rarity symbol can mean, for matching a photo to a card. The symbol alone does not
 * separate "Rare" from "Rare Holo" (same star), so a star allows both.
 */
export function tiersForSymbol(symbol: string | null | undefined): RarityTier[] {
  switch ((symbol ?? '').toLowerCase()) {
    case 'circle': case 'common': return ['common'];
    case 'diamond': case 'uncommon': return ['uncommon'];
    case 'star': case 'black_star': return ['rare', 'holo', 'featured'];
    case 'two_black_stars': case 'double_star': return ['featured'];
    case 'two_silver_stars': case 'silver_stars': return ['ultra'];
    case 'gold_star': return ['illustration'];
    case 'two_gold_stars': return ['special_illustration'];
    case 'three_gold_stars': return ['secret'];
    default: return [];
  }
}

/** A rarity text in the user's language; the original text stays available for tooltips. */
export function rarityLabel(raw: string | null | undefined, lang: 'es' | 'en' = 'es'): string {
  const info = rarityInfo(raw);
  if (info.tier === 'unknown') return raw?.trim() || (lang === 'es' ? info.labelEs : info.labelEn);
  return lang === 'es' ? info.labelEs : info.labelEn;
}
