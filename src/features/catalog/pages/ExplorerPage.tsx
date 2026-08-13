import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Loader2,
  SearchX,
  Plus,
  CheckCircle2,
  Search,
  TrendingUp,
  Heart,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useCreateCollectionItem, useCollectionList } from '@/hooks/use-collection';
import { useCreateWishlistItem, useWishlistList } from '@/hooks/use-wishlist';
import { useUserStore } from '@/store';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string; releaseDate?: string };
  cardmarket?: { prices?: { averageSellPrice?: number } };
  types?: string[];
  supertype?: string;
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-500';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-400';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-500';
}

async function searchCards(query: string, page: number): Promise<{ cards: PokemonCard[]; total: number }> {
  const q = query.trim()
    ? `name:"*${query.trim()}*"`
    : 'name:Charizard OR name:Pikachu OR name:Mewtwo';

  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&page=${page}&pageSize=20&orderBy=-set.releaseDate`;

  for (let i = 0; i