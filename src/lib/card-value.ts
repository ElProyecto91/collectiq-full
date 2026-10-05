import { usdToEur } from '@/hooks/use-currency';

/**
 * What a collection card is worth, in euros. `marketPrice` is euros (Cardmarket); when a card only has a
 * TCGplayer price (dollars, kept apart in `tcgplayerPrice`) it is converted, never added as if it were euros.
 */
export function valueEur(item: { marketPrice?: number | null; tcgplayerPrice?: number | null }): number | null {
  if (item.marketPrice != null && item.marketPrice > 0) return item.marketPrice;
  if (item.tcgplayerPrice != null && item.tcgplayerPrice > 0) return usdToEur(item.tcgplayerPrice);
  return null;
}
