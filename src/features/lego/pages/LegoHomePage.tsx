import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, ChevronRight, ClipboardList, Heart, Layers, Package, Plus, ScanLine, Search } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { availability } from '../services/lego-allocation';
import { listAllocations, listUserParts, listUserSets } from '../services/lego-user';

const PENDING_PATH = `${RoutePaths.LegoMySets}?tab=pending`;

/** One number of the summary strip; shows a dash while the figure is not loaded. */
function Stat({ value, label, accent }: { value: number | null; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 min-w-0 px-3 py-3 text-center">
      <p className={`text-xl font-black leading-none tabular-nums ${accent ? 'text-red-300' : 'text-white'}`}>
        {value === null ? '–' : value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/45 mt-1.5 leading-tight">{label}</p>
    </div>
  );
}

interface Tile {
  icon: typeof Boxes;
  label: string;
  desc: string;
  path: string;
  badge?: string | null;
}

export function LegoHomePage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const tid = useUserStore((s) => s.telegramUser?.id);

  // everything on this screen comes from Supabase: opening it costs no catalog reads
  const partsQuery = useQuery({ queryKey: ['user-lego-parts', tid], queryFn: () => listUserParts(tid!), enabled: tid != null });
  const allocsQuery = useQuery({ queryKey: ['user-lego-allocs', tid], queryFn: () => listAllocations(tid!), enabled: tid != null });
  const setsQuery = useQuery({ queryKey: ['user-lego-sets', tid], queryFn: () => listUserSets(tid!), enabled: tid != null });

  const stats = useMemo(() => {
    const parts = partsQuery.data;
    const av = parts ? availability(parts, allocsQuery.data ?? []) : null;
    const total = parts ? parts.reduce((n, p) => n + p.quantity, 0) : null;
    const free = av ? [...av.values()].reduce((n, a) => n + a.free, 0) : null;
    const sets = setsQuery.data;
    return {
      total, free, kinds: parts ? parts.length : null,
      assigned: total !== null && free !== null ? Math.max(0, total - free) : null,
      sets: sets ? sets.length : null,
      incomplete: sets ? sets.filter((s) => s.status === 'incomplete').length : null,
    };
  }, [partsQuery.data, allocsQuery.data, setsQuery.data]);

  const empty = partsQuery.isSuccess && (partsQuery.data?.length ?? 0) === 0;
  const assignedPct = stats.total ? Math.round(((stats.assigned ?? 0) / stats.total) * 100) : 0;

  const tiles: Tile[] = [
    { icon: Boxes, label: t.lego.inventory, desc: t.lego.myPartsDesc, path: RoutePaths.LegoParts,
      badge: stats.kinds === null ? null : tr('lego.homeKinds', { count: stats.kinds }) },
    { icon: Package, label: t.lego.mySets, desc: t.lego.mySetsDesc, path: RoutePaths.LegoMySets,
      badge: stats.sets === null ? null : String(stats.sets) },
    { icon: Layers, label: t.lego.possibleSets, desc: t.lego.possibleHome, path: RoutePaths.LegoPossible },
    { icon: ClipboardList, label: t.lego.pendingTab, desc: t.lego.pendingHomeDesc, path: PENDING_PATH,
      badge: stats.incomplete ? String(stats.incomplete) : null },
  ];

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(180deg, #3a0707 0%, #14070a 14%, #0a0a0f 34%)' }}>
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.Home)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t.lego.title}</h1>
          <p className="text-xs text-white/50">{t.lego.subtitle}</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* summary */}
        {tid != null && (
          <section aria-label={t.lego.homeSummary} className="rounded-2xl bg-white/[0.05] border border-white/10 overflow-hidden">
            <div className="flex divide-x divide-white/10">
              <Stat value={stats.total} label={t.lego.homePieces} />
              <Stat value={stats.free} label={t.lego.homeFree} accent />
              <Stat value={stats.sets} label={t.lego.homeSets} />
              <Stat value={stats.incomplete} label={t.lego.homeIncomplete} />
            </div>
            {stats.total ? (
              <div className="px-3 pb-3 pt-1 space-y-1">
                <div className="flex justify-between text-[10px] text-white/45">
                  <span>{t.lego.homeInSets}</span><span className="text-white/70 font-semibold">{assignedPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" role="img" aria-label={`${t.lego.homeInSets}: ${assignedPct}%`}>
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(assignedPct > 0 ? 2 : 0, assignedPct)}%` }} />
                </div>
              </div>) : null}
          </section>)}
        {tid == null && <p className="text-sm text-white/60">{t.lego.needLogin}</p>}

        {/* primary actions */}
        <div className="grid grid-cols-5 gap-3">
          <button onClick={() => navigate(RoutePaths.LegoScan)}
            className="col-span-3 flex items-center gap-3 rounded-2xl bg-red-600 p-4 text-left shadow-lg shadow-red-950/50 active:scale-[0.98] transition-transform">
            <ScanLine className="w-7 h-7 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-black leading-tight">{t.lego.scanner}</span>
              <span className="block text-[11px] text-white/75 leading-tight mt-0.5">{t.lego.homeScanShort}</span>
            </span>
          </button>
          <button onClick={() => navigate(RoutePaths.LegoParts)}
            className="col-span-2 flex flex-col items-start justify-center gap-1 rounded-2xl bg-white/[0.06] border border-white/10 p-4 text-left active:scale-[0.98] transition-transform">
            <Plus className="w-5 h-5 text-red-300" />
            <span className="text-sm font-bold leading-tight">{t.lego.addPart}</span>
          </button>
        </div>

        {empty && (
          <div className="rounded-2xl border border-dashed border-red-400/30 bg-red-500/5 p-4 space-y-1">
            <p className="text-sm font-bold">{t.lego.homeEmptyTitle}</p>
            <p className="text-xs text-white/60">{t.lego.homeEmptyDesc}</p>
          </div>)}

        {/* catalog */}
        <button onClick={() => navigate(RoutePaths.LegoSets)}
          className="w-full flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 text-red-300 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t.lego.catalog}</p>
            <p className="text-xs text-white/50">{t.lego.catalogDesc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>

        {/* sections */}
        <div className="grid grid-cols-2 gap-3">
          {tiles.map(({ icon: Icon, label, desc, path, badge }) => (
            <button key={path} onClick={() => navigate(path)}
              className="relative text-left bg-white/[0.05] border border-white/10 rounded-2xl p-4 space-y-2 active:scale-[0.98] transition-transform">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/10 text-white/75 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                {badge && <span className="rounded-full bg-red-500/20 text-red-200 text-[11px] font-bold px-2 py-0.5">{badge}</span>}
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{label}</p>
                <p className="text-[11px] text-white/45 leading-snug mt-0.5 line-clamp-3">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* wishlist is not built yet: disabled instead of leading to an empty screen */}
        <div aria-disabled="true" className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-3 opacity-60">
          <div className="w-9 h-9 rounded-xl bg-white/5 text-white/40 flex items-center justify-center shrink-0"><Heart className="w-4 h-4" /></div>
          <p className="flex-1 text-sm font-semibold">{t.lego.wishlist}</p>
          <span className="text-[10px] uppercase tracking-wider text-white/40">{t.lego.comingSoon}</span>
        </div>

        <p className="text-[11px] text-white/30 pt-2">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
