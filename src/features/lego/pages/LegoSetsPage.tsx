import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, X, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { LegoImage } from '../components/LegoImage';
import {
  LEGO_PAGE_SIZE, fetchThemes, searchSets, themeWithDescendants,
} from '../services/lego-catalog';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const toYear = (s: string): number | null => {
  const n = Number.parseInt(s, 10);
  return Number.isInteger(n) && n >= 1949 && n <= 2100 ? n : null; // LEGO sets start in 1949
};

export function LegoSetsPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();

  const [q, setQ] = useState('');
  const [themeId, setThemeId] = useState<number | null>(null);
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [page, setPage] = useState(0);

  const dq = useDebounced(q, 300);
  const dFrom = useDebounced(yearFrom, 500);
  const dTo = useDebounced(yearTo, 500);

  const themesQuery = useQuery({ queryKey: ['lego-themes'], queryFn: fetchThemes, staleTime: Infinity });
  const themes = themesQuery.data ?? [];
  const rootThemes = useMemo(() => themes.filter((x) => x.parent_id === null), [themes]);
  const themeNames = useMemo(() => new Map(themes.map((x) => [x.id, x.name])), [themes]);
  const themeIds = useMemo(
    () => (themeId === null ? [] : themeWithDescendants(themes, themeId)),
    [themes, themeId]
  );

  // any filter change goes back to the first page
  useEffect(() => { setPage(0); }, [dq, themeId, dFrom, dTo]);

  const yf = toYear(dFrom);
  const yt = toYear(dTo);
  const setsQuery = useQuery({
    queryKey: ['lego-sets', dq, themeIds, yf, yt, page],
    queryFn: () => searchSets({ q: dq, themeIds, yearFrom: yf, yearTo: yt, page }),
    placeholderData: (prev) => prev,
  });

  const total = setsQuery.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LEGO_PAGE_SIZE));
  const hasFilters = q !== '' || themeId !== null || yearFrom !== '' || yearTo !== '';
  const catalogEmpty = !hasFilters && !setsQuery.isLoading && !setsQuery.isError && total === 0;

  const clear = () => { setQ(''); setThemeId(null); setYearFrom(''); setYearTo(''); };
  const field = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur px-4 pt-5 pb-3 space-y-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-black">{t.lego.catalog}</h1>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.lego.searchPlaceholder}
            inputMode="search" className={`${field} w-full pl-9`} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select value={themeId ?? ''} onChange={(e) => setThemeId(e.target.value === '' ? null : Number(e.target.value))}
            aria-label={t.lego.theme} className={`${field} col-span-2`}>
            <option value="">{t.lego.allThemes}</option>
            {rootThemes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={t.lego.yearFrom} inputMode="numeric" className={field} />
          <input value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={t.lego.yearTo} inputMode="numeric" className={field} />
        </div>

        <div className="flex items-center justify-between text-xs text-white/50 min-h-5">
          <span>{setsQuery.data ? tr('lego.results', { count: total }) : ''}</span>
          {hasFilters && (
            <button onClick={clear} className="flex items-center gap-1 text-red-300">
              <X className="w-3 h-3" />{t.lego.clearFilters}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {setsQuery.isLoading && (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
        )}

        {setsQuery.isError && (
          <div className="text-center py-16 space-y-3">
            <p className="text-sm text-white/60">{t.lego.loadError}</p>
            <button onClick={() => setsQuery.refetch()} className="px-4 py-2 rounded-xl bg-white/10 text-sm">{t.lego.retry}</button>
          </div>
        )}

        {catalogEmpty && <p className="text-center text-sm text-white/50 py-16">{t.lego.emptyCatalog}</p>}
        {hasFilters && setsQuery.data && total === 0 && (
          <p className="text-center text-sm text-white/50 py-16">{t.lego.noResults}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {setsQuery.data?.sets.map((s) => (
            <button key={s.set_num} onClick={() => navigate(`/lego/sets/${encodeURIComponent(s.set_num)}`)}
              className="text-left bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden active:scale-[0.98] transition-transform">
              <LegoImage src={s.img_url} alt={s.name} className="w-full aspect-[4/3]" />
              <div className="p-3 space-y-0.5">
                <p className="text-[11px] text-red-300 font-semibold">{s.set_num}</p>
                <p className="text-sm font-bold leading-tight line-clamp-2">{s.name}</p>
                <p className="text-[11px] text-white/40">
                  {[s.year, s.theme_id !== null ? themeNames.get(s.theme_id) : null,
                    s.num_parts !== null ? tr('lego.pieces', { count: s.num_parts }) : null]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>

        {total > LEGO_PAGE_SIZE && (
          <div className="flex items-center justify-between pt-6 text-sm">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-xl bg-white/10 disabled:opacity-30">{t.lego.prev}</button>
            <span className="text-xs text-white/50">{tr('lego.pageOf', { page: page + 1, pages })}</span>
            <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-xl bg-white/10 disabled:opacity-30">{t.lego.next}</button>
          </div>
        )}

        <p className="text-[11px] text-white/30 pt-8">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">
            {t.lego.attribution}
          </a>
        </p>
      </div>
    </div>
  );
}
