import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BATCH, PriceError, loadCachedPrices, needsFetch, requestKey, requestPrices, rowKey,
  type LegoPrice, type PriceRequest,
} from './services/lego-prices';

/** Errors after which asking again right now is pointless. */
const FATAL = new Set(['not_configured', 'bricklink_auth', 'rate_limited', 'unauthorized', 'network']);

/**
 * Prices (BrickLink, euros) for a list of parts/sets: what is already saved shows at once, and with `auto` the
 * missing ones are fetched in the background, a few at a time, with progress. It stops on a fatal error
 * (credentials, daily limit...) and exposes it, and never asks twice for the same item in one visit.
 */
export function useLegoPrices(requests: PriceRequest[], auto: boolean) {
  const sig = useMemo(() => requests.map(requestKey).sort().join(','), [requests]);
  const cacheQ = useQuery({
    queryKey: ['lego-prices-cache', sig],
    queryFn: () => loadCachedPrices(requests),
    enabled: requests.length > 0,
    staleTime: 60_000,
  });
  const [fresh, setFresh] = useState<Map<string, LegoPrice>>(new Map());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const attempted = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const prices = useMemo(() => new Map([...(cacheQ.data ?? new Map()), ...fresh]), [cacheQ.data, fresh]);
  const missing = useMemo(
    () => requests.filter((r) => needsFetch(prices.get(requestKey(r))) && !attempted.current.has(requestKey(r))),
    [requests, prices],
  );

  const run = useCallback(async (queue: PriceRequest[]) => {
    if (running.current || queue.length === 0) return;
    running.current = true;
    setError(null);
    const total = queue.length;
    const left = [...queue];
    try {
      while (left.length && alive.current) {
        const batch = left.splice(0, BATCH);
        batch.forEach((b) => attempted.current.add(requestKey(b)));
        const res = await requestPrices(batch);
        if (!alive.current) return;
        setFresh((prev) => { const m = new Map(prev); res.prices.forEach((p) => m.set(rowKey(p), p)); return m; });
        setProgress({ done: total - left.length, total });
        if (res.stopped) { setError(res.stopped); break; }
      }
    } catch (e) {
      if (alive.current) setError(e instanceof PriceError ? e.code : 'unknown');
    } finally {
      running.current = false;
      if (alive.current) setProgress(null);
    }
  }, []);

  useEffect(() => {
    if (auto && cacheQ.isSuccess && missing.length > 0 && !running.current && !(error && FATAL.has(error))) void run(missing);
  }, [auto, cacheQ.isSuccess, missing, error, run]);

  /** Retry now (e.g. after fixing the credentials), ignoring what was already attempted. */
  const retry = useCallback(() => { attempted.current.clear(); setError(null); void run(requests.filter((r) => needsFetch(prices.get(requestKey(r))))); }, [requests, prices, run]);

  return { prices, loading: cacheQ.isLoading, progress, error, missing: missing.length, retry };
}
