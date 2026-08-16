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
  set_total: number | null;
  market_price: number | null;
  tcgplayer_price: number | null;
  currency: string | null;
  variant: string | null;
  card_language: string | null;
  purchase_price: number | null;
  purchase_source: string | null;
  grading_company: string | null;
  grading_score: number | null;
  grading_certificate: string | null;
  grade_centering: number | null;
  grade_corners: number | null;
  grade_edges: number | null;
  grade_surface: number | null;
  in_sleeve: boolean;
  in_binder: boolean;
  custom_photo: string | null;
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
  set_total: number | null;
}

export const Tables = {
  Profiles: 'profiles',
  CollectionItems: 'collection_items',
  WishlistItems: 'wishlist_items',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];