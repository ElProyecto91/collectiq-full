import type {
  CardCondition,
  CardLanguage,
  CardVariant,
  GradingCompany,
  PurchaseSource,
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
  (['mint', 'near-mint', 'lightly-played', 'moderately-played', 'heavily-played', 'damaged'] as const).includes(value as CardCondition);

const isVariant = (value: string | null): value is CardVariant | null =>
  value === null ||
  (['normal', 'holofoil', 'reverseHolofoil', 'firstEdition', 'promo'] as const).includes(value as CardVariant);

const isLanguage = (value: string | null): value is CardLanguage | null =>
  value === null ||
  (['en', 'es', 'ja', 'de', 'fr', 'it', 'pt', 'ko', 'zh-hant', 'th', 'id', 'ru', 'pl'] as const).includes(value as CardLanguage);

const isGradingCompany = (value: string | null): value is GradingCompany | null =>
  value === null ||
  (['PSA', 'BGS', 'CGC', 'CCC', 'PGC', 'other'] as const).includes(value as GradingCompany);

const isPurchaseSource = (value: string | null): value is PurchaseSource | null =>
  value === null ||
  (['pack', 'trade', 'purchase', 'gift', 'other'] as const).includes(value as PurchaseSource);

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
    marketPrice: row.market_price ?? null,
    tcgplayerPrice: row.tcgplayer_price ?? null,
    currency: row.currency ?? null,
    variant: isVariant(row.variant) ? row.variant : 'normal',
    cardLanguage: isLanguage(row.card_language) ? row.card_language : 'en',
    purchasePrice: row.purchase_price ?? null,
    purchaseSource: isPurchaseSource(row.purchase_source) ? row.purchase_source : null,
    gradingCompany: isGradingCompany(row.grading_company) ? row.grading_company : null,
    gradingScore: row.grading_score ?? null,
    gradingCertificate: row.grading_certificate ?? null,
    gradeCentering: row.grade_centering ?? null,
    gradeCorners: row.grade_corners ?? null,
    gradeEdges: row.grade_edges ?? null,
    gradeSurface: row.grade_surface ?? null,
    inSleeve: row.in_sleeve ?? false,
    inBinder: row.in_binder ?? false,
    customPhoto: row.custom_photo ?? null,
    storageLocation: (row as any).storage_location ?? null,
    sleeveType: (row as any).sleeve_type ?? null,
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
    market_price: input.marketPrice ?? null,
    tcgplayer_price: input.tcgplayerPrice ?? null,
    currency: input.currency ?? 'EUR',
    variant: input.variant ?? 'normal',
    card_language: input.cardLanguage ?? 'en',
    purchase_price: input.purchasePrice ?? null,
    purchase_source: input.purchaseSource ?? null,
    grading_company: input.gradingCompany ?? null,
    grading_score: input.gradingScore ?? null,
    grading_certificate: input.gradingCertificate ?? null,
    grade_centering: input.gradeCentering ?? null,
    grade_corners: input.gradeCorners ?? null,
    grade_edges: input.gradeEdges ?? null,
    grade_surface: input.gradeSurface ?? null,
    in_sleeve: input.inSleeve ?? false,
    in_binder: input.inBinder ?? false,
    custom_photo: input.customPhoto ?? null,
    storage_location: (input as any).storageLocation ?? null,
    sleeve_type: (input as any).sleeveType ?? null,
  };
}

export function toCollectionItemUpdateRow(input: Partial<CollectionItemInput>) {
  const row: Record<string, any> = {};

  if (input.variant !== undefined) row.variant = input.variant;
  if (input.cardLanguage !== undefined) row.card_language = input.cardLanguage;
  if (input.condition !== undefined) row.condition = input.condition;
  if (input.purchasePrice !== undefined) row.purchase_price = input.purchasePrice;
  if (input.purchaseSource !== undefined) row.purchase_source = input.purchaseSource;
  if (input.acquiredAt !== undefined) row.acquired_at = input.acquiredAt;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.inSleeve !== undefined) row.in_sleeve = input.inSleeve;
  if (input.inBinder !== undefined) row.in_binder = input.inBinder;
  if (input.gradingCompany !== undefined) row.grading_company = input.gradingCompany;
  if (input.gradingScore !== undefined) row.grading_score = input.gradingScore;
  if (input.gradingCertificate !== undefined) row.grading_certificate = input.gradingCertificate;
  if (input.gradeCentering !== undefined) row.grade_centering = input.gradeCentering;
  if (input.gradeCorners !== undefined) row.grade_corners = input.gradeCorners;
  if (input.gradeEdges !== undefined) row.grade_edges = input.gradeEdges;
  if (input.gradeSurface !== undefined) row.grade_surface = input.gradeSurface;
  if (input.quantity !== undefined) row.quantity = input.quantity;
  if (input.favorite !== undefined) row.favorite = input.favorite;
  if (input.imageUrl !== undefined) row.image_url = input.imageUrl;
  if (input.cardName !== undefined) row.card_name = input.cardName;
  if (input.setName !== undefined) row.set_name = input.setName;
  if (input.cardNumber !== undefined) row.card_number = input.cardNumber;
  if (input.rarity !== undefined) row.rarity = input.rarity;
  if (input.marketPrice !== undefined) row.market_price = input.marketPrice;
  if (input.tcgplayerPrice !== undefined) row.tcgplayer_price = input.tcgplayerPrice;
  if ((input as any).storageLocation !== undefined) row.storage_location = (input as any).storageLocation;
  if ((input as any).sleeveType !== undefined) row.sleeve_type = (input as any).sleeveType;

  return row;
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