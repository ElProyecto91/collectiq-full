/**
 * Raw Pokémon TCG API response shapes.
 *
 * These mirror the JSON returned by api.pokemontcg.io (v2). Only the fields
 * CollectIQ consumes are typed — the API returns many more, but narrowing the
 * surface keeps the mapper focused and avoids coupling to unused payload.
 * See: https://docs.pokemontcg.io/
 */

/** Image variants returned by the API. */
export interface PokemonTcgImageUris {
  small: string;
  large: string;
  /** Cropped artwork; not always present. */
  crop?: string;
  symbol?: string;
  logo?: string;
}

/** Card legality per format. Values are "Legal" | "Banned" | "Restricted" | undefined. */
export type PokemonTcgLegality = 'Legal' | 'Banned' | 'Restricted' | undefined;

export interface PokemonTcgLegalities {
  standard?: PokemonTcgLegality;
  expanded?: PokemonTcgLegality;
  unlimited?: PokemonTcgLegality;
}

export interface PokemonTcgCardMarket {
  url?: string;
  updatedAt?: string;
  prices?: {
    averageSellPrice?: number;
    lowPrice?: number;
    trendPrice?: number;
    [key: string]: number | undefined;
  };
}

export interface PokemonTcgTcgplayer {
  url?: string;
  updatedAt?: string;
  prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number }>;
}

/** A single card as returned by the API. */
export interface PokemonTcgCard {
  id: string;
  name: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  set: PokemonTcgSet;
  number: string;
  rarity?: string;
  nationalPokedexNumbers?: number[];
  regulationMark?: string;
  artist?: string;
  images?: PokemonTcgImageUris;
  legalities?: PokemonTcgLegalities;
  tcgplayer?: PokemonTcgTcgplayer;
  cardmarket?: PokemonTcgCardMarket;
  flavorText?: string;
  attacks?: unknown[];
  weaknesses?: unknown[];
  resistances?: unknown[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
}

/** A set/expansion a card belongs to. */
export interface PokemonTcgSet {
  id: string;
  name: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  legalities?: PokemonTcgLegalities;
  ptcgoCode?: string;
  releaseDate?: string;
  images?: {
    symbol?: string;
    logo?: string;
  };
}

/** Paginated list response envelope. */
export interface PokemonTcgListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

/** Single-resource response envelope. */
export interface PokemonTcgSingleResponse<T> {
  data: T;
}
