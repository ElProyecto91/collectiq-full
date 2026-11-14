import type { LegoSetPart } from './types';

/** One part in one color: what the set needs plus the spares that come in the box (the manual's list counts both). */
export interface PartLine { row: LegoSetPart; real: number; spare: number }

export interface ColorGroup {
  colorId: number;
  name: string | null;
  rgb: string | null;
  isTrans: boolean;
  parts: PartLine[];
  total: number;
}

/**
 * Groups the rows of a set inventory by color, one line per part+color with the real and spare quantities kept
 * apart. `total` of a group and the line headline are what is in the box (real + spare); `realTotal` and
 * `realUnique` are what the set itself needs, which is what completeness and progress use.
 */
export function buildPartLines(rows: LegoSetPart[]) {
  const lines = new Map<string, PartLine>();
  for (const r of rows) {
    const k = `${r.part_num}|${r.color_id}`;
    let l = lines.get(k);
    if (!l) { l = { row: r, real: 0, spare: 0 }; lines.set(k, l); }
    if (r.is_spare) l.spare += r.quantity; else l.real += r.quantity;
  }
  const byColor = new Map<number, ColorGroup>();
  for (const l of lines.values()) {
    const r = l.row;
    let g = byColor.get(r.color_id);
    if (!g) {
      g = { colorId: r.color_id, name: r.color_name, rgb: r.color_rgb, isTrans: r.color_is_trans, parts: [], total: 0 };
      byColor.set(r.color_id, g);
    }
    g.parts.push(l);
    g.total += l.real + l.spare;
  }
  const all = [...lines.values()];
  return {
    groups: [...byColor.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    realTotal: all.reduce((s, l) => s + l.real, 0),
    realUnique: all.filter((l) => l.real > 0).length,
    spareTotal: all.reduce((s, l) => s + l.spare, 0),
  };
}
