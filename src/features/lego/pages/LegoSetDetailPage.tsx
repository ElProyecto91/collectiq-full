import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { LegoImage } from '../components/LegoImage';
import { LegoInstructions } from '../components/LegoInstructions';
import { LegoPartSort } from '../components/LegoPartSort';
import { buildPartLines, type PartLine } from '../part-lines';
import { sortParts, type PartSortKey } from '../part-sort';
import { usePartSort } from '../use-part-sort';
import { priceKey, type PriceRequest } from '../services/lego-prices';
import { unitPrices, formatEuro } from '../value';
import { useLegoPrices } from '../use-lego-prices';
import { useColorName } from '../use-color-name';
import { LegoSetOwnership } from '../components/LegoSetOwnership';
import { LegoSetProgress } from '../components/LegoSetProgress';
import { fetchSet, fetchSetParts, fetchThemes } from '../services/lego-catalog';
import type { LegoSetPart } from '../types';

// A set's own part list has no "added" date and nothing is "missing": those keys are for the collection / progress.
const SORT_KEYS: readonly PartSortKey[] = ['color', 'number', 'quantity', 'name'];

const Swatch = ({ rgb, trans }: { rgb: string | null; trans: boolean }) => (
  <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 inline-block"
    style={{ background: rgb ? `#${rgb}` : 'transparent', opacity: trans ? 0.6 : 1 }} />
);

function PartTile({ line, showColor = false }: { line: PartLine; showColor?: boolean }) {
  const { t, tr } = useI18n();
  const cn = useColorName();
  const { row: p, real, spare } = line;
  return (
    <li className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
      <LegoImage src={p.img_url} alt={p.part_name} className="w-full aspect-square" />
      <div className="p-2">
        <p className="text-[10px] text-red-300 font-semibold flex items-center justify-between">
          <span className="truncate">{p.part_num}</span>
          <span className="text-white text-xs font-bold shrink-0">×{real + spare}</span>
        </p>
        <p className="text-[10px] text-white/50 leading-tight line-clamp-2">{p.part_name}</p>
        {showColor && (
          <p className="text-[10px] text-white/60 flex items-start gap-1 mt-0.5">
            <Swatch rgb={p.color_rgb} trans={p.color_is_trans} /><span className="leading-tight line-clamp-2">{p.color_name ? cn(p.color_name) : t.lego.unknownColor}</span>
          </p>
        )}
        {spare > 0 && (
          <p className="text-[9px] uppercase text-yellow-400/80 mt-0.5">
            {real > 0 ? tr('lego.partSplit', { real, spare }) : tr('lego.partSpareOnly', { spare })}
          </p>
        )}
      </div>
    </li>
  );
}

