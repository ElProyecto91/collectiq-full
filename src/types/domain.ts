/**
 * TCG (Trading Card Game) verticals CollectIQ supports or is prepared to
 * support. Start with Pokémon, expand outward. Using a union (not enum) keeps
 * the value space open for community-contributed verticals without a migration.
 */
export type Tcg = (typeof TCGS)[number];
export const TCGS = ['pokemon', 'one-piece', 'yugioh', 'lorcana', 'magic'] as const;

/** Human-readable labels for each TCG vertical, keyed by Tcg. */
export const TCG_LABELS: Readonly<Record<Tcg, string>> = {
  pokemon: 'Pokémon',
  'one-piece': 'One Piece',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Lorcana',
  magic: 'Magic',
};

/** Physical card condition grades (extensible — future PSA/BGS integration). */
export type CardCondition =
  | 'mint'
  | 'near-mint'
  | 'lightly-played'
  | 'moderately-played'
  | 'heavily-played'
  | 'damaged'
  | 'graded';

/** Result of a card-condition grade from a grading authority. */
export interface CardGrade {
  authority: 'PSA' | 'BGS' | 'CGC' | string;
  score: number;
  certificateId?: string;
}

/**
 * Canonical card identity. Catalog-agnostic: a future catalog service resolves
 * `cardId` to rich metadata (set, rarity, images, prices). Domain code should
 * only depend on this shape, never on raw catalog payload formats.
 */
export interface CardRef {
  cardId: string;
  tcg: Tcg;
}

/** A card owned by the collector (collection_items row). */
export interface CollectionItem extends CardRef {
  id: string;
  telegramUserId: number;
  quantity: number;
  condition: CardCondition | null;
  grade: CardGrade | null;
  /** Free-form extensible metadata stored as jsonb. */
  metadata: Record<string, unknown>;
  acquiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Card snapshot stored at add time for fast grid rendering. */
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  imageUrl: string | null;
  notes: string | null;
  favorite: boolean;
}

/** Input for creating a collection item. Server fills id/timestamps/owner. */
export interface CollectionItemInput {
  cardId: string;
  tcg: Tcg;
  telegramUserId: number;
  quantity?: number;
  condition?: CardCondition | null;
  grade?: CardGrade | null;
  metadata?: Record<string, unknown>;
  acquiredAt?: string | null;
  /** Card snapshot — filled from the catalog at add time. */
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  favorite?: boolean;
}

/** Input for patching a collection item (all fields optional). */
export type CollectionItemUpdate = Partial<CollectionItemInput>;

/** A card the collector wants (wishlist_items row). */
export interface WishlistItem extends CardRef {
  id: string;
  maxPrice: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItemInput {
  cardId: string;
  tcg: Tcg;
  maxPrice?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export type WishlistItemUpdate = Partial<WishlistItemInput>;

/** Collector profile (profiles row). */
export interface Profile {
  id: string;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate collection statistics for a user (computed, not stored). */
export interface CollectionStats {
  totalItems: number;
  uniqueCards: number;
  favoriteCount: number;
  byTcg: Partial<Record<Tcg, number>>;
}
