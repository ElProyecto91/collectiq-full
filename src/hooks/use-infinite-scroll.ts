import { useCallback, useRef } from 'react';

/**
 * Infinite-scroll sentinel hook.
 *
 * Returns a ref to attach to a sentinel element at the end of a list. When it
 * intersects the viewport, `onLoadMore` is called. Uses the IntersectionObserver
 * API for efficient, passive scroll detection — no scroll event listeners.
 */
export function useInfiniteScroll(onLoadMore: () => void, enabled: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !enabled) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) onLoadMore();
        },
        { rootMargin: '240px 0px' }
      );
      observerRef.current.observe(node);
    },
    [onLoadMore, enabled]
  );

  return sentinelRef;
}
