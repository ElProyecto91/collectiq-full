/**
 * Matching a photographed Pokémon card to a catalog card.
 *
 * The vision model only READS what is printed (name, collector number, set total, set code, HP, artist,
 * regulation mark, rarity symbol); it does not decide which catalog card it is. This module turns that
 * reading into catalog queries and scores every candidate on how many printed facts agree, so the answer
 * is a ranked list with an honest confidence, not "the newest card with that name".
 *
 * Pure functions (no network), shared by the scanner page and the tests.
 */
import { rarityTier, tiersForSymbol } from './rarity';

export interface CardRead {
  is_pokemon_card: boolean;
  /** Card name in English (translated if the card is not English). */
  name: string;
  /** Collector number as printed: "044/198", "TG17/TG30", "SWSH001". */
  number: string | null;
  /** The number after the slash, when printed. */
  printed_total: number | null;
  /** Set abbreviation printed next to the number ("PAL", "SVI", "MEW"), not a catalog id. */
  set_code: string | null;
  regulation_mark: string | null;
  hp: number | null;
  types: string[];
  artist: string | null;
  language: string;
  variant: string;
  rarity_symbol: string | null;
  name_confidence: number;
  number_confidence: number;
  variant_confidence: number;
}

export interface MatchCard {
  id: string;
  name: string;
  number: string;
  hp?: string;
  artist?: string;
  regulationMark?: string;
  types?: string[];
  rarity?: string;
  set: { id: string; name: string; printedTotal?: number; total?: number; ptcgoCode?: string; releaseDate?: string };
}

export interface MatchQuery { label: string; q: string; pageSize: number; }
export interface Ranked<T> { card: T; score: number; reasons: string[]; }
export type Confidence = 'high' | 'medium' | 'low';

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s: string | null | undefined) => strip(String(s ?? '')).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Text that is safe inside a quoted q= value of the Pokémon TCG API. */
export const esc = (s: string | null | undefined) => String(s ?? '').replace(/["\\]/g, '').trim();

/** "044/198" -> "44"; "TG17/TG30" -> "TG17"; null when there is no number. */
export function numberKey(n: string | null | undefined): string | null {
  const first = String(n ?? '').split('/')[0].trim().toUpperCase();
  if (!first) return null;
  return first.replace(/^0+(?=\d)/, '') || null;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Levenshtein ratio
  const m = a.length, n = b.length;
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[n] / Math.max(m, n);
}

const isEnglish = (lang: string) => (lang || 'en').toLowerCase() === 'en';

/** The catalog queries to run for a reading, from the most specific to the loosest. */
export function buildQueries(read: CardRead): MatchQuery[] {
  const out: MatchQuery[] = [];
  const key = numberKey(read.number);
  const name = esc(read.name);
  const numClause = key ? `(number:"${key}"${/^\d+$/.test(key) ? ` OR number:"${key.padStart(3, '0')}"` : ''})` : '';
  const en = isEnglish(read.language);
  // number + printed total (+ set code) pin the set; they only mean something for English cards
  if (en && key && read.printed_total) out.push({ label: 'number+total', q: `${numClause} set.printedTotal:${Math.floor(read.printed_total)}`, pageSize: 10 });
  if (en && key && read.set_code) out.push({ label: 'number+setcode', q: `${numClause} set.ptcgoCode:"${esc(read.set_code)}"`, pageSize: 10 });
  if (name && key) out.push({ label: 'name+number', q: `name:"${name}" ${numClause}`, pageSize: 20 });
  if (name) out.push({ label: 'name', q: `name:"${name}"`, pageSize: 40 });
  return out;
}

/** How well a catalog card agrees with the reading (0-100) and why. */
export function scoreCard(read: CardRead, card: MatchCard): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const en = isEnglish(read.language);
  const setFactor = en ? 1 : 0.3; // set-specific facts rarely agree across languages

  const a = norm(read.name), b = norm(card.name);
  if (a && b) {
    const sim = similarity(a, b);
    if (a === b) { score += 35; reasons.push('nombre'); }
    else if (b.includes(a) || a.includes(b)) { score += 20; reasons.push('nombre parecido'); }
    else if (sim >= 0.8) { score += 15; reasons.push('nombre parecido'); }
  }

  const rk = numberKey(read.number), ck = numberKey(card.number);
  if (rk && ck) {
    if (rk === ck) { score += 25 * setFactor; reasons.push('número'); }
    else if (en && read.number_confidence >= 70) score -= 10;
  }
  const printed = card.set.printedTotal ?? card.set.total;
  if (read.printed_total && printed) {
    if (printed === read.printed_total) { score += 15 * setFactor; reasons.push('total del set'); }
    else if (en && read.number_confidence >= 70) score -= 8;
  }
  if (read.set_code && card.set.ptcgoCode && norm(read.set_code) === norm(card.set.ptcgoCode)) { score += 12 * setFactor; reasons.push('código del set'); }

  const hp = card.hp ? Number.parseInt(card.hp, 10) : NaN;
  if (read.hp && Number.isFinite(hp)) { if (hp === read.hp) { score += 6; reasons.push('PS'); } else score -= 4; }
  if (read.artist && card.artist && norm(read.artist) === norm(card.artist)) { score += 8; reasons.push('ilustrador'); }
  if (read.regulation_mark && card.regulationMark && read.regulation_mark.trim().toUpperCase() === card.regulationMark.toUpperCase()) { score += 5; reasons.push('marca de regulación'); }
  if (read.types?.length && card.types?.length && read.types.some((t) => card.types!.some((c) => norm(c) === norm(t)))) score += 3;
  const symbolTiers = tiersForSymbol(read.rarity_symbol);
  if (symbolTiers.length && card.rarity && symbolTiers.includes(rarityTier(card.rarity))) { score += 6; reasons.push('rareza'); }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/** Candidates sorted by score (newest set first on ties); duplicates by id are merged. */
export function rankCards<T extends MatchCard>(read: CardRead, cards: T[]): Ranked<T>[] {
  const seen = new Map<string, T>();
  for (const c of cards) if (!seen.has(c.id)) seen.set(c.id, c);
  return [...seen.values()]
    .map((card) => ({ card, ...scoreCard(read, card) }))
    .sort((x, y) => y.score - x.score || String(y.card.set.releaseDate ?? '').localeCompare(String(x.card.set.releaseDate ?? '')));
}

/**
 * How far to trust the first result. High = it clearly beats the rest (the printed number and set agree);
 * medium = plausible but another print may be the one in the photo; low = ask the user.
 */
export function confidence<T>(ranked: Ranked<T>[]): Confidence {
  if (!ranked.length) return 'low';
  const top = ranked[0].score, second = ranked[1]?.score ?? 0;
  if (top >= 80 && top - second >= 12) return 'high';
  if (top >= 55) return 'medium';
  return 'low';
}
