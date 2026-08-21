export interface FunkoItem {
  id: string;
  name: string;
  character: string | null;
  franchise: string | null;
  series: string | null;
  number: string | null;
  year: number | null;
  release_date: string | null;
  image_url: string | null;
  type: string;
  exclusivity: string | null;
  store: string | null;
  is_chase: boolean;
  is_flocked: boolean;
  is_glow: boolean;
  is_metallic: boolean;
  is_diamond: boolean;
  is_chrome: boolean;
  is_blacklight: boolean;
  is_jumbo: boolean;
  is_deluxe: boolean;
  is_signed: boolean;
  is_limited: boolean;
  upc: string | null;
  sticker: string | null;
  notes: string | null;
}

export interface FunkoCollectionItem {
  id: string;
  telegram_user_id: number;
  funko_id: string | null;
  custom_name: string | null;
  quantity: number;
  condition: string;
  box_condition: string;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  market_value: number | null;
  currency: string;
  location: string | null;
  notes: string | null;
  image_url: string | null;
  is_for_sale: boolean;
  is_for_trade: boolean;
  folder: string | null;
  created_at: string;
  funko_items?: FunkoItem;
}

export interface FunkoWishlistItem {
  id: string;
  telegram_user_id: number;
  funko_id: string | null;
  target_price: number | null;
  condition: string | null;
  priority: number;
  notes: string | null;
  funko_items?: FunkoItem;
}

export type FunkoVariant =
  | 'standard'
  | 'chase'
  | 'flocked'
  | 'glow'
  | 'metallic'
  | 'diamond'
  | 'chrome'
  | 'blacklight'
  | 'signed'
  | 'limited';

export type FunkoCondition = 'mint' | 'near_mint' | 'good' | 'damaged';
export type FunkoBoxCondition = 'mint' | 'near_mint' | 'good' | 'damaged' | 'no_box';