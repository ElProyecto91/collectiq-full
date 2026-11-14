import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { useI18n } from '@/i18n';
import { defaultDir, type PartSort, type PartSortKey } from '../part-sort';

/** "Sort by [key] [direction]" for a list of parts. Picking a key starts in its natural direction. */
export function LegoPartSort({ keys, value, onChange }: { keys: readonly PartSortKey[]; value: PartSort; onChange: (s: PartSort) => void }) {
  const { t } = useI18n();
  const dirLabel = value.dir === 'asc' ? t.lego.sortAsc : t.lego.sortDesc;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
      <label className="block text-[10px] uppercase tracking-wide text-white/40 space-y-1">{t.lego.sortBy}
        <select value={value.key} onChange={(e) => { const key = e.target.value as PartSortKey; onChange({ key, dir: defaultDir(key) }); }}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-sm normal-case tracking-normal text-white">
          {keys.map((k) => <option key={k} value={k}>{t.lego[`partSort_${k}`]}</option>)}
        </select>
      </label>
      <button onClick={() => onChange({ ...value, dir: value.dir === 'asc' ? 'desc' : 'asc' })} aria-label={dirLabel} title={dirLabel}
        className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
        {value.dir === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
      </button>
    </div>
  );
}
