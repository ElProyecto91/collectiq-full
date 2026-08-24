import { useState, useEffect, useCallback } from 'react';
import { CollectionItem } from '../types/tcg';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

export function useCollection(tcg?: string) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = tcg ? `/api/collection?tcg=${tcg}` : '/api/collection';
      const r = await fetch(url, { headers: authHeaders() });
      if (!r.ok) throw new Error('Error cargando colección');
      const d = await r.json();
      setItems(d.items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tcg]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = useCallback(async (item: Partial<CollectionItem>) => {
    const r = await fetch('/api/collection', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(item)
    });
    if (!r.ok) throw new Error('Error añadiendo item');
    const d = await r.json();
    if (d.action === 'created') {
      setItems(prev => [d.item, ...prev]);
    } else if (d.action === 'quantity_updated') {
      setItems(prev => prev.map(i => i.id === d.item.id ? d.item : i));
    }
    return d;
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<CollectionItem>) => {
    const r = await fetch(`/api/collection?id=${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates)
    });
    if (!r.ok) throw new Error('Error actualizando item');
    const d = await r.json();
    setItems(prev => prev.map(i => i.id === id ? d.item : i));
    return d.item;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const r = await fetch(`/api/collection?id=${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!r.ok) throw new Error('Error eliminando item');
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updatePrices = useCallback(async (tcgId: string) => {
    const r = await fetch('/api/prices', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tcg: tcgId })
    });
    if (!r.ok) throw new Error('Error actualizando precios');
    const d = await r.json();
    await fetchItems();
    return d;
  }, [fetchItems]);

  const stats = {
    total: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    totalValue: items.reduce((s, i) => s + (i.market_value ?? 0) * i.quantity, 0),
    totalCost: items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0),
    roi: (() => {
      const cost = items.reduce((s, i) => s + (i.purchase_price ?? 0) * i.quantity, 0);
      const value = items.reduce((s, i) => s + (i.market_value ?? 0) * i.quantity, 0);
      return cost > 0 ? ((value - cost) / cost) * 100 : 0;
    })(),
    favorites: items.filter(i => i.is_favorite).length,
    forSale: items.filter(i => i.is_for_sale).length,
    byTcg: items.reduce((acc, i) => {
      acc[i.tcg] = (acc[i.tcg] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return {
    items, loading, error,
    addItem, updateItem, removeItem, updatePrices,
    refresh: fetchItems,
    refetch: fetchItems,
    stats,
    data: items,
    isLoading: loading
  };
}

// ── Aliases de compatibilidad ────────────────────────────────────────────────
export function useCollectionList(tcg?: string) {
  return useCollection(tcg);
}

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
  return {
    mutate: async (item: any) => col.addItem(item),
    isPending: false
  };
}

export function useUpdateCollectionItem() {
  const col = useCollection();
  return {
    mutate: async ({ id, ...updates }: any) => col.updateItem(id, updates),
    isPending: false
  };
}

export function useDeleteCollectionItem() {
  const col = useCollection();
  return {
    mutate: async (id: string) => col.removeItem(id),
    isPending: false
  };
}