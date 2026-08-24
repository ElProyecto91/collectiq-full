// src/types/tcg.ts
// CollectionItem y WishlistItem viven en domain.ts — re-exportamos para compatibilidad
export type { CollectionItem, WishlistItem } from './domain';

export interface TcgRegistry {
  id: string;
  name: string;
  name_short: string;
  logo_url: string | null;
  status: 'active' | 'coming_soon' | 'beta';
  item_type: 'card' | 'figure' | 'sticker';
  catalog_source: string | null;
  price_source: string | null;
  price_currency: string;
  scanner_enabled: boolean;
  sort_order: number;
  color_primary: string;
  has_sets: boolean;
  has_rarity: boolean;
  has_grading: boolean;
  has_variants: boolean;
  has_language: boolean;
}

export interface UserReputation {
  telegram_user_id: number;
  score: number;
  transactions_completed: number;
  items_verified: number;
  positive_reviews: number;
  negative_reviews: number;
  badges: string[];
  member_since: string;
}

export interface ScanResult {
  tcg: string;
  external_card_id: string | null;
  catalog_item_id: string | null;
  name: string;
  set_name: string | null;
  number: string | null;
  image_url: string | null;
  rarity: string | null;
  variant: string | null;
  language: string;
  market_value: number | null;
  confidence: number;
}