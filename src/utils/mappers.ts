import type {
  CardCondition,
  CollectionItem,
  CollectionItemInput,
  Profile,
  Tcg,
  WishlistItem,
  WishlistItemInput,
} from '@/types';
import type {
  CollectionItemRow,
  ProfileRow,
  WishlistItemRow,
} from '@/types/database';

const isTcg = (value: string): value is Tcg =>
  (['pokemon', 'one-piece', 'yugioh', 'lorcana', 'magic'] as const).includes(value as Tcg);

const toTcg = (value: string): Tcg => (isTcg(value) ? value : 'pokemon');

const isCondition = (value: string | null): value is CardCondition | null =>
  value === null ||
  ([
    'mint',
    'near-mint',
    'lightly-played',
    'moderately-played',
    'heavily-played',
    'damaged',
    'graded',
  ] as const).includes(value as CardCondition);

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    photoUrl: row.photo_url,
    bio: row.bio,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCollectionItem(row: CollectionItemRow): CollectionItem {
  return {
    id: row.id,
    cardId: row.card_id,
    tcg: toTcg(row.tcg),
    telegramUserId: row.telegram_user_id,
    quantity: row.quantity,
    condition: isCondition(row.condition) ? row.condition : null,
    grade: null,
    metadata: row.metadata ?? {},
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cardName: row.card_name ?? '',
    setName: row.set_name ?? '',
    cardNumber: row.card_number ?? '',
    rarity: row.rarity ?? null,
    imageUrl: row.image_url ?? null,
    notes: row.notes ?? null,
    favorite: row.favorite ?? false,
    setTotal: row.set_total ?? null,
  };
}

export function mapWishlistItem(row: WishlistItemRow): WishlistItem {
  return {
    id: row.id,
    cardId: row.card_id,
    tcg: toTcg(row.tcg),
    maxPrice: row.max_price,
    notes: row.notes,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cardName: row.card_name ?? '',
    setName: row.set_name ?? '',
    cardNumber: row.card_number ?? '',
    rarity: row.rarity ?? null,
    imageUrl: row.image_url ?? null,
    telegramUserId: row.telegram_user_id,
    setTotal: row.set_total ?? null,
  };
}

export function toCollectionItemRow(input: CollectionItemInput) {
  return {
    card_id: input.cardId,
    tcg: input.tcg,
    telegram_user_id: input.telegramUserId,
    quantity: input.quantity ?? 1,
    condition: input.condition ?? null,
    metadata: input.metadata ?? {},
    acquired_at: input.acquiredAt ?? null,
    card_name: input.cardName ?? '',
    set_name: input.setName ?? '',
    card_number: input.cardNumber ?? '',
    rarity: input.rarity ?? null,
    image_url: input.imageUrl ?? null,
    notes: input.notes ?? null,
    favorite: input.favorite ?? false,
    set_total: input.setTotal ?? null,
  };
}

export function toWishlistItemRow(input: WishlistItemInput) {
  return {
    card_id: input.cardId,
    tcg: input.tcg,
    max_price: input.maxPrice ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
    card_name: (input as any).cardName ?? '',
    set_name: (input as any).setName ?? '',
    card_number: (input as any).cardNumber ?? '',
    rarity: (input as any).rarity ?? null,
    image_url: (input as any).imageUrl ?? null,
    telegram_user_id: (input as any).telegramUserId ?? 0,
    set_total: (input as any).setTotal ?? null,
  };
}