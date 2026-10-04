import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { PART_SETS_PAGE, fetchSetsWithPart } from '../services/lego-catalog';
import { LegoImage } from './LegoImage';

interface Props {
  partNum: string;
  colorId: number;
  colorName: string;
  colorRgb: string | null;
  colorIsTrans: boolean;
}

/** The color as a square, as it looks on the brick. Transparent colors are drawn see-through. */
export function ColorSquare({ rgb, trans, size = 'w-5 h-5' }: { rgb: string | null; trans: boolean; size?: string }) {
  return (
    <span aria-hidden="true" className={`${size} rounded-md border border-white/25 shrink-0 inline-block`}
      style={{ background: rgb ? `#${rgb}` : 'transparent', opacity: trans ? 0.6 : 1 }} />
  );
}

/** Sets that contain this part in this color: the answer to "which sets could this piece belong to?". */
export function LegoPartSets({ partNum, colorId, colorName, colorRgb, colorIsTrans }: Props) {
  const { t, tr } = useI18n();
  const navigate = useNavigate();

  const q = useInfiniteQuery({
    queryKey: ['lego-part-sets', partNum, colorId],
    queryFn: ({ pageParam }) => fetchSetsWithPart(partNum, colorId, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (pages.length * PART_SETS_PAGE < last.total ? pages.length : undefined),
    staleTime: 10 * 60_000, // each page reads catalog rows: do not repeat it when reopening
  });
  const sets = q.data?.pages.flatMap((p) => p.sets) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ColorSquare rgb={colorRgb} trans={colorIsTrans} />
        <p className="text-xs text-white/70">
          <span className="font-semibold">{colorName}</span>
          {q.isSuccess && <> · {total === 0 ? t.lego.partSetsNone : tr('lego.partSetsTitle', { count: total })}</>}
        </p>
      </div>
      {q.isLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
      {q.isError && <p className="text-xs text-red-300">{t.lego.loadError}</p>}
      <ul className="space-y-2">
        {sets.map((s) => (
          <li key={s.set_num}>
            <button onClick={() => navigate(`/lego/sets/${encodeURIComponent(s.set_num)}`)}
              className="w-full flex items-center gap-3 bg-white/[0.04] border border-white/8 rounded-xl p-2 text-left active:scale-[0.99] transition-transform">
              <LegoImage src={s.img_url} alt={s.name} className="w-14 h-14 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-red-300 font-semibold">{s.set_num}{s.year ? ` · ${s.year}` : ''}</p>
                <p className="text-xs leading-tight line-clamp-2">{s.name}</p>
              </div>
              <span className="text-xs font-bold text-white/80 shrink-0">{tr('lego.partSetsQty', { count: s.quantity })}</span>
            </button>
          </li>))}
      </ul>
      {q.hasNextPage && (
        <button disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}
          className="w-full rounded-xl bg-white/10 py-2 text-sm flex items-center justify-center gap-2">
          {q.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}{t.lego.showMore}
        </button>)}
    </div>
  );
}
