// Pure pieces of the price feature (types, keys, when to ask again). No imports with side effects, so it is easy to test.

/** A row of lego_prices: BrickLink average prices in euros for one part+color or one set. */
export interface LegoPrice {
  kind: 'part' | 'set';
  item_num: string;
  /** Rebrickable color id; -1 for sets. */
  color_id: number;
  status: 'ok' | 'not_found' | 'error';
  new_avg: number | null;
  new_qty: number | null;
  new_basis: 'sold' | 'stock' | null;
  used_avg: number | null;
  used_qty: number | null;
  used_basis: 'sold' | 'stock' | null;
  fetched_at: string;
}

/** What to price. For parts the color name/rgb let the Worker find BrickLink's color; bl_num is BrickLink's number if it differs. */
export interface PriceRequest {
  kind: 'part' | 'set';
  num: string;
  color_id?: number;
  color_name?: string;
  color_rgb?: string | null;
  bl_num?: string | null;
}

export class PriceError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export const BATCH = 6; // the Worker's limit per call

export const priceKey = (kind: string, num: string, color: number | undefined) => `${kind}|${num}|${kind === 'set' ? -1 : color}`;
export const requestKey = (r: PriceRequest) => priceKey(r.kind, r.num, r.color_id);
export const rowKey = (p: LegoPrice) => priceKey(p.kind, p.item_num, p.color_id);

const FRESH_MS = 30 * 24 * 3600 * 1000;
const RETRY_ERROR_MS = 3600 * 1000;

/** Same rule as the Worker: is it worth asking again? (none yet, stale, or an error older than an hour) */
export function needsFetch(row: LegoPrice | undefined, now = Date.now()): boolean {
  if (!row) return true;
  const age = now - new Date(row.fetched_at).getTime();
  return row.status === 'error' ? age > RETRY_ERROR_MS : age > FRESH_MS;
}
