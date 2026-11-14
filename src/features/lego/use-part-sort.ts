import { useEffect, useState } from 'react';
import { defaultDir, type PartSort, type PartSortKey } from './part-sort';

/** The chosen order of one list, remembered per device when storage allows it (a convenience, never required). */
export function usePartSort(storageKey: string, keys: readonly PartSortKey[], initial: PartSortKey): [PartSort, (s: PartSort) => void] {
  const [sort, setSort] = useState<PartSort>(() => {
    const base: PartSort = { key: initial, dir: defaultDir(initial) };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<PartSort> | null;
      if (saved && keys.includes(saved.key as PartSortKey) && (saved.dir === 'asc' || saved.dir === 'desc')) return saved as PartSort;
    } catch { /* storage unavailable or corrupt */ }
    return base;
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(sort)); } catch { /* storage unavailable */ }
  }, [storageKey, sort]);
  return [sort, setSort];
}
