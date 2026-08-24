// src/hooks/use-wishlist.ts
import { useState, useEffect, useCallback } from 'react';
import { WishlistItem } from '../types/tcg';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

export function useWishlist(tcg?: string) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = tcg ? `/api/wishlist?tcg=${tcg}` : '/api/wishlist';
      const r = await fetch(url, { headers: authHeaders() });
      if (!r.ok) throw new Error('Error cargando wishlist');
      const d = await r.json();
      setItems(d.items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tcg]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = useCallback(async (item: Partial<WishlistItem>) => {
    const r = await fetch('/api/wishlist', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(item)
    });
    if (!r.ok) throw new Error('Error añadiendo a wishlist');
    const d = await r.json();
    if (d.action === 'created') {
      setItems(prev => [d.item, ...prev]);
    }
    return d;
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<WishlistItem>) => {
    const r = await fetch(`/api/wishlist?id=${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates)
    });
    if (!r.ok) throw new Error('Error actualizando wishlist');
    const d = await r.json();
    setItems(prev => prev.map(i => i.id === id ? d.item : i));
    return d.item;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const r = await fetch(`/api/wishlist?id=${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!r.ok) throw new Error('Error eliminando de wishlist');
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return {
    items, loading, error,
    addItem, updateItem, removeItem,
    refresh: fetchItems
  };
}