import type { LegoPartItem, LegoSetPart, ProgressRow, SetProgress } from '../types';

/**
 * What the inventory covers of one set, with interchangeable molds merged.
 *
 * `canon` maps a part number to its canonical mold group (parts that are not in the map are
 * their own canon) and `weights` maps "canon|color" to its rarity weight. Spare parts of the
 * set are ignored. Same rules as the ranking query, so both screens agree.
 */
export function computeProgress(
  parts: LegoSetPart[],
  inventory: LegoPartItem[],
  canon: Map<string, string>,
  weights: Map<string, number>
): SetProgress {
  const canonOf = (p: string) => canon.get(p) ?? p;

  const have = new Map<string, number>();
  for (const it of inventory) {
    if (!(it.quantity > 0)) continue;
    const k = `${canonOf(it.part_num)}|${it.color_id}`;
    have.set(k, (have.get(k) ?? 0) + it.quantity);
  }

  const groups = new Map<string, ProgressRow>();
  for (const p of parts) {
    if (p.is_spare) continue;
    const k = `${canonOf(p.part_num)}|${p.color_id}`;
    const g = groups.get(k);
    if (g) g.need += p.quantity;
    else groups.set(k, { key: k, part: p, need: p.quantity, have: 0, covered: 0, missing: 0 });
  }

  let total = 0, covered = 0, wNeed = 0, wCov = 0, anyWeight = false;
  for (const [k, g] of groups) {
    g.have = have.get(k) ?? 0;
    g.covered = Math.min(g.need, g.have);
    g.missing = g.need - g.covered;
    total += g.need; covered += g.covered;
    const w = weights.get(k);
    if (w !== undefined) { anyWeight = true; wNeed += g.need * w; wCov += g.covered * w; }
  }

  return {
    rows: [...groups.values()],
    total, covered,
    pct: total ? covered / total : 0,
    wpct: anyWeight && wNeed > 0 ? Math.min(1, wCov / wNeed) : null,
  };
}
