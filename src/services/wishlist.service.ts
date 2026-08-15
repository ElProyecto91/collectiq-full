import { BaseSupabaseService } from './base.service';
import type { WishlistItem, WishlistItemInput, WishlistItemUpdate, Tcg } from '@/types';
import type { WishlistItemRow } from '@/types/database';
import { Tables } from '@/types';
import { mapWishlistItem, toWishlistItemRow } from '@/utils/mappers';

export interface WishlistQueryOptions {
  telegramUserId?: number;
  tcg?: Tcg;
  search?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

class WishlistService extends BaseSupabaseService {
  async list(opts: WishlistQueryOptions = {}): Promise<WishlistItem[]> {
    let query = this.client.from(Tables.WishlistItems).select('*');

    if (opts.telegramUserId) query = query.eq('telegram_user_id', opts.telegramUserId);
    if (opts.tcg) query = query.eq('tcg', opts.tcg);
    if (opts.search) query = query.ilike('card_name', `%${opts.search}%`);
    query = query.order(opts.orderBy ?? 'created_at', { ascending: opts.ascending ?? false });
    if (opts.limit) query = query.limit(opts.limit);

    const rows = await this.unwrap(query, 'wishlist.list');
    return (rows as WishlistItemRow[]).map(mapWishlistItem);
  }

  async create(input: WishlistItemInput): Promise<WishlistItem> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.WishlistItems)
        .insert(toWishlistItemRow(input))
        .select('*')
        .single(),
      'wishlist.create'
    );
    if (!data) throw new Error('Wishlist item was not created');
    return mapWishlistItem(data as WishlistItemRow);
  }

  async update(id: string, update: WishlistItemUpdate): Promise<WishlistItem> {
    const data = await this.unwrapMaybe(
      this.client
        .from(Tables.WishlistItems)
        .update({ ...toWishlistItemRow(update as WishlistItemInput), updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single(),
      'wishlist.update'
    );
    if (!data) throw new Error('Wishlist item was not found');
    return mapWishlistItem(data as WishlistItemRow);
  }

  async remove(id: string): Promise<void> {
    await this.unwrap(
      this.client.from(Tables.WishlistItems).delete().eq('id', id),
      'wishlist.remove'
    );
  }
}

export const wishlistService = new WishlistService();