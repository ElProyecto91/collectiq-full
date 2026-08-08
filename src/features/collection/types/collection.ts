/**
 * Collection Engine domain types.
 *
 * These types define the canonical shapes for the collection feature. The
 * database row type (`UserCardRow`) mirrors the `user_cards` table; the domain
 * type (`UserCard`) is what the UI consumes. Enums are defined as const arrays
 * for dropdowns/selectors and as union types for type safety.
 */

/* ── Enums ───────────────────────────────────────────────────────── */

export const CONDITIONS = [
  'Near Mint',
  'Excellent',
  'Good',
  'Light Played',
  'Played',
  'Poor',
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const LANGUAGES = [
  'English',
  'Spanish',
  'Japanese',
  'German',
  'French',
  'Italian',
  'Portuguese',
  'Korean',
  'Chinese',
  'Other',
] as const;
export type Language = (typeof LANGUAGES)[number];

export const FINISHES = ['Normal', 'Reverse Holo', 'Holo', 'Promo'] as const;
export type Finish = (typeof FINISHES)[number];

export const ACQUISITION_METHODS = [
  'Bought',
  'Booster Pack',
  'Trade',
  'Gift',
  'Event',
  'Other',
] as const;
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

/* ── Database row ───────────────────────────────────────────────── */

/** Raw `user_cards` row shape as returned by Supabase. */
export interface UserCardRow {
  id: string;
  telegram_user_id: number;
  pokemon_card_id: string;
  quantity: number;
  condition: string | null;
  language: string | null;
  edition: string | null;
  finish: string | null;
  purchase_price: number | null;
  acquisition_method: string | null;
  acquisition_date: string | null;
  notes: string | null;
  favorite: boolean;
  showcase: boolean;
  card_snapshot: CardSnapshot;
  created_at: string;
  updated_at: string;
}

/** Snapshotted display data stored in the `card_snapshot` jsonb column. */
export interface CardSnapshot {
  name: string;
  setName: string;
  setCode: string;
  rarity: string | null;
  imageUrl: string | null;
  supertype: string | null;
  subtypes: string[];
  number: string;
}

/* ── Domain types ───────────────────────────────────────────────── */

/** A card in the collector's collection (domain-mapped from UserCardRow). */
export interface UserCard {
  id: string;
  telegramUserId: number;
  pokemonCardId: string;
  quantity: number;
  condition: Condition | null;
  language: Language | null;
  edition: string | null;
  finish: Finish | null;
  purchasePrice: number | null;
  acquisitionMethod: AcquisitionMethod | null;
  acquisitionDate: string | null;
  notes: string | null;
  favorite: boolean;
  showcase: boolean;
  snapshot: CardSnapshot;
  createdAt: string;
  updatedAt: string;
}

/** Input for creating a new collection entry. */
export interface UserCardInput {
  telegramUserId: number;
  pokemonCardId: string;
  quantity?: number;
  condition?: Condition | null;
  language?: Language | null;
  edition?: string | null;
  finish?: Finish | null;
  purchasePrice?: number | null;
  acquisitionMethod?: AcquisitionMethod | null;
  acquisitionDate?: string | null;
  notes?: string | null;
  favorite?: boolean;
  showcase?: boolean;
  snapshot: CardSnapshot;
}

/** Partial input for updating an existing entry. */
export type UserCardUpdate = Partial<Omit<UserCardInput, 'telegramUserId' | 'pokemonCardId'>>;

/* ── Query / filter types ───────────────────────────────────────── */

export type CollectionSortKey = 'recent' | 'name' | 'value';

export interface CollectionFilters {
  condition: Condition | null;
  language: Language | null;
  setId: string | null;
  rarity: string | null;
  favoritesOnly: boolean;
}

export interface CollectionQuery {
  telegramUserId: number;
  search: string;
  filters: CollectionFilters;
  sort: CollectionSortKey;
}

export interface CollectionStats {
  totalCards: number;
  uniqueCards: number;
  favoriteCount: number;
  estimatedValue: number;
}
