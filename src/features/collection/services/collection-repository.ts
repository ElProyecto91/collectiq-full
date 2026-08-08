import { supabase } from '@/lib/supabase';
import { ApiError, fromPostgrestError } from '@/utils/error';
import type { PostgrestError } from '@supabase/supabase-js';

import { mapUserCard, toUserCardRow, toUserCardUpdateRow, computeStats } from './collection-mapper';
import type {
  UserCard,
  UserCardInput,
  UserCardUpdate,
  UserCardRow,
  CollectionQuery,
  CollectionStats,
} from '../types/collection';

/**
 * CollectionRepository — data access layer for the `user_cards` table.
 *
 * Sits between the raw Supabase client (transport) and the React Query hooks
 * (caching/UI). Responsible for building queries from `CollectionQuery`
 * intents, executing them against Supabase, and mapping the results into
 * domain types. The repository is the only place that knows the table name
 * and column names — hooks and pages never reference them directly.
 *
 * Every query is scoped by `telegramUserId` (the Telegram user is the row
 * owner). RLS allows anon+authenticated; the repository enforces the
 * per-user filter in the query so each collector only sees their own cards.
 */
const TABLE = 'user_cards';

/** Sort key → column + direction mapping. */
const SORT_MAP: Record<string, { column: string; ascending: boolean }> = {
  recent: { column: 'created_at', ascending: false },
  name: { column: 'card_snapshot->>name', ascending: true },
  value: { column: 'purchase_price', ascending: false },
};

function unwrap<T>(thenable: PromiseLike<{ data: T; error: PostgrestError | null }>, op: string): Promise<T> {
  return Promise.resolve(thenable).then(({ data, error }) => {
    if (error) throw fromPostgrestError(error, op);
    return data;
  });
}

function unwrapMaybe<T>(
  thenable: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  op: string
): Promise<T | null> {
  return Promise.resolve(thenable).then(({ data, error }) => {
    if (error) throw fromPostgrestError(error, op);
    return data ?? null;
  });
}

export class CollectionRepository {
  async list(query: CollectionQuery): Promise<UserCard[]> {
    let builder = supabase
      .from(TABLE)
      .select('*')
      .eq('telegram_user_id', query.telegramUserId);

    if (query.filters.condition) {
      builder = builder.eq('condition', query.filters.condition);
    }
    if (query.filters.language) {
      builder = builder.eq('language', query.filters.language);
    }
    if (query.filters.rarity) {
      builder = builder.eq('card_snapshot->>rarity', query.filters.rarity);
    }
    if (query.filters.setId) {
      builder = builder.eq('card_snapshot->>setCode', query.filters.setId);
    }
    if (query.filters.favoritesOnly) {
      builder = builder.eq('favorite', true);
    }
    if (query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      builder = builder.or(
        `pokemon_card_id.ilike.${term},card_snapshot->>name.ilike.${term},card_snapshot->>setName.ilike.${term}`
      );
    }

    const sortCfg = SORT_MAP[query.sort] ?? SORT_MAP.recent;
    builder = builder.order(sortCfg.column, { ascending: sortCfg.ascending });

    const rows = await unwrap(builder, 'collection.list');
    return (rows as UserCardRow[]).map(mapUserCard);
  }

  async findByCardId(telegramUserId: number, cardId: string): Promise<UserCard | null> {
    const data = await unwrapMaybe(
      supabase
        .from(TABLE)
        .select('*')
        .eq('telegram_user_id', telegramUserId)
        .eq('pokemon_card_id', cardId)
        .maybeSingle(),
      'collection.findByCardId'
    );
    return data ? mapUserCard(data as UserCardRow) : null;
  }

  async create(input: UserCardInput): Promise<UserCard> {
    // If showcase is true, clear any existing showcase for this user first.
    if (input.showcase) {
      await this.clearShowcase(input.telegramUserId);
    }
    const data = await unwrapMaybe(
      supabase.from(TABLE).insert(toUserCardRow(input)).select('*').single(),
      'collection.create'
    );
    if (!data) throw new ApiError('Collection entry was not created', { code: 'COLLECTION_CREATE_FAILED' });
    return mapUserCard(data as UserCardRow);
  }

  async update(id: string, update: UserCardUpdate): Promise<UserCard> {
    // If setting showcase to true, clear any existing showcase first.
    if (update.showcase === true) {
      const current = await unwrapMaybe(
        supabase.from(TABLE).select('telegram_user_id').eq('id', id).maybeSingle(),
        'collection.update.lookup'
      );
      if (current) {
        await this.clearShowcase((current as UserCardRow).telegram_user_id);
      }
    }
    const data = await unwrapMaybe(
      supabase.from(TABLE).update(toUserCardUpdateRow(update)).eq('id', id).select('*').single(),
      'collection.update'
    );
    if (!data) throw new ApiError('Collection entry not found', { code: 'COLLECTION_NOT_FOUND' });
    return mapUserCard(data as UserCardRow);
  }

  async remove(id: string): Promise<void> {
    await unwrap(supabase.from(TABLE).delete().eq('id', id), 'collection.remove');
  }

  async stats(telegramUserId: number): Promise<CollectionStats> {
    const rows = await unwrap(
      supabase
        .from(TABLE)
        .select('pokemon_card_id, quantity, favorite, purchase_price')
        .eq('telegram_user_id', telegramUserId),
      'collection.stats'
    );
    return computeStats(rows as UserCardRow[]);
  }

  /** Clear the showcase flag on all of a user's cards. */
  private async clearShowcase(telegramUserId: number): Promise<void> {
    await unwrap(
      supabase
        .from(TABLE)
        .update({ showcase: false, updated_at: new Date().toISOString() })
        .eq('telegram_user_id', telegramUserId)
        .eq('showcase', true),
      'collection.clearShowcase'
    );
  }
}

export const collectionRepository = new CollectionRepository();
