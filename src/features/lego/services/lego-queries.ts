import type {
  LegoSearchParams, LegoSet, LegoSetPart, LegoTheme,
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
