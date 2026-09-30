import { getLegoDb } from '@/lib/turso';
import type { LegoSearchParams, LegoSearchResult, LegoSet, LegoSetPart, LegoTheme } from '../types';
import {
  LEGO_PAGE_SIZE, searchSetsStmt, setPartsStmt, setStmt, themesStmt,
  toSet, toSetPart, toTheme, type DbRow,
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
