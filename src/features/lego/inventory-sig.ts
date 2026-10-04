import type { LegoPartItem } from './types';

/** Short fingerprint of an inventory, used as a cache key (djb2 over part|color|quantity). */
export function inventorySig(items: LegoPartItem[]): string {
  let h = 5381;
  for (const it of items) {
    const s = `${it.part_num}|${it.color_id}|${it.quantity};`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return `${items.length}:${(h >>> 0).toString(36)}`;
}
