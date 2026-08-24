// src/hooks/index.ts
// Re-exporta los hooks nuevos universales
export { useCollection } from './use-collection';
export { useWishlist } from './use-wishlist';
export { useTcgRegistry } from './use-tcg-registry';
export { useScanner } from './use-scanner';

// ── Aliases de compatibilidad ──────────────────────────────────────────────
// Los ficheros existentes importaban estos nombres del hook antiguo.
// En lugar de tocar 15 páginas, los re-exportamos aquí como wrappers.
import { useCollection } from './use-collection';
import { useWishlist } from './use-wishlist';

export function useCollectionList(tcg?: string) {
  return useCollection(tcg);
}

export function useCollectionItem() {
  const col = useCollection();
  return { item: null, isLoading: col.loading };
}

export function useCollectionStats() {
  const col = useCollection();
  return { stats: col.stats, isLoading: col.loading };
}

export function useCreateCollectionItem() {
  const col = useCollection();
  return { mutate: col.addItem, isPending: false };
}

export function useUpdateCollectionItem() {
  const col = useCollection();
  return { mutate: col.updateItem, isPending: false };
}

export function useDeleteCollectionItem() {
  const col = useCollection();
  return { mutate: col.removeItem, isPending: false };
}

export function useWishlistList(tcg?: string) {
  return useWishlist(tcg);
}

export function useCreateWishlistItem() {
  const wish = useWishlist();
  return { mutate: wish.addItem, isPending: false };
}

export function useUpdateWishlistItem() {
  const wish = useWishlist();
  return { mutate: wish.updateItem, isPending: false };
}

export function useDeleteWishlistItem() {
  const wish = useWishlist();
  return { mutate: wish.removeItem, isPending: false };
}