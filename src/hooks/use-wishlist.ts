import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/store';

export interface WishlistItem {
  id: string;
  tcg: string;
  card_id?: string;
  cardId?: string;
  card_name?: string;
  cardName?: string;
  set_name?: string;
  setName?: string;
  card_number?: string;
  cardNumber?: string;
  rarity?: string;
  image_url?: string;
  imageUrl?: string;
  max_price?: number;
  maxPrice?: number;
  notes?: string;
  created_at?: string;
}

function mapWishlistItem(raw: any): WishlistItem {
  return {
    id: raw.id,
    tcg: raw.tcg ?? '',
    card_id: raw.card_id,
    cardId: raw.card_id,
    card_name: raw.card_name,
    cardName: raw.card_name,
    set_name: raw.set_name,
    setName: raw.set_name,
    card_number: raw.card_number,
    cardNumber: raw.card_number,
    rarity: raw.rarity,
    image_url: raw.image_url,
    imageUrl: raw.image_url,
    max_price: raw.max_price,
    maxPrice: raw.max_price,
    notes: raw.notes,
    created_at: raw.created_at,
  };
}

export function useWishlist(tcg?: string) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const telegramUser = useUserStore(s => s.telegramUser);

  const fetchItems = useCallback(async () => {
    if (!telegramUser?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('wishlist_items')
        .select('*')
        .eq('telegram_user_id', telegramUser.id)
        .order('created_at', { ascending: false });
      if (tcg) q = q.eq('tcg', tcg);
      const { data, error: err } = await q;
      if (err) throw err;
      setItems((data ?? []).map(mapWishlistItem));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [telegramUser?.id, tcg]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = useCallback(async (item: Partial<WishlistItem> & Record<string, any>) => {
    if (!telegramUser?.id) return;
    const payload: any = {
      telegram_user_id: telegramUser.id,
      tcg: item.tcg ?? item.tcg,
      card_id: item.card_id ?? item.cardId,
      card_name: item.card_name ?? item.cardName,
      set_name: item.set_name ?? item.setName,
      card_number: item.card_number ?? item.cardNumber,
      rarity: item.rarity,
      image_url: item.image_url ?? item.imageUrl,
      max_price: item.max_price ?? item.maxPrice ?? null,
      notes: item.notes ?? null,
    };
    const { data, error: err } = await supabase
      .from('wishlist_items')
      .insert(payload)
      .select()
      .single();
    if (!err && data) setItems(prev => [mapWishlistItem(data), ...prev]);
    if (err) throw err;
  }, [telegramUser?.id]);

  const updateItem = useCallback(async (id: string, updates: Partial<WishlistItem>) => {
    const { data, error: err } = await supabase
      .from('wishlist_items')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    if (!err && data) setItems(prev => prev.map(i => i.id === id ? mapWishlistItem(data) : i));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await supabase.from('wishlist_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return {
    items, loading, error,
    addItem, updateItem, removeItem,
    refresh: fetchItems,
    data: items,
    isLoading: loading,
  };
}

// ── Aliases de compatibilidad ─────────────────────────────────
export function useWishlistList(tcg?: string) {
  return useWishlist(tcg);
}

export function useCreateWishlistItem() {
  const wish = useWishlist();
  return {
    mutate: async (item: any) => { await wish.addItem(item); },
    isPending: false,
  };
}

export function useUpdateWishlistItem() {
  const wish = useWishlist();
  return {
    mutate: async ({ id, ...updates }: any) => wish.updateItem(id, updates),
    isPending: false,
  };
}

export function useDeleteWishlistItem() {
  const wish = useWishlist();
  return {
    mutate: async (id: string) => wish.removeItem(id),
    isPending: false,
  };
}
