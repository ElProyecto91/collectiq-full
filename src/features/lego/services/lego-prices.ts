import { API_BASE } from '@/config/api';
import { getSupabase } from '@/lib/supabase';
import { authHeaders } from '@/lib/session-token';

export {
  BATCH, PriceError, needsFetch, priceKey, requestKey, rowKey,
  type LegoPrice, type PriceRequest,
} from '../price-core';
import { type LegoPrice, type PriceRequest, rowKey as _rowKey, PriceError } from '../price-core';

const num = (v: unknown): number | null => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const toPrice = (r: Record<string, unknown>): LegoPrice => ({
  kind: r.kind as 'part' | 'set', item_num: String(r.item_num), color_id: Number(r.color_id), status: r.status as LegoPrice['status'],
  new_avg: num(r.new_avg), new_qty: num(r.new_qty), new_basis: (r.new_basis as LegoPrice['new_basis']) ?? null,
  used_avg: num(r.used_avg), used_qty: num(r.used_qty), used_basis: (r.used_basis as LegoPrice['used_basis']) ?? null,
  fetched_at: String(r.fetched_at),
});

/** Prices already saved (no BrickLink call). Missing table or no rows simply gives an empty map. */
export async function loadCachedPrices(requests: PriceRequest[]): Promise<Map<string, LegoPrice>> {
  const out = new Map<string, LegoPrice>();
  const db = getSupabase();
  for (const kind of ['part', 'set'] as const) {
    const nums = [...new Set(requests.filter((r) => r.kind === kind).map((r) => r.num))];
    for (let i = 0; i < nums.length; i += 80) {
      const chunk = nums.slice(i, i + 80);
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db.from('lego_prices').select('*').eq('kind', kind).in('item_num', chunk).range(from, from + 999);
        if (error) return out; // table not created yet: no cached prices
        for (const r of data ?? []) { const p = toPrice(r as Record<string, unknown>); out.set(_rowKey(p), p); }
        if ((data ?? []).length < 1000) break;
      }
    }
  }
  return out;
}

export interface PriceBatchResult { prices: LegoPrice[]; stopped: string | null }

/** Ask the Worker to price up to BATCH items (it reads its cache first and calls BrickLink for the rest). */
export async function requestPrices(items: PriceRequest[]): Promise<PriceBatchResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/lego-prices`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ items }) });
  } catch { throw new PriceError('network'); }
  const body = (await res.json().catch(() => ({}))) as { prices?: Record<string, unknown>[]; stopped?: string | null; error?: string };
  if (!res.ok) throw new PriceError(String(body.error ?? `http_${res.status}`));
  return { prices: (body.prices ?? []).map(toPrice), stopped: body.stopped ?? null };
}
