/**
 * Catalog domain types — the canonical shapes the rest of the app depends on.
 *
 * These are deliberately provider-agnostic: a future catalog (One Piece, Magic)
 * can map its own API into the same `CatalogCard` / `CatalogSet` shapes, and the
 * UI never needs to know which provider produced the data.
 */

/** Card rarity, normalized to a display-friendly label. */
export type CardRarity = string;

/** Energy/Pokémon types as free-form strings (the API uses loose casing). */
export type CardType = string;

/** Legalities per play format. */
export interface CardLegalities {
  standard?: 'Legal' | 'Banned' | 'Restricted';
  expanded?: 'Legal' | 'Banned' | 'Restricted';
  unlimited?: 'Legal' | 'Banned' | 'Restricted';
}

/** Image variants for a catalog card. */
export interface CardImages {
  small: string | null;
  large: string | null;
}

/** A set/expansion a card belongs to. */
export interface CatalogSet {
  id: string;
  name: string;
  series: string | null;
  printedTotal: number | null;
  total: number | null;
  releaseDate: string | null;
  logoUrl: string | null;
  symbolUrl: string | null;
}

/** The canonical card used across the Explorer, search results, and details. */
export interface CatalogCard {
  id: string;
  name: string;
  supertype: string | null;
  subtypes: string[];
  hp: number | null;
  types: CardType[];
  set: CatalogSet;
  number: string;
  rarity: CardRarity | null;
  regulationMark: string | null;
  artist: string | null;
  images: CardImages;
  legalities: CardLegalities | null;
  flavorText: string | null;
  evolvesFrom: string | null;
  retreatCost: number | null;
  /** Originating TCG vertical — always 'pokemon' for this provider. */
  tcg: 'pokemon';
}

/** A page of search results with pagination metadata. */
export interface CatalogCardPage {
  cards: CatalogCard[];
  page: number;
  pageSize: number;
  totalCount: number;
  /** Whether more pages are available. */
  hasMore: boolean;
}

/** Parameters for a catalog search. */
export interface CatalogSearchParams {
  query: string;
  page: number;
  pageSize: number;
}
