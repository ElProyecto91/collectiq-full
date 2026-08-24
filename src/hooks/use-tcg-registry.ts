// src/hooks/use-tcg-registry.ts
import { useState, useEffect } from 'react';
import { TcgRegistry } from '../types/tcg';

// Cache en memoria para no llamar a la API en cada render
let cache: TcgRegistry[] | null = null;

export function useTcgRegistry() {
  const [tcgs, setTcgs] = useState<TcgRegistry[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    fetch('/api/tcg-registry')
      .then(r => r.json())
      .then(d => {
        cache = d.tcgs ?? [];
        setTcgs(cache!);
      })
      .catch(() => setError('Error cargando TCGs'))
      .finally(() => setLoading(false));
  }, []);

  const activeTcgs = tcgs.filter(t => t.status === 'active');
  const allTcgs = tcgs;
  const getTcg = (id: string) => tcgs.find(t => t.id === id) ?? null;

  return { tcgs, activeTcgs, allTcgs, getTcg, loading, error };
}