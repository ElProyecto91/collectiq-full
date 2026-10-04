import type { LegoPartSummary } from './types';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Picks the catalog part that matches a recognized part by NAME, for when its number is not a
 * Rebrickable number (Brickognize usually answers with BrickLink numbers). Exact name first; then a
 * name that contains the other one. Returns null when nothing is close enough: the user then searches by hand.
 */
export function matchByName(name: string, results: LegoPartSummary[]): LegoPartSummary | null {
  const n = norm(name);
  if (n.length < 6) return null;
  const exact = results.find((r) => norm(r.name) === n);
  if (exact) return exact;
  const partial = results.filter((r) => { const m = norm(r.name); return m.includes(n) || (m.length >= 12 && n.includes(m)); });
  return partial.length === 1 ? partial[0] : null; // several partial matches = ambiguous
}
