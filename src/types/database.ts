/**
 * Raw database row shapes — the literal column names returned by Supabase.
 * Domain mappers in the service layer convert these to the camelCase domain
 * types in `domain.ts`. Keeping them separate means a column rename only
 * touches the mapper, not every consuming component.
 */
export interface ProfileRow {
  id: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionItemRow {
  id: string;
  user_id: string | null;
  telegram_user_id: number;
  card_id: string;
  tcg: string;
  quantity: number;
  condition: string | null;
  metadata: Record<string, unknown>;
  acquired_at: string | null;
  created_at: string;
  updated_at: string;
  card_name: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_url: string | null;
  notes: string | null;
  favorite: boolean;
}

export interface WishlistItemRow {
  id: string;
  user_id: string;
  card_id: string;
  tcg: string;
  max_price: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  card_name: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  image_url: string | null;
  telegram_user_id: number;
}

/** Table names — the single source of truth for `supabase.from(...)`. */
export const Tables = {
  Profiles: 'profiles',
  CollectionItems: 'collection_items',
  WishlistItems: 'wishlist_items',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];