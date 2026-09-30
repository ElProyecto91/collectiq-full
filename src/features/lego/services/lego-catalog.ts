import { getSupabase } from '@/lib/supabase';
import type {
  LegoSearchParams, LegoSearchResult, LegoSet, LegoSetPart, LegoTheme,
} from '../types';

export const LEGO_PAGE_SIZE = 24;
const SET_COLUMNS = 'set_num,name,year,theme_id,num_parts,img_url';
// Supabase caps a response at 1000 rows by default, so parts are paged.
const PARTS_PAGE = 1000;

/** Strip characters that have meaning inside a PostgREST filter string. */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchThemes(): Promise<LegoTheme[]> {
  const { data, error } = await getSupabase()
    .from('lego_themes')
    .select('id,name,parent_id')
    .order('name');
  if (error) throw error;
  return (data ?? []) as LegoTheme[];
}

/** A theme plus all of its descendants (Rebrickable themes are a tree). */
export function themeWithDescendants(themes: LegoTheme[], rootId: number): number[] {
  const children = new Map<number, number[]>();
  for (const t of themes) {
    if (t.parent_id === null) continue;
    const list = children.get(t.parent_id) ?? [];
    list.push(t.id);
    children.set(t.parent_id, list);
  }
  const out: number[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.includes(id)) continue;
    out.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export async function searchSets(p: LegoSearchParams): Promise<LegoSearchResult> {
  let query = getSupabase()
    .from('lego_sets')
    .select(SET_COLUMNS, { count: 'exact' });

  const q = sanitize(p.q);
  if (q) query = query.or(`name.ilike.%${q}%,set_num.ilike.${q}%`);
  if (p.themeIds.length) query = query.in('theme_id', p.themeIds);
  if (p.yearFrom !== null) query = query.gte('year', p.yearFrom);
  if (p.yearTo !== null) query = query.lte('year', p.yearTo);

  const from = p.page * LEGO_PAGE_SIZE;
  const { data, error, count } = await query
    .order('year', { ascending: false, nullsFirst: false })
    .order('set_num')
    .range(from, from + LEGO_PAGE_SIZE - 1);
  if (error) throw error;
  return { sets: (data ?? []) as LegoSet[], total: count ?? 0 };
}

export async function fetchSet(setNum: string): Promise<LegoSet | null> {
  const { data, error } = await getSupabase()
    .from('lego_sets')
    .select(SET_COLUMNS)
    .eq('set_num', setNum)
    .maybeSingle();
  if (error) throw error;
  return (data as LegoSet | null) ?? null;
}

export async function fetchSetParts(setNum: string): Promise<LegoSetPart[]> {
  const all: LegoSetPart[] = [];
  for (let from = 0; ; from += PARTS_PAGE) {
    const { data, error } = await getSupabase()
      .from('lego_set_parts_full')
      .select('set_num,part_num,color_id,quantity,is_spare,part_name,color_name,color_rgb,color_is_trans,img_url')
      .eq('set_num', setNum)
      .order('color_id')
      .order('part_num')
      .order('is_spare') // with the two above this is the full key, so paging is stable
      .range(from, from + PARTS_PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as LegoSetPart[];
    all.push(...rows);
    if (rows.length < PARTS_PAGE) break;
  }
  return all;
}
