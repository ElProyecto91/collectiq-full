// src/types/tcg.ts

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

export interface CollectionItem {
  id: string;
  telegram_user_id: number;
  tcg: string;
  catalog_item_id: string | null;
  external_card_id: string | null;
  name: string;
  set_name: string | null;
  number: string | null;
  image_url: string | null;
  rarity: string | null;
  variant: string | null;
  language: string;
  quantity: number;
  condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  market_value: number | null;
  currency: string;
  acquired_at: string;
  notes: string | null;
  location: string | null;
  folder: string | null;
  is_favorite: boolean;
  is_for_sale: boolean;
  is_for_trade: boolean;
  in_sleeve: boolean;
  sleeve_type: string | null;
  in_binder: boolean;
  grading_company: string | null;
  grading_score: number | null;
  grading_certificate: string | null;
  grade_centering: number | null;
  grade_corners: number | null;
  grade_edges: number | null;
  grade_surface: number | null;
  box_condition: string | null;
  custom_photo: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  telegram_user_id: number;
  tcg: string;
  catalog_item_id: string | null;
  external_card_id: string | null;
  name: string;
  set_name: string | null;
  number: string | null;
  image_url: string | null;
  rarity: string | null;
  variant: string | null;
  language: string;
  max_price: number | null;
  condition: string;
  priority: 1 | 2 | 3;
  notes: string | null;
  alert_enabled: boolean;
  last_checked_price: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
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