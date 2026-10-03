import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { LegoImage } from '../components/LegoImage';
import { LegoSetOwnership } from '../components/LegoSetOwnership';
import { fetchSet, fetchSetParts, fetchThemes } from '../services/lego-catalog';
import type { LegoSetPart } from '../types';

interface ColorGroup {
  colorId: number;
  name: string | null;
  rgb: string | null;
  isTrans: boolean;
  parts: LegoSetPart[];
  total: number;
}

export function LegoSetDetailPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const { setNum = '' } = useParams<{ setNum: string }>();
  const [showSpares, setShowSpares] = useState(false);

  const setQuery = useQuery({ queryKey: ['lego-set', setNum], queryFn: () => fetchSet(setNum), enabled: !!setNum });
  const partsQuery = useQuery({ queryKey: ['lego-set-parts', setNum], queryFn: () => fetchSetParts(setNum), enabled: !!setNum });
  const themesQuery = useQuery({ queryKey: ['lego-themes'], queryFn: fetchThemes, staleTime: Infinity });

  const set = setQuery.data;
  const themeName = set?.theme_id != null ? themesQuery.data?.find((x) => x.id === set.theme_id)?.name : null;

  // Spares are never counted as part of the set.
  const { groups, realTotal, realUnique, hasSpares } = useMemo(() => {
    const rows = partsQuery.data ?? [];
    const spares = rows.some((r) => r.is_spare);
    const visible = rows.filter((r) => showSpares || !r.is_spare);
    const byColor = new Map<number, ColorGroup>();
    for (const r of visible) {
      let g = byColor.get(r.color_id);
      if (!g) {
        g = {
          colorId: r.color_id, name: r.color_name, rgb: r.color_rgb,
          isTrans: r.color_is_trans, parts: [], total: 0,
        };
        byColor.set(r.color_id, g);
      }
      g.parts.push(r);
      g.total += r.quantity;
    }
    const real = rows.filter((r) => !r.is_spare);
    return {
      groups: [...byColor.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      realTotal: real.reduce((s, r) => s + r.quantity, 0),
      realUnique: new Set(real.map((r) => `${r.part_num}|${r.color_id}`)).size,
      hasSpares: spares,
    };
  }, [partsQuery.data, showSpares]);

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

        <LegoSetOwnership set={set} parts={partsQuery.data} />

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">{t.lego.partsList}</h2>
            {partsQuery.data && partsQuery.data.length > 0 && (
              <span className="text-[11px] text-white/40">{tr('lego.partsTotal', { count: realTotal, unique: realUnique })}</span>
            )}
          </div>

          {hasSpares && (
            <label className="flex items-center gap-2 text-xs text-white/60 mb-3">
              <input type="checkbox" checked={showSpares} onChange={(e) => setShowSpares(e.target.checked)} />
              {t.lego.showSpares}
            </label>
          )}

          {partsQuery.isLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>}
          {partsQuery.isError && (
            <div className="space-y-2">
              <p className="text-sm text-white/60">{t.lego.loadError}</p>
              <button onClick={() => partsQuery.refetch()} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">{t.lego.retry}</button>
            </div>
          )}
          {partsQuery.data && partsQuery.data.length === 0 && <p className="text-sm text-white/50">{t.lego.noParts}</p>}

          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.colorId}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                    style={{ background: g.rgb ? `#${g.rgb}` : 'transparent', opacity: g.isTrans ? 0.6 : 1 }} />
                  <h3 className="text-xs font-bold flex-1 truncate">{g.name ?? t.lego.unknownColor}</h3>
                  <span className="text-[11px] text-white/40">×{g.total}</span>
                </div>
                <ul className="grid grid-cols-3 gap-2">
                  {g.parts.map((p) => (
                    <li key={`${p.part_num}|${p.is_spare}`} className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
                      <LegoImage src={p.img_url} alt={p.part_name} className="w-full aspect-square" />
                      <div className="p-2">
                        <p className="text-[10px] text-red-300 font-semibold flex items-center justify-between">
                          <span className="truncate">{p.part_num}</span>
                          <span className="text-white text-xs font-bold shrink-0">×{p.quantity}</span>
                        </p>
                        <p className="text-[10px] text-white/50 leading-tight line-clamp-2">{p.part_name}</p>
                        {p.is_spare && <p className="text-[9px] uppercase text-yellow-400/80 mt-0.5">{t.lego.spare}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">
            {t.lego.attribution}
          </a>
        </p>
      </div>
    </div>
  );
}
