import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { useI18n } from '@/i18n';
import { decodeToPixels } from '../image';
import { pieceColors, suggestColors, type Cluster } from '../color-suggest';
import { fetchAllColors, fetchPartColors, searchParts } from '../services/lego-catalog';
import { addUserParts } from '../services/lego-user';
import type { LegoColorOption, LegoPartSummary } from '../types';
import { LegoImage } from './LegoImage';
import { ColorSquare, LegoPartSets } from './LegoPartSets';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

const Swatch = ({ rgb, trans }: { rgb: string | null; trans: boolean }) => (
  <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 inline-block"
    style={{ background: rgb ? `#${rgb}` : 'transparent', opacity: trans ? 0.6 : 1 }} />
);

interface Props {
  tid: number;
  /** Start with this part already chosen (the scanner does this). */
  initialPart?: LegoPartSummary | null;
  /** Start with this text in the search box. */
  initialQuery?: string;
  /** Photo of the piece: its colors are used to suggest the color to pick. */
  photo?: Blob | null;
  onAdded?: (info: { part: LegoPartSummary; color: LegoColorOption; qty: number }) => void;
}

/** Search a part, choose its color and quantity, and add it to the inventory (quantities add up). */
export function LegoAddPart({ tid, initialPart = null, initialQuery = '', photo = null, onAdded }: Props) {
  const { t, tr } = useI18n();
  const qc = useQueryClient();

  const [q, setQ] = useState(initialQuery);
  const [picked, setPicked] = useState<LegoPartSummary | null>(initialPart);
  const [colorId, setColorId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [qty, setQty] = useState('1');
  const [showSets, setShowSets] = useState(false);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dq = useDebounced(q, 300);

  // colors of the photographed piece (analysis runs on a 96 px copy, in the browser)
  useEffect(() => {
    let live = true;
    setClusters(null);
    if (photo) {
      decodeToPixels(photo).then((px) => { if (live) setClusters(pieceColors(px.data, px.width, px.height)); }).catch(() => undefined);
    }
    return () => { live = false; };
  }, [photo]);

  const searchQuery = useQuery({
    queryKey: ['lego-part-search', dq.trim()], queryFn: () => searchParts(dq), enabled: dq.trim().length > 0 && !picked,
  });
  const partColorsQuery = useQuery({
    queryKey: ['lego-part-colors', picked?.part_num], queryFn: () => fetchPartColors(picked!.part_num), enabled: !!picked,
  });
  const knownColors = partColorsQuery.data ?? [];
  const useAll = showAll || (partColorsQuery.isSuccess && knownColors.length === 0);
  const allColorsQuery = useQuery({
    queryKey: ['lego-all-colors'], queryFn: fetchAllColors, staleTime: Infinity, enabled: !!picked && (useAll || !!clusters?.length),
  });
  const colors: LegoColorOption[] = useAll ? allColorsQuery.data ?? [] : knownColors;
  // at least 4 suggestions from the photo, colors this part exists in first
  const suggestions = useMemo(() => {
    if (!clusters?.length || !partColorsQuery.isSuccess || !allColorsQuery.data) return [];
    const knownIds = new Set(knownColors.map((c) => c.color_id));
    const byId = new Map(knownColors.map((c) => [c.color_id, c]));
    return suggestColors(clusters, allColorsQuery.data.map((c) => ({ ...c, color_id: c.color_id })), knownIds, 5)
      .map(({ color, known }) => ({ color: byId.get(color.color_id) ?? color, known }));
  }, [clusters, knownColors, partColorsQuery.isSuccess, allColorsQuery.data]);
  const hasSuggestions = suggestions.length > 0;
  const chosenColor = [...suggestions.map((s) => s.color), ...colors].find((c) => c.color_id === colorId) ?? null;
  const quantity = Number.parseInt(qty, 10);

  const addMutation = useMutation({
    mutationFn: () => addUserParts(tid, [{ part_num: picked!.part_num, color_id: chosenColor!.color_id, quantity }]),
    onSuccess: () => {
      const info = { part: picked!, color: chosenColor!, qty: quantity };
      setError(null);
      setMessage(tr('lego.partAdded', { qty: quantity, name: picked!.name, color: chosenColor!.name }));
      setPicked(null); setColorId(null); setQ(''); setQty('1'); setShowAll(false); setShowSets(false); setListOpen(false);
      qc.invalidateQueries({ queryKey: ['user-lego-parts', tid] });
      onAdded?.(info);
    },
    onError: (e) => { setMessage(null); setError(e instanceof Error ? e.message : String(e)); },
  });

  const field = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400/50';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={picked ? `${picked.part_num} · ${picked.name}` : q}
          onChange={(e) => { setPicked(null); setColorId(null); setQ(e.target.value); setMessage(null); setError(null); }}
          placeholder={t.lego.searchPartPlaceholder} className={`${field} w-full pl-9`} aria-label={t.lego.addPart} />
      </div>

      {!picked && searchQuery.isLoading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
      {!picked && searchQuery.isError && <p className="text-xs text-red-300">{t.lego.loadError}</p>}
      {!picked && searchQuery.data && searchQuery.data.length === 0 && dq.trim() && (
        <p className="text-xs text-white/50">{t.lego.noPartResults}</p>)}
      {!picked && searchQuery.data && searchQuery.data.length > 0 && (
        <ul className="divide-y divide-white/5 border border-white/8 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {searchQuery.data.map((r) => (
            <li key={r.part_num}>
              <button onClick={() => { setPicked(r); setColorId(null); setShowAll(false); }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 active:bg-white/10">
                <span className="text-xs text-red-300 font-semibold">{r.part_num}</span>
                <span className="text-xs text-white/70 ml-2">{r.name}</span>
              </button>
            </li>))}
        </ul>)}

      {picked && (
        <div className="space-y-3">
          {hasSuggestions && (
            <div className="space-y-2">
              <p className="text-xs text-white/70 font-semibold">{t.lego.colorSuggested}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.lego.colorSuggested}>
                {suggestions.map(({ color: c, known }) => (
                  <button key={c.color_id} role="radio" aria-checked={colorId === c.color_id} onClick={() => { setColorId(c.color_id); setShowSets(false); }}
                    title={known ? undefined : t.lego.colorSuggestedHelp}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${known ? '' : 'border-dashed'} ${colorId === c.color_id ? 'border-red-400 bg-red-500/20' : 'border-white/20 bg-white/5'}`}>
                    <Swatch rgb={c.rgb} trans={c.is_trans} />{c.name}
                  </button>))}
              </div>
              {suggestions.some((s) => !s.known) && <p className="text-[10px] text-white/35">{t.lego.colorSuggestedHelp}</p>}
              <button onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} className="text-xs text-red-300 underline">
                {listOpen ? t.lego.hideAllColorsList : t.lego.showAllColorsList}
              </button>
            </div>)}
          {(!hasSuggestions || listOpen) && (
            <div className="space-y-3">
              <p className="text-xs text-white/50">{useAll ? t.lego.allColors : t.lego.onlyKnownColors}</p>
              {(partColorsQuery.isLoading || (useAll && allColorsQuery.isLoading)) && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.lego.chooseColor}>
                {colors.map((c) => (
                  <button key={c.color_id} role="radio" aria-checked={colorId === c.color_id} onClick={() => { setColorId(c.color_id); setShowSets(false); }}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${colorId === c.color_id ? 'border-red-400 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                    <Swatch rgb={c.rgb} trans={c.is_trans} />{c.name}
                  </button>))}
              </div>
              {!useAll && <button onClick={() => setShowAll(true)} className="text-xs text-red-300 underline">{t.lego.showAllColors}</button>}
            </div>)}

          {chosenColor && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <LegoImage src={chosenColor.img_url} alt={picked.name} className="w-16 h-16 rounded-xl" />
                <ColorSquare rgb={chosenColor.rgb} trans={chosenColor.is_trans} size="w-16 h-3" />
              </div>
              <label className="flex-1 text-xs text-white/60 space-y-1">
                {t.lego.quantity}
                <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  inputMode="numeric" className={`${field} w-full`} />
              </label>
            </div>)}
          {chosenColor && (
            <div className="space-y-2">
              <button onClick={() => setShowSets((v) => !v)} aria-expanded={showSets} className="text-xs text-red-300 underline">
                {showSets ? t.lego.partSetsHide : t.lego.partSetsToggle}
              </button>
              {showSets && <LegoPartSets partNum={picked.part_num} colorId={chosenColor.color_id}
                colorName={chosenColor.name} colorRgb={chosenColor.rgb} colorIsTrans={chosenColor.is_trans} />}
            </div>)}
          <button disabled={!chosenColor || !(quantity > 0) || addMutation.isPending} onClick={() => addMutation.mutate()}
            className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold disabled:opacity-30 flex items-center justify-center gap-2">
            {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}{t.lego.add}
          </button>
        </div>)}

      {message && <p className="text-xs text-green-300" role="status">{message}</p>}
      {error && <p className="text-xs text-red-300" role="alert">{t.lego.saveError} {tr('lego.saveErrorDetail', { message: error })}</p>}
    </div>
  );
}
