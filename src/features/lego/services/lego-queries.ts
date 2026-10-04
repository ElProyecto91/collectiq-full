import type {
  PartSet, LegoColorOption, LegoPartDetail, LegoPartKey, LegoPartSummary,
  LegoSearchParams, LegoSet, LegoSetPart, LegoTheme, PossibleSet, PossibleSetsParams,
} from '../types';

/**
 * SQL for the LEGO catalog (SQLite / libSQL). Kept free of app imports so the same
 * statements can be exercised against a plain SQLite file in tests.
 */
export interface Stmt {
  sql: string;
  args: (string | number)[];
}
export type DbRow = Record<string, unknown>;

export const LEGO_PAGE_SIZE = 24;

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);

export function themesStmt(): Stmt {
  return { sql: 'SELECT id, name, parent_id FROM lego_themes ORDER BY name', args: [] };
}

export function searchSetsStmt(p: LegoSearchParams): Stmt {
  const where: string[] = [];
  const args: (string | number)[] = [];

  const q = p.q.trim();
  if (q) {
    where.push(`(name LIKE ? ESCAPE '\\' OR set_num LIKE ? ESCAPE '\\')`);
    args.push(`%${escapeLike(q)}%`, `${escapeLike(q)}%`);
  }
  if (p.themeId !== null) {
    // the theme plus all its descendants (Rebrickable themes are a tree)
    where.push(
      `theme_id IN (WITH RECURSIVE t(id) AS (SELECT ? UNION ALL ` +
        `SELECT th.id FROM lego_themes th JOIN t ON th.parent_id = t.id) SELECT id FROM t)`
    );
    args.push(p.themeId);
  }
  if (p.yearFrom !== null) { where.push('year >= ?'); args.push(p.yearFrom); }
  if (p.yearTo !== null) { where.push('year <= ?'); args.push(p.yearTo); }

  args.push(LEGO_PAGE_SIZE, p.page * LEGO_PAGE_SIZE);
  return {
    // COUNT(*) OVER () gives the total in the same scan (row reads are metered)
    sql:
      'SELECT set_num, name, year, theme_id, num_parts, img_url, COUNT(*) OVER () AS total ' +
      'FROM lego_sets' +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY year DESC, set_num LIMIT ? OFFSET ?',
    args,
  };
}

export function setStmt(setNum: string): Stmt {
  return {
    sql: 'SELECT set_num, name, year, theme_id, num_parts, img_url FROM lego_sets WHERE set_num = ?',
    args: [setNum],
  };
}

export function setPartsStmt(setNum: string): Stmt {
  return {
    sql:
      'SELECT sp.set_num, sp.part_num, sp.color_id, sp.quantity, sp.is_spare, ' +
      'p.name AS part_name, c.name AS color_name, c.rgb AS color_rgb, c.is_trans AS color_is_trans, pc.img_url ' +
      'FROM lego_set_parts sp ' +
      'JOIN lego_parts p ON p.part_num = sp.part_num ' +
      'JOIN lego_colors c ON c.id = sp.color_id ' +
      'JOIN lego_part_colors pc ON pc.part_num = sp.part_num AND pc.color_id = sp.color_id ' +
      'WHERE sp.set_num = ? ORDER BY sp.color_id, sp.part_num, sp.is_spare',
    args: [setNum],
  };
}

export function searchPartsStmt(q: string): Stmt {
  const t = q.trim();
  const like = escapeLike(t);
  return {
    // exact part number first, then prefix matches (shortest first), then the rest
    sql:
      `SELECT part_num, name FROM lego_parts ` +
      `WHERE part_num LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' ` +
      `ORDER BY (part_num = ?) DESC, (part_num LIKE ? ESCAPE '\\') DESC, length(part_num), part_num LIMIT 30`,
    args: [`${like}%`, `%${like}%`, t, `${like}%`],
  };
}

export function partColorsStmt(partNum: string): Stmt {
  return {
    sql:
      'SELECT pc.color_id, c.name, c.rgb, c.is_trans, pc.img_url ' +
      'FROM lego_part_colors pc JOIN lego_colors c ON c.id = pc.color_id ' +
      'WHERE pc.part_num = ? ORDER BY c.name',
    args: [partNum],
  };
}

export function allColorsStmt(): Stmt {
  return { sql: 'SELECT id AS color_id, name, rgb, is_trans, NULL AS img_url FROM lego_colors ORDER BY name', args: [] };
}

