import type { LegoPrice } from './price-core';

/** Unit prices in euros of one row, or nulls when BrickLink has no price for it. */
export function unitPrices(p: LegoPrice | undefined): { newP: number | null; usedP: number | null } {
  if (!p || p.status !== 'ok') return { newP: null, usedP: null };
  return { newP: p.new_avg, usedP: p.used_avg };
}

export interface ValueTotals {
  newTotal: number;
  usedTotal: number;
  /** How many rows have at least one price / how many rows there are. */
  priced: number;
  count: number;
}

/**
 * Total value of a list of owned things: quantity x unit price. Rows without a price add nothing and are
 * reported in `priced` / `count`, so the total is always shown as "based on N of M".
 */
export function totals(entries: { qty: number; price: LegoPrice | undefined }[]): ValueTotals {
  let newTotal = 0, usedTotal = 0, priced = 0;
  for (const e of entries) {
    const { newP, usedP } = unitPrices(e.price);
    if (newP == null && usedP == null) continue;
    priced++;
    if (newP != null) newTotal += e.qty * newP;
    if (usedP != null) usedTotal += e.qty * usedP;
  }
  return { newTotal, usedTotal, priced, count: entries.length };
}

/** "12,34 €" / "€12.34": always euros, up to 3 decimals for cents-sized pieces. */
export function formatEuro(v: number, locale: string): string {
  const tiny = Math.abs(v) < 1 && v !== 0;
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: tiny ? 3 : 2,
  }).format(v);
}
