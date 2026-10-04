import type { LegoPartItem, LegoSetPart, PartAvailability, UserLegoAllocation } from '../types';

/** Pure helpers for the "loose parts reserved by sets" model. Nothing here touches the network. */

const key = (part: string, color: number) => `${part}|${color}`;

/** Per (part, color): what is owned, reserved by set copies, and free. `free` never goes below 0. */
export function availability(inventory: LegoPartItem[], allocations: UserLegoAllocation[]): Map<string, PartAvailability> {
  const map = new Map<string, PartAvailability>();
  const get = (k: string): PartAvailability => {
    let a = map.get(k);
    if (!a) { a = { owned: 0, allocated: 0, free: 0, inSets: [] }; map.set(k, a); }
    return a;
  };
  for (const it of inventory) if (it.quantity > 0) get(key(it.part_num, it.color_id)).owned += it.quantity;
  for (const al of allocations) {
    if (!(al.quantity > 0)) continue;
    const a = get(key(al.part_num, al.color_id));
    a.allocated += al.quantity;
    a.inSets.push({ user_set_id: al.user_set_id, quantity: al.quantity });
  }
  for (const a of map.values()) a.free = Math.max(0, a.owned - a.allocated);
  return map;
}

/**
 * The inventory as it looks when the given allocations are set aside. Pass `excludeSetId` to leave
 * out one copy's own allocation (used when re-assigning that copy).
 */
export function freeInventory(inventory: LegoPartItem[], allocations: UserLegoAllocation[], excludeSetId?: string): LegoPartItem[] {
  const av = availability(inventory, excludeSetId ? allocations.filter((a) => a.user_set_id !== excludeSetId) : allocations);
  const out: LegoPartItem[] = [];
  for (const it of inventory) {
    const a = av.get(key(it.part_num, it.color_id));
    // an inventory row is unique per (part, color), so its free share is the availability entry's
    if (a && a.free > 0) out.push({ part_num: it.part_num, color_id: it.color_id, quantity: a.free });
  }
  return out;
}

/**
 * Which real parts of the free inventory fill a set. Interchangeable molds (same canonical part,
 * same color) fill the same slot; the exact part number is used first. Returns the REAL part
 * numbers to reserve, never more than the set needs nor than is free.
 */
export function planAllocation(parts: LegoSetPart[], free: LegoPartItem[], canon: Map<string, string>): LegoPartItem[] {
  const canonOf = (p: string) => canon.get(p) ?? p;

  const slots = new Map<string, { need: number; exact: Map<string, number> }>();
  for (const p of parts) {
    if (p.is_spare) continue;
    const k = key(canonOf(p.part_num), p.color_id);
    const s = slots.get(k) ?? { need: 0, exact: new Map() };
    s.need += p.quantity;
    s.exact.set(p.part_num, (s.exact.get(p.part_num) ?? 0) + p.quantity);
    slots.set(k, s);
  }

  const pool = new Map<string, Array<{ part_num: string; left: number }>>();
  for (const it of free) {
    if (!(it.quantity > 0)) continue;
    const k = key(canonOf(it.part_num), it.color_id);
    const list = pool.get(k) ?? [];
    list.push({ part_num: it.part_num, left: it.quantity });
    pool.set(k, list);
  }

  const out: LegoPartItem[] = [];
  for (const [k, slot] of slots) {
    const list = pool.get(k);
    if (!list) continue;
    const colorId = Number(k.slice(k.lastIndexOf('|') + 1));
    let need = slot.need;
    // exact matches first, then any interchangeable mold
    const ordered = [...list].sort((a, b) => Number(slot.exact.has(b.part_num)) - Number(slot.exact.has(a.part_num)) || a.part_num.localeCompare(b.part_num));
    for (const c of ordered) {
      if (need <= 0) break;
      const take = Math.min(need, c.left);
      if (take > 0) { out.push({ part_num: c.part_num, color_id: colorId, quantity: take }); need -= take; }
    }
  }
  return out;
}

export interface PendingRow {
  key: string;
  /** A representative row of the slot (name, color, image). */
  part: LegoSetPart;
  need: number;
  assigned: number;
  missing: number;
}

export interface PendingParts {
  rows: PendingRow[];
  total: number;
  assigned: number;
  /** Assigned / needed pieces (0-1). */
  pct: number;
}

/**
 * What one set copy still lacks: every slot of the set (interchangeable molds merged, spares ignored)
 * minus the pieces reserved for THAT copy. Only slots with something missing are returned.
 */
export function computePending(parts: LegoSetPart[], copyAllocations: LegoPartItem[], canon: Map<string, string>): PendingParts {
  const canonOf = (p: string) => canon.get(p) ?? p;
  const have = new Map<string, number>();
  for (const a of copyAllocations) {
    if (!(a.quantity > 0)) continue;
    const k = key(canonOf(a.part_num), a.color_id);
    have.set(k, (have.get(k) ?? 0) + a.quantity);
  }
  const slots = new Map<string, PendingRow>();
  for (const p of parts) {
    if (p.is_spare) continue;
    const k = key(canonOf(p.part_num), p.color_id);
    const s = slots.get(k);
    if (s) s.need += p.quantity;
    else slots.set(k, { key: k, part: p, need: p.quantity, assigned: 0, missing: 0 });
  }
  let total = 0, assigned = 0;
  const rows: PendingRow[] = [];
  for (const [k, s] of slots) {
    s.assigned = Math.min(s.need, have.get(k) ?? 0);
    s.missing = s.need - s.assigned;
    total += s.need; assigned += s.assigned;
    if (s.missing > 0) rows.push(s);
  }
  rows.sort((a, b) => b.missing - a.missing || a.part.color_name.localeCompare(b.part.color_name) || a.part.part_num.localeCompare(b.part.part_num));
  return { rows, total, assigned, pct: total ? assigned / total : 0 };
}
