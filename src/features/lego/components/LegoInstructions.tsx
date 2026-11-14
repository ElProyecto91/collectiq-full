import { useQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { instructionLinks } from '../instructions';
import { InstructionsError, fetchManuals } from '../services/lego-instructions';

/**
 * Building instructions of a set: how many official manuals exist and which one to open (a big set has
 * several books, and a set can have several versions). If the list is not available (key not set up, service
 * down) it falls back to the two pages that list them.
 */
export function LegoInstructions({ setNum }: { setNum: string }) {
  const { t, tr } = useI18n();
  const q = useQuery({
    queryKey: ['lego-instructions', setNum],
    queryFn: () => fetchManuals(setNum),
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });
  const manuals = q.data ?? [];
  const notConfigured = q.error instanceof InstructionsError && q.error.code === 'not_configured';
  const links = instructionLinks(setNum);

  return (
    <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-bold flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-red-300" />{t.lego.instructions}
        {q.isSuccess && manuals.length > 0 && (
          <span className="ml-auto rounded-full bg-red-500/20 text-red-200 text-[11px] font-bold px-2 py-0.5">
            {tr(manuals.length === 1 ? 'lego.manualsOne' : 'lego.manualsMany', { count: manuals.length })}
          </span>)}
      </h2>

      {q.isLoading && <p className="text-xs text-white/50 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t.lego.manualsLoading}</p>}

      {q.isSuccess && manuals.length > 0 && (
        <>
          <p className="text-xs text-white/60">{t.lego.manualsPick}</p>
          <ul className="space-y-2">
            {manuals.map((m, i) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-white/[0.06] border border-white/10 p-3 active:scale-[0.99] transition-transform">
                  <FileText className="w-6 h-6 text-red-300 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold leading-snug break-words">{m.title || tr('lego.manualN', { n: i + 1 })}</span>
                    <span className="block text-[10px] text-white/40 mt-0.5">PDF · LEGO</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold">{t.lego.manualOpen}</span>
                </a>
              </li>))}
          </ul>
          <p className="text-[11px] text-white/40">{t.lego.manualsHelp}</p>
        </>)}

      {q.isSuccess && manuals.length === 0 && <p className="text-xs text-white/60">{t.lego.manualsNone}</p>}
      {q.isError && <p className="text-xs text-white/50">{notConfigured ? t.lego.manualsNotConfigured : t.lego.manualsError}</p>}

      {/* the pages that list them: always there as a way out */}
      {!q.isLoading && !(q.isSuccess && manuals.length > 0) && (
        <div className="flex flex-col gap-2">
          {links.map((l) => (
            <a key={l.key} href={l.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold active:scale-[0.99] transition-transform">
              <span>{l.key === 'rebrickable' ? t.lego.instructionsRebrickable : t.lego.instructionsLego}</span>
              <ExternalLink className="w-4 h-4 text-white/50 shrink-0" />
            </a>))}
          <p className="text-[11px] text-white/40">{t.lego.instructionsNote}</p>
        </div>)}
    </section>
  );
}
