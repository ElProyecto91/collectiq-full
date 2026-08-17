import { BaseSupabaseService } from './base.service';
import type { CollectionItem, CollectionItemInput, CollectionItemUpdate, CollectionStats, Tcg } from '@/types';
import type { CollectionItemRow } from '@/types/database';
import { Tables } from '@/types';
import { mapCollectionItem, toCollectionItemRow, toCollectionItemUpdateRow } from '@/utils/mappers';

export interface CollectionQueryOptions {
  telegramUserId: number;
  search?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

class CollectionService extends BaseSupabaseService {
  async list(opts: CollectionQueryOptions): Promise<CollectionItem[]> {
    let query = this.client
      .from(Tables.CollectionItems)
      .select('*')
      .eq('telegram_user_id', opts.telegramUserId);

    if (opts.search) query = query.ilike('card_name', `%${opts.search}%`);
    query = query.order(opts.orderBy ?? 'created_at', { ascending: opts.ascending ?? false });
    if (opts.limit) query = query.limit(opts.limit);

    const rows = await this.unwrap(query, 'collection.list');
    return (rows as CollectionItemRow[]).map(mapCollectionItem);
  }

  async findByCardId(telegramUserId: number, cardId: string): Promise<CollectionItem | null> {
    const { data, error } = await this.client
      .from(Tables.CollectionItems)
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .eq('card_id', cardId)
      .maybeSingle();

    if (error) return null;
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
        .update({ ...toCollectionItemUpdateRow(update), updated_at: new Date().toISOString() })
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

  async stats(telegramUserId: number): Promise<CollectionStats> {
    const rows = await this.unwrap(
      this.client
        .from(Tables.CollectionItems)
        .select('quantity, tcg, card_id')
        .eq('telegram_user_id', telegramUserId),
      'collection.stats'
    );

    const items = rows as { quantity: number; tcg: string; card_id: string }[];
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueCards = new Set(items.map(i => i.card_id)).size;
    const byTcg: Partial<Record<Tcg, number>> = {};

    for (const item of items) {
      const tcg = item.tcg as Tcg;
      byTcg[tcg] = (byTcg[tcg] ?? 0) + item.quantity;
    }

    return {
      totalItems,
      uniqueCards,
      favoriteCount: 0,
      byTcg,
    };
  }
}

export const collectionService = new CollectionService();