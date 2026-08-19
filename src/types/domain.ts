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
  | 'damaged';

export type CardVariant = 'normal' | 'holofoil' | 'reverseHolofoil' | 'firstEdition' | 'promo';

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

export type PurchaseSource = 'pack' | 'trade' | 'purchase' | 'gift' | 'other';

export const PURCHASE_SOURCES: { code: PurchaseSource; label: string; emoji: string }[] = [
  { code: 'pack', label: 'Sobre/Pack', emoji: '📦' },
  { code: 'purchase', label: 'Compra', emoji: '🛒' },
  { code: 'trade', label: 'Intercambio', emoji: '🔄' },
  { code: 'gift', label: 'Regalo', emoji: '🎁' },
  { code: 'other', label: 'Otro', emoji: '❓' },
];

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
  setTotal: number | null;
  marketPrice: number | null;
  tcgplayerPrice: number | null;
  currency: string | null;
  variant: CardVariant | null;
  cardLanguage: CardLanguage | null;
  purchasePrice: number | null;
  purchaseSource: PurchaseSource | null;
  gradingCompany: GradingCompany | null;
  gradingScore: number | null;
  gradingCertificate: string | null;
  gradeCentering: number | null;
  gradeCorners: number | null;
  gradeEdges: number | null;
  gradeSurface: number | null;
  inSleeve: boolean;
  inBinder: boolean;
  storageLocation: string | null;
  sleeveType: string | null;
  customPhoto: string | null;
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
  setTotal?: number | null;
  marketPrice?: number | null;
  tcgplayerPrice?: number | null;
  currency?: string | null;
  variant?: CardVariant | null;
  cardLanguage?: CardLanguage | null;
  purchasePrice?: number | null;
  purchaseSource?: PurchaseSource | null;
  gradingCompany?: GradingCompany | null;
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
  setTotal: number | null;
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
  byTcg: Partial<Record<Tcg, number>>;
}