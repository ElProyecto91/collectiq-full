import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface CollectionCard {
  id: string;
  card_id: string;
  card_name: string;
  set_name: string;
  set_series: string;
  rarity: string;
  image_small: string;
  image_large: string;
  number: string;
  quantity: number;
  favorite: boolean;
  market_price: number | null;
  user_telegram_id: string;
}

const TELEGRAM_ID = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() ?? 'dev-user';

export function useSupabaseCollection() {
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar colección desde Supabase
  useEffect(() => {
    async function fetchCollection() {
      setLoading(true);

      // 1. Buscar o crear colección del usuario
      let { data: collections } = await supabase
        .from('collections')
        .select('id')
        .eq('name', `collection_${TELEGRAM_ID}`)
        .limit(1);

      let collectionId: string;

      if (!collections || collections.length === 0) {
        const { data: newCol } = await supabase
          .from('collections')
          .insert({ name: `collection_${TELEGRAM_ID}` })
          .select('id')
          .single();
        collectionId = newCol!.id;
      } else {
        collectionId = collections[0].id;
      }

      // 2. Cargar items
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('collection_id', collectionId);

      setCards((items as CollectionCard[]) ?? []);
      setLoading(false);
    }

    fetchCollection();
  }, []);

  // Añadir carta
  async function addCard(card: Omit<CollectionCard, 'id'>) {
    const { data: collections } = await supabase
      .from('collections')
      .select('id')
      .eq('name', `collection_${TELEGRAM_ID}`)
      .limit(1);

    const collectionId = collections![0].id;

    const { data } = await supabase
      .from('items')
      .insert({ ...card, collection_id: collectionId, user_telegram_id: TELEGRAM_ID })
      .select()
      .single();

    if (data) setCards(prev => [...prev, data as CollectionCard]);
  }

  // Eliminar carta
  async function removeCard(id: string) {
    await supabase.from('items').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
  }

  // Toggle favorito
  async function toggleFavorite(id: string) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    await supabase.from('items').update({ favorite: !card.favorite }).eq('id', id);
    setCards(prev => prev.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c));
  }

  return { cards, loading, addCard, removeCard, toggleFavorite };
}