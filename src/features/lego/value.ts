import type { LegoPrice } from './price-core';

/**
 * The one orientative unit price of a row, in euros: the used price when there is one (what loose pieces really
 * sell for), otherwise the new price. `basis` is 'stock' when it comes from current offers instead of recent sales.
 */
export function unitPrice(p: LegoPrice | undefined): { price: number | null; basis: 'sold' | 'stock' | null } {
  if (!p || p.status !== 'ok') return { price: null, basis: null };
  if (p.used_avg != null) return { price: p.used_avg, basis: p.used_basis };
  if (p.new_avg != null) return { price: p.new_avg, basis: p.new_basis };
  return { price: null, basis: null };
}

export interface ValueTotals {
  total: number;
  /** How many rows have a price / how many rows there are. */
  priced: number;
  count: number;
}

/**
 * Total value of a list of owned things: quantity x unit price. Rows without a price add nothing and are
 * reported in `priced` / `count`, so the total is always shown as "based on N of M".
 */
export function totals(entries: { qty: number; price: LegoPrice | undefined }[]): ValueTotals {
  let total = 0, priced = 0;
  for (const e of entries) {
    const { price } = unitPrice(e.price);
    if (price == null) continue;
    priced++;
    total += e.qty * price;
  }
  return { total, priced, count: entries.length };
}

/** "12,34 €" / "€12.34": always euros, up to 3 decimals for cents-sized pieces. */
export function formatEuro(v: number, locale: string): string {
  const tiny = Math.abs(v) < 1 && v !== 0;
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: tiny ? 3 : 2,
  }).format(v);
}