export function LegoSetDetailPage() {
  const navigate = useNavigate();
  const { t, tr, locale } = useI18n();
  const cn = useColorName();
  const { setNum = '' } = useParams<{ setNum: string }>();
  const [search, setSearch] = useSearchParams();
  const view = search.get('tab') === 'progress' ? 'progress' : 'list';
  const setView = (v: 'list' | 'progress') => setSearch(v === 'progress' ? { tab: 'progress' } : {}, { replace: true });

  const setQuery = useQuery({ queryKey: ['lego-set', setNum], queryFn: () => fetchSet(setNum), enabled: !!setNum });
  const partsQuery = useQuery({ queryKey: ['lego-set-parts', setNum], queryFn: () => fetchSetParts(setNum), enabled: !!setNum });
  const themesQuery = useQuery({ queryKey: ['lego-themes'], queryFn: fetchThemes, staleTime: Infinity });

  const set = setQuery.data;
  const priceReq = useMemo<PriceRequest[]>(() => (setNum ? [{ kind: 'set' as const, num: setNum }] : []), [setNum]);
  const setPricing = useLegoPrices(priceReq, true);
  const setPrice = unitPrices(setPricing.prices.get(priceKey('set', setNum, -1)));
  const themeName = set?.theme_id != null ? themesQuery.data?.find((x) => x.id === set.theme_id)?.name : null;

  // Every part shows what is in the box: the set's own quantity plus its spares, both visible. The set's
  // completeness (progress, ownership) still ignores spares; only this list counts them.
  const { groups, realTotal, realUnique, spareTotal } = useMemo(() => buildPartLines(partsQuery.data ?? []), [partsQuery.data]);
  const [sort, setSort] = usePartSort('lego-sort-set-parts', SORT_KEYS, 'color');
  const partKey = (l: PartLine) => ({ part_num: l.row.part_num, color_name: cn(l.row.color_name), part_name: l.row.part_name, quantity: l.real + l.spare });
  // by color: color groups in the chosen direction, parts of each group by number; any other key: one flat list
  const orderedGroups = useMemo(() => {
    // alphabetical by the name as shown (Spanish names sort differently from the catalog's English)
    const byName = [...groups].sort((a, b) => cn(a.name).localeCompare(cn(b.name), undefined, { sensitivity: 'base' }));
    const ordered = sort.dir === 'asc' ? byName : byName.reverse();
    return ordered.map((g) => ({ ...g, parts: sortParts(g.parts, partKey, { key: 'number', dir: 'asc' }) }));
  }, [groups, sort.dir, cn]);
  const flat = useMemo(
    () => (sort.key === 'color' ? [] : sortParts(groups.flatMap((g) => g.parts), partKey, sort)), [groups, sort, cn]);

  const back = () => navigate(RoutePaths.LegoSets);

  if (setQuery.isLoading) {
    return <div className="min-h-screen bg-[#0a0a0f] flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>;
  }
  if (setQuery.isError || !set) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white px-4 pt-6 space-y-4">
        <button onClick={back} aria-label={t.lego.back} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-sm text-white/60">{setQuery.isError ? t.lego.loadError : t.lego.setNotFound}</p>
        {setQuery.isError && <p className="text-[11px] text-white/30 break-words">{(setQuery.error as Error)?.message}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={back} aria-label={t.lego.back} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-xs text-red-300 font-semibold">{set.set_num}</p>
      </div>

      <div className="px-4 space-y-4">
        <LegoImage src={set.img_url} alt={set.name} className="w-full aspect-[4/3] rounded-2xl" />
        <div>
          <h1 className="text-xl font-black leading-tight">{set.name}</h1>
          <dl className="grid grid-cols-3 gap-2 mt-3 text-center">
            {[
              [t.lego.year, set.year ?? '—'],
              [t.lego.theme, themeName ?? '—'],
              [t.lego.setNumber, set.set_num],
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-white/[0.04] border border-white/8 rounded-xl p-2 min-w-0">
                <dt className="text-[10px] uppercase tracking-wider text-white/40">{label}</dt>
                <dd className="text-xs font-bold truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(setPrice.newP != null || setPrice.usedP != null) && (
          <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-1">
            <h2 className="text-sm font-bold">{t.lego.valueSetTitle}</h2>
            <p className="text-lg font-black tabular-nums">
              {tr('lego.valueSetRow', { used: setPrice.usedP != null ? formatEuro(setPrice.usedP, locale) : '–', new: setPrice.newP != null ? formatEuro(setPrice.newP, locale) : '–' })}
            </p>
            <p className="text-[10px] text-white/30">{t.lego.valueNote}</p>
          </section>)}

        {/* books, gear and other sets without parts have no manual */}
        {set.num_parts === 0
          ? <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-2">
              <h2 className="text-sm font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-red-300" />{t.lego.instructions}</h2>
              <p className="text-xs text-white/50">{t.lego.instructionsNone}</p>
            </section>
          : <LegoInstructions setNum={set.set_num} />}

        <LegoSetOwnership set={set} parts={partsQuery.data} />

        <div className="flex gap-2" role="tablist">
          {([['list', t.lego.listView], ['progress', t.lego.progressView]] as const).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold border ${view === v ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5 text-white/60'}`}>{label}</button>))}
        </div>

        {view === 'progress' && partsQuery.data && <LegoSetProgress setNum={set.set_num} parts={partsQuery.data} />}

        {view === 'list' && <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">{t.lego.partsList}</h2>
            {partsQuery.data && partsQuery.data.length > 0 && (
              <span className="text-[11px] text-white/40 text-right">
                {tr('lego.partsTotal', { count: realTotal, unique: realUnique })}
                {spareTotal > 0 && <><br />{tr('lego.partsInBox', { total: realTotal + spareTotal, spare: spareTotal })}</>}
              </span>
            )}
          </div>

          {spareTotal > 0 && <p className="text-[11px] text-white/45 mb-3">{t.lego.sparesHelp}</p>}

          {partsQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
          {partsQuery.isError && (
            <div className="space-y-2">
              <p className="text-sm text-white/60">{t.lego.loadError}</p>
              <button onClick={() => partsQuery.refetch()} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">{t.lego.retry}</button>
            </div>
          )}
          {partsQuery.data && partsQuery.data.length === 0 && <p className="text-sm text-white/50">{t.lego.noParts}</p>}

          {partsQuery.data && partsQuery.data.length > 0 && (
            <div className="mb-3"><LegoPartSort keys={SORT_KEYS} value={sort} onChange={setSort} /></div>)}

          {sort.key === 'color' ? (
            <div className="space-y-4">
              {orderedGroups.map((g) => (
                <div key={g.colorId}>
                  <div className="flex items-center gap-2 mb-2">
                    <Swatch rgb={g.rgb} trans={g.isTrans} />
                    <h3 className="text-xs font-bold flex-1 truncate">{g.name ? cn(g.name) : t.lego.unknownColor}</h3>
                    <span className="text-[11px] text-white/40">×{g.total}</span>
                  </div>
                  <ul className="grid grid-cols-3 gap-2">
                    {g.parts.map((line) => <PartTile key={line.row.part_num} line={line} />)}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2">
              {flat.map((line) => <PartTile key={`${line.row.part_num}|${line.row.color_id}`} line={line} showColor />)}
            </ul>
          )}
        </section>}

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">
            {t.lego.attribution}
          </a>
        </p>
      </div>
    </div>
  );
}
