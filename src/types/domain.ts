// src/types/domain.ts
// Este fichero mantiene compatibilidad con el código existente
// mientras usa las nuevas tablas universales por debajo.

export type Tcg = (typeof TCGS)[number];
export const TCGS = ['pokemon', 'funko', 'magic', 'yugioh', 'onepiece', 'lorcana', 'digimon', 'dragonball', 'starwars', 'flesh', 'vanguard', 'weiss', 'marvel', 'sports'] as const;

export const TCG_LABELS: Readonly<Partial<Record<string, string>>> = {
  pokemon: 'Pokémon',
  funko: 'Funko POP!',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  onepiece: 'One Piece',
  lorcana: 'Lorcana',
  digimon: 'Digimon',
  dragonball: 'Dragon Ball',
  starwars: 'Star Wars',
  flesh: 'Flesh and Blood',
  vanguard: 'Vanguard',
  weiss: 'Weiß Schwarz',
  marvel: 'Marvel',
  sports: 'Cromos',
};

export type CardCondition =
  | 'mint'
  | 'near-mint'
  | 'NM'
  | 'lightly-played'
  | 'LP'
  | 'moderately-played'
  | 'MP'
  | 'heavily-played'
  | 'HP'
  | 'damaged'
  | 'DMG';

export type CardVariant = 'normal' | 'holofoil' | 'reverseHolofoil' | 'firstEdition' | 'promo' | string;

export type CardLanguage =
  | 'en' | 'es' | 'ja' | 'de' | 'fr' | 'it' | 'pt' | 'ko' | 'zh-hant' | 'th' | 'id' | 'ru' | 'pl';

export const CARD_LANGUAGES: { code: CardLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh-hant', label: '繁體中文', flag: '🇨🇳' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
];

export type GradingCompany = 'PSA' | 'BGS' | 'CGC' | 'CCC' | 'PGC' | 'other';

export const GRADING_COMPANIES: { code: GradingCompany; label: string }[] = [
  { code: 'PSA', label: 'PSA' },
  { code: 'BGS', label: 'BGS (Beckett)' },
  { code: 'CGC', label: 'CGC' },
  { code: 'CCC', label: 'CCC' },
  { code: 'PGC', label: 'PGC' },
  { code: 'other', label: 'Otra' },
];

export type PurchaseSource = 'pack' | 'trade' | 'purchase' | 'gift' | 'other' | string;

export const PURCHASE_SOURCES: { code: PurchaseSource; label: string; emoji: string }[] = [
  { code: 'pack', label: 'Sobre/Pack', emoji: '📦' },
  { code: 'purchase', label: 'Compra', emoji: '🛒' },
  { code: 'trade', label: 'Intercambio', emoji: '🔄' },
  { code: 'gift', label: 'Regalo', emoji: '🎁' },
  { code: 'other', label: 'Otro', emoji: '❓' },
];

export interface CardGrade {
  authority: string;
  score: number;
  certificateId?: string;
}

export interface CardRef {
  cardId?: string;
  tcg: string;
}

// CollectionItem unificado — acepta tanto snake_case (BD nueva) como camelCase (código existente)
export interface CollectionItem {
  id: string;
  tcg: string;

  // snake_case (nuevas tablas)
  telegram_user_id?: number;
  catalog_item_id?: string | null;
  external_card_id?: string | null;
  name?: string;
  set_name?: string | null;
  number?: string | null;
  image_url?: string | null;
  rarity?: string | null;
  variant?: string | null;
  language?: string;
  quantity: number;
  condition?: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  purchase_source?: string | null;
  market_value?: number | null;
  currency?: string | null;
  acquired_at?: string | null;
  notes?: string | null;
  location?: string | null;
  folder?: string | null;
  is_favorite?: boolean;
  is_for_sale?: boolean;
  is_for_trade?: boolean;
  in_sleeve?: boolean;
  sleeve_type?: string | null;
  in_binder?: boolean;
  grading_company?: string | null;
  grading_score?: number | null;
  grading_certificate?: string | null;
  grade_centering?: number | null;
  grade_corners?: number | null;
  grade_edges?: number | null;
  grade_surface?: number | null;
  box_condition?: string | null;
  custom_photo?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  // camelCase (código existente)
  telegramUserId?: number;
  cardId?: string | null;
  cardName?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  setTotal?: number | null;
  imageUrl?: string | null;
  marketPrice?: number | null;
  tcgplayerPrice?: number | null;
  purchasePrice?: number | null;
  purchaseSource?: string | null;
  favorite?: boolean;
  acquiredAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  cardLanguage?: string | null;
  storageLocation?: string | null;
  inSleeve?: boolean;
  inBinder?: boolean;
  sleeveType?: string | null;
  customPhoto?: string | null;
  gradingCompany?: string | null;
  gradingScore?: number | null;
  gradingCertificate?: string | null;
  gradeCentering?: number | null;
  gradeCorners?: number | null;
  gradeEdges?: number | null;
  gradeSurface?: number | null;
  grade?: CardGrade | null;
}

export interface CollectionItemInput {
  cardId?: string;
  tcg: string;
  telegramUserId?: number;
  quantity?: number;
  condition?: string | null;
  grade?: CardGrade | null;
  metadata?: Record<string, any>;
  acquiredAt?: string | null;
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  favorite?: boolean;
  setTotal?: number | null;
  marketPrice?: number | null;
  tcgplayerPrice?: number | null;
  currency?: string | null;
  variant?: string | null;
  cardLanguage?: string | null;
  purchasePrice?: number | null;
  purchaseSource?: string | null;
  gradingCompany?: string | null;
  gradingScore?: number | null;
  gradingCertificate?: string | null;
  gradeCentering?: number | null;
  gradeCorners?: number | null;
  gradeEdges?: number | null;
  gradeSurface?: number | null;
  inSleeve?: boolean;
  inBinder?: boolean;
  storageLocation?: string | null;
  sleeveType?: string | null;
  customPhoto?: string | null;
}

export type CollectionItemUpdate = Partial<CollectionItemInput>;

export interface WishlistItem {
  id: string;
  tcg: string;

  // snake_case
  telegram_user_id?: number;
  catalog_item_id?: string | null;
  external_card_id?: string | null;
  name?: string;
  set_name?: string | null;
  number?: string | null;
  image_url?: string | null;
  rarity?: string | null;
  variant?: string | null;
  language?: string;
  max_price?: number | null;
  condition?: string;
  priority?: 1 | 2 | 3;
  notes?: string | null;
  alert_enabled?: boolean;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  // camelCase
  telegramUserId?: number;
  cardId?: string | null;
  cardName?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  setTotal?: number | null;
  imageUrl?: string | null;
  maxPrice?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistItemInput {
  cardId?: string;
  tcg: string;
  telegramUserId?: number;
  maxPrice?: number | null;
  notes?: string | null;
  metadata?: Record<string, any>;
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  rarity?: string | null;
  imageUrl?: string | null;
  setTotal?: number | null;
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
  byTcg: Partial<Record<string, number>>;
}