/** Resolves (part, color) pairs; keep chunks small (2 params per pair). */
export function partDetailsStmt(keys: LegoPartKey[]): Stmt {
  return {
    sql:
      `WITH k(part_num, color_id) AS (VALUES ${keys.map(() => '(?, ?)').join(', ')}) ` +
      'SELECT k.part_num, k.color_id, p.name AS part_name, c.name AS color_name, ' +
      'c.rgb AS color_rgb, c.is_trans AS color_is_trans, pc.img_url ' +
      'FROM k LEFT JOIN lego_parts p ON p.part_num = k.part_num ' +
      'LEFT JOIN lego_colors c ON c.id = k.color_id ' +
      'LEFT JOIN lego_part_colors pc ON pc.part_num = k.part_num AND pc.color_id = k.color_id',
    args: keys.flatMap((k) => [k.part_num, k.color_id]),
  };
}

export const PART_SETS_PAGE = 20;

/**
 * Sets that contain a part in a color, most pieces first. Interchangeable molds (lego_part_canon)
 * count as the same part, like in the ranking. Uses the (part, color) index of lego_set_parts, so
 * it reads only the rows of that part+color; COUNT(*) OVER () returns the total in the same scan.
 */
export function setsWithPartStmt(partNum: string, colorId: number, page: number): Stmt {
  return {
    sql:
      'WITH c AS (SELECT COALESCE((SELECT canon_part_num FROM lego_part_canon WHERE part_num = ?), ?) AS canon), ' +
      'm AS (SELECT canon AS part_num FROM c UNION SELECT part_num FROM lego_part_canon WHERE canon_part_num = (SELECT canon FROM c)) ' +
      'SELECT s.set_num, s.name, s.year, s.theme_id, s.num_parts, s.img_url, SUM(sp.quantity) AS qty, COUNT(*) OVER () AS total ' +
      'FROM lego_set_parts sp JOIN m ON m.part_num = sp.part_num JOIN lego_sets s ON s.set_num = sp.set_num ' +
      'WHERE sp.color_id = ? AND sp.is_spare = 0 ' +
      'GROUP BY s.set_num ORDER BY qty DESC, s.year DESC, s.set_num LIMIT ? OFFSET ?',
    args: [partNum, partNum, colorId, PART_SETS_PAGE, page * PART_SETS_PAGE],
  };
}

/** One image per part, for parts that no set inventory has an image of (lego_part_images). */
export function partImagesStmt(nums: string[]): Stmt {
  return {
    sql: `SELECT part_num, img_url FROM lego_part_images WHERE part_num IN (${nums.map(() => '?').join(', ')})`,
    args: nums,
  };
}

export function partsByNumsStmt(nums: string[]): Stmt {
  return {
    sql: `SELECT part_num, name FROM lego_parts WHERE part_num IN (${nums.map(() => '?').join(', ')})`,
    args: nums,
  };
}

export function setsByNumsStmt(setNums: string[]): Stmt {
  return {
    sql:
      'SELECT set_num, name, year, theme_id, num_parts, img_url FROM lego_sets ' +
      `WHERE set_num IN (${setNums.map(() => '?').join(', ')})`,
    args: setNums,
  };
}

/**
 * Ranks sets by how much of them the inventory already covers.
 *
 * - The inventory travels as ONE JSON parameter (json_each), however large it is.
 * - Interchangeable molds (lego_part_canon) are merged on both sides, so owning a drop-in
 *   mold counts, and nothing is counted twice.
 * - Per group: covered = MIN(needed, owned). Spare parts are ignored.
 * - simple % = covered / needed pieces. weighted % = the same with each piece weighted by the
 *   rarity of its part (lego_part_rarity), capped at 1.
 * - Only rows of the owned parts are read (index on part, color), not the whole catalog.
 */
