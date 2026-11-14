/**
 * Sorting of part lists (parts of a set, set progress, loose-parts collection).
 *
 * Every list gives the same few facts about a row (see SortablePart) and picks which keys make sense for
 * it: a set's own part list has no "added" date, the collection has no "missing". Ties always fall back to
 * color name then part number, so the order is stable and predictable whatever the key.
 */
export type PartSortKey = 'color' | 'number' | 'quantity' | 'name' | 'missing' | 'added';
export type SortDir = 'asc' | 'desc';
export interface PartSort { key: PartSortKey; dir: SortDir }

export interface SortablePart {
  part_num: string;
  color_name?: string | null;
  part_name?: string | null;
  quantity: number;
  missing?: number;
  /** ISO date the part entered the collection; rows without one go last. */
  added?: string | null;
}

/** Biggest / newest / most-missing first feels natural; the rest start ascending. */
export const defaultDir = (key: PartSortKey): SortDir =>
  key === 'quantity' || key === 'missing' || key === 'added' ? 'desc' : 'asc';

const text = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' });

/** "3001" < "3001a" < "3002" < "30000": numeric-aware, so 9 < 10 < 100. */
export const comparePartNum = (a: string, b: string) => text(a, b);

function primary(a: SortablePart, b: SortablePart, key: PartSortKey): number {
  switch (key) {
    case 'color': return text(a.color_name, b.color_name);
    case 'number': return comparePartNum(a.part_num, b.part_num);
    case 'quantity': return a.quantity - b.quantity;
    case 'name': return text(a.part_name, b.part_name);
    case 'missing': return (a.missing ?? 0) - (b.missing ?? 0);
    case 'added': return Date.parse(a.added ?? '') - Date.parse(b.added ?? '');
  }
}

export function sortParts<T>(items: T[], get: (item: T) => SortablePart, sort: PartSort): T[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...items].sort((x, y) => {
    const a = get(x), b = get(y);
    if (sort.key === 'added') {
      // undated rows last in both directions
      const da = Number.isNaN(Date.parse(a.added ?? '')), db = Number.isNaN(Date.parse(b.added ?? ''));
      if (da !== db) return da ? 1 : -1;
      if (da && db) return text(a.color_name, b.color_name) || comparePartNum(a.part_num, b.part_num);
    }
    const p = primary(a, b, sort.key);
    if (p !== 0) return p * sign;
    // ties: color, then part number (always ascending)
    return (sort.key === 'color' ? 0 : text(a.color_name, b.color_name)) || comparePartNum(a.part_num, b.part_num);
  });
}
