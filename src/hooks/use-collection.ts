import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { mapCollectionItem } from '@/utils/mappers';
import { useUserStore } from '@/store';
import type { CollectionItem, CollectionItemInput } from '@/types';

export function useCollection(tcg?: string) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const telegramUser = useUserStore(s => s.telegramUser);

  const fetchItems = useCallback(async () => {
    if (!telegramUser?.id) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from('collection_items')
      .select('*')
      .eq('telegram_user_id', telegramUser.id)
      .order('created_at', { ascending: false });
    if (tcg) q = q.eq('tcg', tcg);
    const { data } = await q;
    setItems((data ?? []).map(mapCollectionItem));
    setLoading(false);
  }, [telegramUser?.id, tcg]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = useCallback(async (item: Partial<CollectionItemInput>) => {
    if (!telegramUser?.id) return;
    const { data, error } = await supabase
      .from('collection_items')
      .insert({ ...item, telegram_user_id: telegramUser.id })
      .select()
      .single();
    if (!error && data) setItems(prev => [mapCollectionItem(data), ...prev]);
  }, [telegramUser?.id]);

  const updateItem = useCallback(async (id: string, updates: Partial<CollectionItemInput>) => {
    const { data, error } = await supabase
      .from('collection_items')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) setItems(prev => prev.map(i => i.id === id ? mapCollectionItem(data) : i));
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await supabase.from('collection_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const stats = {
    total: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    totalValue: items.reduce((s, i) => s + (i.marketPrice ?? i.tcgplayerPrice ?? 0) * i.quantity, 0),
    totalCost: items.reduce((s, i) => s + (i.purchasePrice ?? 0) * i.quantity, 0),
    roi: (() => {
      const cost = items.reduce((s, i) => s + (i.purchasePrice ?? 0) * i.quantity, 0);
      const value = items.reduce((s, i) => s + (i.marketPrice ?? i.tcgplayerPrice ?? 0) * i.quantity, 0);
      return cost > 0 ? ((value - cost) / cost) * 100 : 0;
    })(),
    favorites: items.filter(i => i.favorite).length,
    byTcg: items.reduce((acc, i) => { acc[i.tcg] = (acc[i.tcg] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  };

  return {
    items, loading, error: null,
    addItem, updateItem, removeItem,
    refresh: fetchItems, refetch: fetchItems,
    stats, data: items, isLoading: loading
  };
}

export function useCollectionList(tcg?: string) { return useCollection(tcg); }
export function useCollectionItem(_id?: string) {
  const col = useCollection();
  return { item: null, isLoading: col.loading };
}
export function useCollectionStats() {
  const col = useCollection();
  return { stats: col.stats, isLoading: col.loading };
}
export function useCreateCollectionItem() {
  const col = useCollection();
  return { mutate: (item: any) => col.addItem(item), isPending: false };
}
export function useUpdateCollectionItem() {
  const col = useCollection();
  return { mutate: ({ id, update }: any) => col.updateItem(id, update), isPending: false };
}
export function useDeleteCollectionItem() {
  const col = useCollection();
  return { mutate: (id: string) => col.removeItem(id), isPending: false };
}