export function possibleSetsStmt(p: PossibleSetsParams): Stmt {
  const pctExpr = 'CAST(ps.cov AS REAL) / st.total_qty';
  const wpctExpr = 'MIN(1.0, ps.wcov / st.weight_total)';
  const metricExpr = p.metric === 'weighted' ? wpctExpr : pctExpr;
  return {
    sql:
      'WITH inv_raw AS (' +
      "SELECT json_extract(j.value, '$.p') AS part_num, json_extract(j.value, '$.c') AS color_id, " +
      "json_extract(j.value, '$.q') AS qty FROM json_each(?) j), " +
      'inv AS (SELECT COALESCE(c.canon_part_num, r.part_num) AS cpart, r.color_id, SUM(r.qty) AS qty ' +
      'FROM inv_raw r LEFT JOIN lego_part_canon c ON c.part_num = r.part_num GROUP BY 1, 2), ' +
      'members AS (SELECT cpart, color_id, qty, cpart AS part_num FROM inv ' +
      'UNION ALL SELECT i.cpart, i.color_id, i.qty, c.part_num FROM inv i JOIN lego_part_canon c ON c.canon_part_num = i.cpart), ' +
      'hit AS (SELECT m.cpart, m.color_id, m.qty, sp.set_num, SUM(sp.quantity) AS need ' +
      'FROM members m JOIN lego_set_parts sp ON sp.part_num = m.part_num AND sp.color_id = m.color_id AND sp.is_spare = 0 ' +
      'GROUP BY m.cpart, m.color_id, m.qty, sp.set_num), ' +
      'per_set AS (SELECT h.set_num, SUM(MIN(h.need, h.qty)) AS cov, SUM(MIN(h.need, h.qty) * COALESCE(r.weight, 0)) AS wcov ' +
      'FROM hit h LEFT JOIN lego_part_rarity r ON r.part_num = h.cpart AND r.color_id = h.color_id GROUP BY h.set_num) ' +
      'SELECT s.set_num, s.name, s.year, s.theme_id, s.num_parts, s.img_url, ' +
      `ps.cov AS covered, st.total_qty AS total, ${pctExpr} AS pct, ${wpctExpr} AS wpct ` +
      'FROM per_set ps JOIN lego_set_stats st ON st.set_num = ps.set_num JOIN lego_sets s ON s.set_num = ps.set_num ' +
      `WHERE ps.cov >= ? AND ${metricExpr} >= ? ` +
      `ORDER BY ${metricExpr} DESC, ps.cov DESC, s.set_num LIMIT ?`,
    args: [
      JSON.stringify(p.inventory.map((i) => ({ p: i.part_num, c: i.color_id, q: i.quantity }))),
      p.minCovered, p.minPct, p.limit,
    ],
  };
}

export function canonStmt(partNums: string[]): Stmt {
  return {
    sql: `SELECT part_num, canon_part_num FROM lego_part_canon WHERE part_num IN (${partNums.map(() => '?').join(', ')})`,
    args: partNums,
  };
}

export function weightsStmt(keys: LegoPartKey[]): Stmt {
  return {
    sql:
      `WITH k(part_num, color_id) AS (VALUES ${keys.map(() => '(?, ?)').join(', ')}) ` +
      'SELECT r.part_num, r.color_id, r.weight FROM k JOIN lego_part_rarity r ON r.part_num = k.part_num AND r.color_id = k.color_id',
    args: keys.flatMap((k) => [k.part_num, k.color_id]),
  };
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export const toTheme = (r: DbRow): LegoTheme => ({
  id: Number(r.id), name: String(r.name), parent_id: num(r.parent_id),
});

export const toSet = (r: DbRow): LegoSet => ({
  set_num: String(r.set_num), name: String(r.name), year: num(r.year),
  theme_id: num(r.theme_id), num_parts: num(r.num_parts), img_url: str(r.img_url),
});

export const toSetPart = (r: DbRow): LegoSetPart => ({
  set_num: String(r.set_num), part_num: String(r.part_num), color_id: Number(r.color_id),
  quantity: Number(r.quantity), is_spare: Number(r.is_spare) === 1,
  part_name: String(r.part_name), color_name: String(r.color_name),
  color_rgb: str(r.color_rgb), color_is_trans: Number(r.color_is_trans) === 1,
  img_url: str(r.img_url),
});

export const toPartSummary = (r: DbRow): LegoPartSummary => ({ part_num: String(r.part_num), name: String(r.name) });

export const toColorOption = (r: DbRow): LegoColorOption => ({
  color_id: Number(r.color_id), name: String(r.name), rgb: str(r.rgb),
  is_trans: Number(r.is_trans) === 1, img_url: str(r.img_url),
});

/** Names fall back to the raw ids when the catalog does not know a part or color. */
export const toPartDetail = (r: DbRow): LegoPartDetail => ({
  part_num: String(r.part_num), color_id: Number(r.color_id),
  part_name: r.part_name == null ? String(r.part_num) : String(r.part_name),
  color_name: r.color_name == null ? `#${r.color_id}` : String(r.color_name),
  color_rgb: str(r.color_rgb), color_is_trans: Number(r.color_is_trans) === 1,
  img_url: str(r.img_url),
});

export const toPartSet = (r: DbRow): PartSet => ({ ...toSet(r), quantity: Number(r.qty) });

export const toPossibleSet = (r: DbRow): PossibleSet => ({
  ...toSet(r), covered: Number(r.covered), total: Number(r.total), pct: Number(r.pct), wpct: Number(r.wpct),
});
