import { getLegoDb } from '@/lib/turso';
import type {
  LegoColorOption, LegoPartDetail, LegoPartKey, LegoPartSummary,
  LegoSearchParams, LegoSearchResult, LegoSet, LegoSetPart, LegoTheme,
} from '../types';
import {
  LEGO_PAGE_SIZE, allColorsStmt, partColorsStmt, partDetailsStmt, searchPartsStmt,
  searchSetsStmt, setPartsStmt, setStmt, setsByNumsStmt, themesStmt,
  toColorOption, toPartDetail, toPartSummary, toSet, toSetPart, toTheme, type DbRow,
} from './lego-queries';

export { LEGO_PAGE_SIZE };

// Row reads are metered on Turso's free plan, so the catalog is read only through
// the small set of statements in lego-queries.ts.
const run = async (stmt: { sql: string; args: (string | number)[] }): Promise<DbRow[]> =>
  (await getLegoDb().execute(stmt)).rows as unknown as DbRow[];

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
  return (await run(setPartsStmt(setNum))).map(toSetPart);
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
  return (await run(partColorsStmt(partNum))).map(toColorOption);
}

/** Every color, for combinations the catalog has not seen. */
export async function fetchAllColors(): Promise<LegoColorOption[]> {
  return (await run(allColorsStmt())).map(toColorOption);
}

export async function fetchPartDetails(keys: LegoPartKey[]): Promise<LegoPartDetail[]> {
  return inChunks(keys, async (chunk) => (await run(partDetailsStmt(chunk))).map(toPartDetail));
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
