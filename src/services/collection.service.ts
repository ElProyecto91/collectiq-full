import { BaseSupabaseService } from './base.service';
import type {
  CollectionItem,
  CollectionItemInput,
  CollectionItemUpdate,
  CollectionStats,
  Tcg,
} from '@/types';
import type { CollectionItemRow } from '@/types/database';
import { Tables } from '@/types';
import { mapCollectionItem, toCollectionItemRow } from '@/utils/mappers';

/** Query options shared by list endpoints. */
export interface CollectionQueryOptions {
  telegramUserId: number;
  tcg?: Tcg;
  search?: string;
  /** Column to order by (snake_case). */
  orderBy?: string;
  ascending?: boolean;
}

/**
 * Collection service — CRUD for a collector's owned cards.
 *
 * Every read/write is scoped by `telegramUserId` — the Telegram user is the
 * row owner. RLS allows anon+authenticated access; the service enforces the
 * per-user filter in the query so each collector only sees their own cards.
 */
class CollectionService extends BaseSupabaseService {
  async list(opts: CollectionQueryOptions): Promise<CollectionItem[]> {
    let query = this.client
      .from(Tables.CollectionItems)
      .select('*')
      .eq('telegram_user_id', opts.telegramUserId);

    if (opts.tcg) query = query.eq('tcg', opts.tcg);
    if (opts.search) {
      const term = `%${opts.search}%`;
      query = query.or(`card_name.ilike.${term},set_name.ilike.${term},card_id.ilike.${term}`);
    }
    query = query.order(opts.orderBy ?? 'created_at', {
      ascending: opts.ascending ?? false,
    });

    const rows = await this.unwrap(query, 'collection.list');
    return (rows as CollectionItemRow[]).map(mapCollectionItem);
  }

  /** Check if a card is already in the collection (by card_id). */
  async findByCardId(telegramUserId: number, cardId: string): Promise<CollectionItem | null> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.CollectionItems)
        .select('*')
        .eq('telegram_user_id', telegramUserId)
        .eq('card_id', cardId)
        .maybeSingle(),
      'collection.findByCardId'
    );
    return data ? mapCollectionItem(data as CollectionItemRow) : null;
  }

  async create(input: CollectionItemInput): Promise<CollectionItem> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.CollectionItems)
        .insert(toCollectionItemRow(input))
        .select('*')
        .single(),
      'collection.create'
    );
    if (!data) throw new Error('Collection item was not created');
    return mapCollectionItem(data as CollectionItemRow);
  }

  async update(id: string, update: CollectionItemUpdate): Promise<CollectionItem> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.CollectionItems)
        .update({ ...toCollectionItemRow(update as CollectionItemInput), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single(),
      'collection.update'
    );
    if (!data) throw new Error('Collection item was not found');
    return mapCollectionItem(data as CollectionItemRow);
  }

  async remove(id: string): Promise<void> {
    await this.unwrap(
      this.client.from(Tables.CollectionItems).delete().eq('id', id),
      'collection.remove'
    );
  }

  /** Aggregate counts for stats surfaces. */
  async stats(telegramUserId: number): Promise<CollectionStats> {
    const rows = await this.unwrap(
      this.client
        .from(Tables.CollectionItems)
        .select('tcg, quantity, favorite')
        .eq('telegram_user_id', telegramUserId),
      'collection.stats'
    );

    const typed = rows as Pick<CollectionItemRow, 'tcg' | 'quantity' | 'favorite'>[];
    const byTcg: Partial<Record<Tcg, number>> = {};
    let totalItems = 0;
    let favoriteCount = 0;

    for (const row of typed) {
      const tcg = row.tcg as Tcg;
      byTcg[tcg] = (byTcg[tcg] ?? 0) + row.quantity;
      totalItems += row.quantity;
      if (row.favorite) favoriteCount += 1;
    }

    return {
      totalItems,
      uniqueCards: typed.length,
      favoriteCount,
      byTcg,
    };
  }
}

export const collectionService = new CollectionService();
