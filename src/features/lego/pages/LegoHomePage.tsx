import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Boxes, Layers, Heart, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';

export function LegoHomePage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  // Only the catalog exists in phase 1; the rest are placeholders for later phases.
  const upcoming = [
    { icon: Boxes, label: t.lego.inventory },
    { icon: Layers, label: t.lego.possibleSets },
    { icon: Heart, label: t.lego.wishlist },
  ];

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(180deg, #2a0505 0%, #0a0a0f 22%)' }}>
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.Home)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight">{t.lego.title}</h1>
          <p className="text-xs text-white/50">{t.lego.subtitle}</p>
        </div>
      </div>

      <div className="px-4 space-y-3">
        <button onClick={() => navigate(RoutePaths.LegoSets)}
          className="w-full flex items-center gap-3 bg-red-500/15 border border-red-500/25 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 text-red-300 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{t.lego.catalog}</p>
            <p className="text-xs text-white/50">{t.lego.catalogDesc}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30" />
        </button>

        {upcoming.map(({ icon: Icon, label }) => (
          <div key={label} aria-disabled="true"
            className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-2xl p-4 opacity-60">
            <div className="w-11 h-11 rounded-xl bg-white/5 text-white/40 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <p className="flex-1 text-sm font-semibold">{label}</p>
            <span className="text-[10px] uppercase tracking-wider text-white/40">{t.lego.comingSoon}</span>
          </div>
        ))}

        <p className="text-[11px] text-white/30 pt-3">
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">
            {t.lego.attribution}
          </a>
        </p>
      </div>
    </div>
  );
}
