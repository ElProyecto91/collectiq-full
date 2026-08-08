import type {
  UserCard,
  UserCardInput,
  UserCardUpdate,
  UserCardRow,
  CardSnapshot,
  Condition,
  Language,
  Finish,
  AcquisitionMethod,
  CollectionStats,
} from '../types/collection';
import {
  CONDITIONS,
  LANGUAGES,
  FINISHES,
  ACQUISITION_METHODS,
} from '../types/collection';

/**
 * Mapper: raw `user_cards` rows ↔ domain types.
 *
 * The single translation point between the database shape and the app's
 * canonical `UserCard` type. Enum columns are narrowed from string to their
 * union types with a fallback to `null` for unrecognized values.
 */

function narrowEnum<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function mapUserCard(row: UserCardRow): UserCard {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    pokemonCardId: row.pokemon_card_id,
    quantity: row.quantity,
    condition: narrowEnum<Condition>(row.condition, CONDITIONS),
    language: narrowEnum<Language>(row.language, LANGUAGES),
    edition: row.edition ?? null,
    finish: narrowEnum<Finish>(row.finish, FINISHES),
    purchasePrice: row.purchase_price !== null ? Number(row.purchase_price) : null,
    acquisitionMethod: narrowEnum<AcquisitionMethod>(row.acquisition_method, ACQUISITION_METHODS),
    acquisitionDate: row.acquisition_date,
    notes: row.notes ?? null,
    favorite: row.favorite ?? false,
    showcase: row.showcase ?? false,
    snapshot: (row.card_snapshot ?? {}) as CardSnapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Domain → row for inserts (omit server-managed fields). */
export function toUserCardRow(input: UserCardInput) {
  return {
    telegram_user_id: input.telegramUserId,
    pokemon_card_id: input.pokemonCardId,
    quantity: input.quantity ?? 1,
    condition: input.condition ?? null,
    language: input.language ?? null,
    edition: input.edition ?? null,
    finish: input.finish ?? null,
    purchase_price: input.purchasePrice ?? null,
    acquisition_method: input.acquisitionMethod ?? null,
    acquisition_date: input.acquisitionDate ?? null,
    notes: input.notes ?? null,
    favorite: input.favorite ?? false,
    showcase: input.showcase ?? false,
    card_snapshot: input.snapshot,
  };
}

/** Domain → partial row for updates. */
export function toUserCardUpdateRow(update: UserCardUpdate) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.quantity !== undefined) row.quantity = update.quantity;
  if (update.condition !== undefined) row.condition = update.condition ?? null;
  if (update.language !== undefined) row.language = update.language ?? null;
  if (update.edition !== undefined) row.edition = update.edition ?? null;
  if (update.finish !== undefined) row.finish = update.finish ?? null;
  if (update.purchasePrice !== undefined) row.purchase_price = update.purchasePrice ?? null;
  if (update.acquisitionMethod !== undefined)
    row.acquisition_method = update.acquisitionMethod ?? null;
  if (update.acquisitionDate !== undefined) row.acquisition_date = update.acquisitionDate ?? null;
  if (update.notes !== undefined) row.notes = update.notes ?? null;
  if (update.favorite !== undefined) row.favorite = update.favorite;
  if (update.showcase !== undefined) row.showcase = update.showcase;
  if (update.snapshot !== undefined) row.card_snapshot = update.snapshot;
  return row;
}

/** Aggregate raw rows into CollectionStats. */
export function computeStats(rows: UserCardRow[]): CollectionStats {
  let totalCards = 0;
  let favoriteCount = 0;
  let estimatedValue = 0;
  const uniqueIds = new Set<string>();

  for (const row of rows) {
    totalCards += row.quantity;
    if (row.favorite) favoriteCount += 1;
    uniqueIds.add(row.pokemon_card_id);
    if (row.purchase_price !== null) {
      estimatedValue += Number(row.purchase_price) * row.quantity;
    }
  }

  return {
    totalCards,
    uniqueCards: uniqueIds.size,
    favoriteCount,
    estimatedValue,
  };
}
