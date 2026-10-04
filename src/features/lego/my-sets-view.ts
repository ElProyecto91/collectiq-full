import type { LegoSet, LegoTheme, UserLegoSet } from './types';

export type SortKey = 'number' | 'year' | 'theme' | 'name' | 'pieces' | 'added' | 'price';
export type GroupKey = 'none' | 'theme' | 'year' | 'status';
export type SortDir = 'asc' | 'desc';

export interface ViewOptions {
  search: string;
  sort: SortKey;
  dir: SortDir;
  group: GroupKey;
}

export interface ViewGroup {
  key: string;
  /** null = the caller supplies the label (unknown / no value). */
  label: string | null;
  items: UserLegoSet[];
}

/** Top-level theme of a theme id (Star Wars for "Star Wars / Episode IV"), or null. */
export function rootTheme(id: number | null, themes: Map<number, LegoTheme>): LegoTheme | null {
  let cur = id === null ? undefined : themes.get(id);
  for (let guard = 0; cur && cur.parent_id !== null && guard < 10; guard++) {
    const parent = themes.get(cur.parent_id);
    if (!parent) break;
    cur = parent;
  }
  return cur ?? null;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const cmpText = (a: string, b: string) => collator.compare(a, b);
/** Missing values always go last, whatever the direction. */
const cmpNullable = <T,>(a: T | null, b: T | null, cmp: (x: T, y: T) => number, dir: number) =>
  a === null || b === null ? (a === null ? (b === null ? 0 : 1) : -1) : cmp(a, b) * dir;

/** "75192-1" sorts by 75192, then by the version; numeric-aware so 9 < 10 < 75192. */
const bySetNum = (a: string, b: string) => cmpText(a, b);

export function buildView(
  mine: UserLegoSet[],
  catalog: Map<string, LegoSet>,
  themes: Map<number, LegoTheme>,
  labels: Map<string, string>,
  o: ViewOptions,
): ViewGroup[] {
  const q = o.search.trim().toLowerCase();
  const items = mine.filter((m) => {
    if (!q) return true;
    const s = catalog.get(m.set_num);
    return m.set_num.toLowerCase().includes(q) || (s?.name ?? '').toLowerCase().includes(q) || (m.notes ?? '').toLowerCase().includes(q);
  });

  const dir = o.dir === 'asc' ? 1 : -1;
  const themeName = (m: UserLegoSet) => rootTheme(catalog.get(m.set_num)?.theme_id ?? null, themes)?.name ?? null;
  const tie = (a: UserLegoSet, b: UserLegoSet) => bySetNum(a.set_num, b.set_num) || (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? '');

  const compare = (a: UserLegoSet, b: UserLegoSet): number => {
    const sa = catalog.get(a.set_num), sb = catalog.get(b.set_num);
    let r = 0;
    switch (o.sort) {
      case 'number': r = bySetNum(a.set_num, b.set_num) * dir; break;
      case 'year': r = cmpNullable(sa?.year ?? null, sb?.year ?? null, (x, y) => x - y, dir); break;
      case 'theme': r = cmpNullable(themeName(a), themeName(b), cmpText, dir); break;
      case 'name': r = cmpNullable(sa?.name ?? null, sb?.name ?? null, cmpText, dir); break;
      case 'pieces': r = cmpNullable(sa?.num_parts ?? null, sb?.num_parts ?? null, (x, y) => x - y, dir); break;
      case 'added': r = a.created_at.localeCompare(b.created_at) * dir; break;
      case 'price': r = cmpNullable(a.price_paid, b.price_paid, (x, y) => x - y, dir); break;
    }
    return r || tie(a, b);
  };
  items.sort(compare);

  if (o.group === 'none') return [{ key: 'all', label: null, items }];

  const groupOf = (m: UserLegoSet): { key: string; label: string | null } => {
    const s = catalog.get(m.set_num);
    if (o.group === 'status') return { key: m.status, label: null };
    if (o.group === 'year') return { key: s?.year != null ? String(s.year) : '', label: s?.year != null ? String(s.year) : null };
    const t = themeName(m);
    return { key: t ?? '', label: t };
  };
  const groups = new Map<string, ViewGroup>();
  for (const m of items) {
    const g = groupOf(m);
    const cur = groups.get(g.key) ?? { key: g.key, label: g.label, items: [] };
    cur.items.push(m);
    groups.set(g.key, cur);
  }
  // groups in the sort direction when the sort is the grouping dimension, otherwise alphabetical/chronological
  const list = [...groups.values()];
  list.sort((a, b) => {
    if (a.key === '' || b.key === '') return a.key === '' ? (b.key === '' ? 0 : 1) : -1; // unknown last
    const r = o.group === 'year' ? Number(a.key) - Number(b.key) : cmpText(a.label ?? a.key, b.label ?? b.key);
    return o.group === 'year' || o.group === 'theme' ? r * (o.sort === 'year' || o.sort === 'theme' ? dir : 1) : r;
  });
  return list;
}
