import type { UserLegoSet } from './types';

/**
 * Display name per owned copy: the plain set number, or "75192-1 #2" when the same set is owned
 * more than once. Copies are numbered oldest first, as in the list on the set page.
 */
export function copyLabels(sets: UserLegoSet[]): Map<string, string> {
  const bySet = new Map<string, UserLegoSet[]>();
  for (const s of sets) bySet.set(s.set_num, [...(bySet.get(s.set_num) ?? []), s]);
  const out = new Map<string, string>();
  for (const [num, list] of bySet) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    sorted.forEach((c, i) => out.set(c.id, sorted.length > 1 ? `${num} #${i + 1}` : num));
  }
  return out;
}
