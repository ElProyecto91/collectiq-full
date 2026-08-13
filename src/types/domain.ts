export type Tcg = (typeof TCGS)[number];
export const TCGS = ['pokemon', 'one-piece', 'yugioh', 'lorcana', 'magic'] as const;

export const TCG_LABELS: Readonly<Record<Tcg, string>> = {
  pokemon: 'Pokémon',
  'one-piece': 'One Piece',
  yugioh: 'Yu-Gi-Oh!',
  lorcana: 'Lorcana',
  magic: 'Magic',
};

export type CardCondition =
  | 'mint'
  | 'near-mint'
  | 'lightly-played'
  | 'moderately-played'
  | 'heavily-played'
  | 'damaged'
  | 'graded';

export interface CardGrade {
  authority: 'PSA' | 'BGS' | 'CGC' | string;
  score: number;
  certificateId?: string;
}

export interface CardRef {
  cardId: string;
  tcg: Tcg;
}

export interface CollectionItem extends CardRef {
  id: string;
  telegramUserId: number;
  quantity: number;
  condition: CardCondition | null;
  grade: CardGrade | null;
  metadata: Record<string, unknown>;
  acquiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  imageUrl: string | null;
  notes: string | null;
  favorite: boolean;
}

export interface CollectionItemInput {
  cardId: string;
  tcg: Tcg;
  telegramUserId: number;
  quantity?: number;
  condition?: CardCondition | null;
  grade?: CardGrade | null;
  metadata?: Record<string, unknown>;
  acquiredAt?: string | null;
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  favorite?: boolean;
}

export type CollectionItemUpdate = Partial<CollectionItemInput>;

export interface WishlistItem extends CardRef {
  id: string;
  telegramUserId: number;
  maxPrice: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string | null;
  imageUrl: string | null;
}

export interface WishlistItemInput {
  cardId: string;
  tcg: Tcg;
  telegramUserId?: number;
  maxPrice?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string | null;
  imageUrl?: string | null;
}

export type WishlistItemUpdate = Partial<WishlistItemInput>;

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

export interface CollectionStats {
  totalItems: number;
  uniqueCards: number;
  favoriteCount: number;
  byTcg: Partial<Record<Tcg, number>>;
}