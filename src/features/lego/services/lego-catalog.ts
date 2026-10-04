import { getLegoDb } from '@/lib/turso';
import type {
  LegoColorOption, LegoPartDetail, LegoPartKey, LegoPartSummary,
  LegoSearchParams, LegoSearchResult, PartSetsResult, LegoSet, LegoSetPart, LegoTheme, PossibleSet, PossibleSetsParams,
} from '../types';
import {
  LEGO_PAGE_SIZE, PART_SETS_PAGE, allColorsStmt, canonStmt, partImagesStmt, setsWithPartStmt, partColorsStmt, partsByNumsStmt, partDetailsStmt, possibleSetsStmt, searchPartsStmt,
  searchSetsStmt, setPartsStmt, setStmt, setsByNumsStmt, themesStmt, weightsStmt,
  toColorOption, toPartDetail, toPartSet, toPartSummary, toPossibleSet, toSet, toSetPart, toTheme, type DbRow,
} from './lego-queries';

export { LEGO_PAGE_SIZE, PART_SETS_PAGE };

// Row reads are metered on Turso's free plan, so the catalog is read only through
// the small set of statements in lego-queries.ts.
const run = async (stmt: { sql: string; args: (string | number)[] }): Promise<DbRow[]> =>
  (await getLegoDb().execute(stmt)).rows as unknown as DbRow[];

// Fallback picture per part (table lego_part_images, filled by the "LEGO part images" workflow).
// The table may not exist yet, so a failure is remembered and the app simply goes on without it.
const partImageCache = new Map<string, string | null>();
let partImagesUnavailable = false;

async function fillPartImages<T extends { part_num: string; img_url: string | null }>(rows: T[]): Promise<T[]> {
  if (partImagesUnavailable) return rows;
  const need = [...new Set(rows.filter((r) => !r.img_url && !partImageCache.has(r.part_num)).map((r) => r.part_num))];
  if (need.length) {
    try {
      for (let i = 0; i < need.length; i += 400) {
        const chunk = need.slice(i, i + 400);
        for (const r of await run(partImagesStmt(chunk))) partImageCache.set(String(r.part_num), r.img_url == null ? null : String(r.img_url));
        for (const n of chunk) if (!partImageCache.has(n)) partImageCache.set(n, null);
      }
    } catch { partImagesUnavailable = true; return rows; }
  }
  return rows.map((r) => (r.img_url ? r : { ...r, img_url: partImageCache.get(r.part_num) ?? null }));
}

export async function fetchThemes(): Promise<LegoTheme[]> {
  return (await run(themesStmt())).map(toTheme);
}

export async function searchSets(p: LegoSearchParams): Promise<LegoSearchResult> {
  const rows = await run(searchSetsStmt(p));
  return { sets: rows.map(toSet), total: rows.length ? Number(rows[0].total) : 0 };
}

export async function fetchSet(setNum: string): Promise<LegoSet | null> {
  const rows = await run(setStmt(setNum));
  return rows.length ? toSet(rows[0]) : null;
}

export async function fetchSetParts(setNum: string): Promise<LegoSetPart[]> {
  return fillPartImages((await run(setPartsStmt(setNum))).map(toSetPart));
}

const CHUNK = 400; // (part, color) pairs / set numbers per statement

async function inChunks<T, R>(items: T[], fn: (chunk: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(...(await fn(items.slice(i, i + CHUNK))));
  return out;
}

export async function searchParts(q: string): Promise<LegoPartSummary[]> {
  if (!q.trim()) return [];
  return (await run(searchPartsStmt(q))).map(toPartSummary);
}

/** Colors this part exists in, according to the catalog. */
export async function fetchPartColors(partNum: string): Promise<LegoColorOption[]> {
  const colors = (await run(partColorsStmt(partNum))).map(toColorOption);
  return (await fillPartImages(colors.map((c) => ({ ...c, part_num: partNum })))).map(({ part_num: _p, ...c }) => c);
}

/** Every color, for combinations the catalog has not seen. */
export async function fetchAllColors(): Promise<LegoColorOption[]> {
  return (await run(allColorsStmt())).map(toColorOption);
}

export async function fetchPartDetails(keys: LegoPartKey[]): Promise<LegoPartDetail[]> {
  return fillPartImages(await inChunks(keys, async (chunk) => (await run(partDetailsStmt(chunk))).map(toPartDetail)));
}

export async function fetchSetsByNums(setNums: string[]): Promise<LegoSet[]> {
  const unique = [...new Set(setNums)];
  return inChunks(unique, async (chunk) => (await run(setsByNumsStmt(chunk))).map(toSet));
}

// Part details never change while the app is open, so each (part, color) is resolved once.
// This keeps Turso row reads proportional to NEW pieces, not to the whole inventory.
const detailCache = new Map<string, LegoPartDetail>();
const detailKey = (k: LegoPartKey) => `${k.part_num}|${k.color_id}`;

export async function fetchPartDetailsCached(keys: LegoPartKey[]): Promise<Map<string, LegoPartDetail>> {
  const missing = keys.filter((k) => !detailCache.has(detailKey(k)));
  if (missing.length) {
    for (const d of await fetchPartDetails(missing)) detailCache.set(detailKey(d), d);
  }
  // a fresh Map each time: React memoizes on identity, so returning the cache itself would
  // leave a list showing raw part numbers after new details arrive
  return new Map(detailCache);
}

export async function fetchPossibleSets(p: PossibleSetsParams): Promise<PossibleSet[]> {
  if (p.inventory.length === 0) return [];
  return (await run(possibleSetsStmt(p))).map(toPossibleSet);
}

/** part -> canonical mold group, for the given parts (parts that are their own canon are absent). */
export async function fetchCanonMap(partNums: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(partNums)];
  const rows = await inChunks(unique, async (chunk) => await run(canonStmt(chunk)));
  return new Map(rows.map((r) => [String(r.part_num), String(r.canon_part_num)]));
}

/** "canon|color" -> rarity weight. Empty when the derived tables were not imported yet. */
export async function fetchWeights(keys: LegoPartKey[]): Promise<Map<string, number>> {
  const rows = await inChunks(keys, async (chunk) => await run(weightsStmt(chunk)));
  return new Map(rows.map((r) => [`${r.part_num}|${r.color_id}`, Number(r.weight)]));
}

/** Which of these part numbers exist in the catalog (exact match). */
export async function fetchPartsByNums(nums: string[]): Promise<Map<string, LegoPartSummary>> {
  const unique = [...new Set(nums.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await inChunks(unique, async (chunk) => (await run(partsByNumsStmt(chunk))).map(toPartSummary));
  return new Map(rows.map((r) => [r.part_num, r]));
}

/** Sets that contain this part in this color (most pieces first), one page at a time. */
export async function fetchSetsWithPart(partNum: string, colorId: number, page: number): Promise<PartSetsResult> {
  const rows = await run(setsWithPartStmt(partNum, colorId, page));
  return { sets: rows.map(toPartSet), total: rows.length ? Number(rows[0].total) : 0 };
}
