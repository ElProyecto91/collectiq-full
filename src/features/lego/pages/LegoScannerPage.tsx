import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { RoutePaths } from '@/config';
import { useUserStore } from '@/store';
import { LegoAddPart } from '../components/LegoAddPart';
import { LegoCamera } from '../components/LegoCamera';
import { LegoImage } from '../components/LegoImage';
import { LegoPctBar } from '../components/LegoPctBar';
import { compressImage } from '../image';
import { fetchPartsByNums, searchParts } from '../services/lego-catalog';
import { matchByName } from '../scan-match';
import { ScanError, getSessionToken, scanPart, type ScanCandidate, type ScanResponse } from '../services/lego-scan';
import { countScansToday } from '../services/lego-user';
import type { LegoPartSummary } from '../types';

type Chosen = { candidate: ScanCandidate; part: LegoPartSummary | null } | 'manual' | null;

export function LegoScannerPage() {
  const navigate = useNavigate();
  const { t, tr } = useI18n();
  const qc = useQueryClient();
  const tid = useUserStore((s) => s.telegramUser?.id);
  const token = getSessionToken();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen>(null);
  const [done, setDone] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const todayQuery = useQuery({ queryKey: ['lego-scans-today', tid], queryFn: () => countScansToday(tid!), enabled: tid != null });

  const scan = useMutation<ScanResponse, ScanError, File>({
    mutationFn: async (file) => {
      let blob: Blob;
      try { blob = await compressImage(file); } catch { throw new ScanError('decode'); }
      return scanPart(blob, token!);
    },
    onSuccess: (res) => { setLimit(res.limit); qc.invalidateQueries({ queryKey: ['lego-scans-today', tid] }); },
    onError: (e) => { if (e.code === 'daily_limit') qc.invalidateQueries({ queryKey: ['lego-scans-today', tid] }); },
  });
  const candidates = scan.data?.candidates ?? [];

  // which candidates exist in the catalog: Rebrickable's number first, then Brickognize's id
  const nums = candidates.flatMap((c) => [c.rb_part_num, c.id].filter((x): x is string => !!x));
  const matchQuery = useQuery({
    queryKey: ['lego-scan-match', nums.join(',')], queryFn: () => fetchPartsByNums(nums), enabled: nums.length > 0,
  });
  // candidates whose number is not in the catalog are matched by name (BrickLink and Rebrickable numbers differ)
  const unmatched = matchQuery.isSuccess
    ? candidates.filter((c) => !((c.rb_part_num && matchQuery.data.get(c.rb_part_num)) || matchQuery.data.get(c.id)) && c.name)
    : [];
  const nameQuery = useQuery({
    queryKey: ['lego-scan-name-match', unmatched.map((c) => `${c.id}:${c.name}`).join('|')],
    queryFn: async () => {
      const found = new Map<string, LegoPartSummary>();
      for (const c of unmatched) {
        const hit = matchByName(c.name, await searchParts(c.name));
        if (hit) found.set(c.id, hit);
      }
      return found;
    },
    enabled: unmatched.length > 0,
  });
  const partFor = (c: ScanCandidate): LegoPartSummary | null =>
    (c.rb_part_num && matchQuery.data?.get(c.rb_part_num)) || matchQuery.data?.get(c.id) || nameQuery.data?.get(c.id) || null;

  const start = (file: File | undefined) => {
    if (!file) return;
    setChosen(null); setDone(false); setAdded(null);
    setPreview(URL.createObjectURL(file));
    setPhoto(file);
    scan.mutate(file);
  };
  const reset = () => { scan.reset(); setPreview(null); setPhoto(null); setChosen(null); setDone(false); setAdded(null); };
  const errorText = (e: ScanError) => {
    const key = `scanErr_${e.code}` as keyof typeof t.lego;
    const text = (t.lego[key] as string | undefined) ?? t.lego.scanErr_unknown;
    const lim = (e.detail as { limit?: number } | undefined)?.limit ?? limit ?? '';
    return text.replace('{limit}', String(lim));
  };

  // live camera (with flash) when the browser allows it; otherwise the system camera through <input capture>
  const openCamera = () => {
    setCameraNote(null);
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') setCameraOpen(true);
    else cameraRef.current?.click();
  };

  const btn = 'flex-1 rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pb-24">
      {cameraOpen && (
        <LegoCamera
          onCapture={(file) => { setCameraOpen(false); start(file); }}
          onClose={() => setCameraOpen(false)}
          onUnavailable={() => { setCameraOpen(false); setCameraNote(t.lego.cameraFallback); cameraRef.current?.click(); }} />)}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(RoutePaths.LegoHome)} aria-label={t.lego.back}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-lg font-black">{t.lego.scanner}</h1>
          {todayQuery.data !== undefined && <p className="text-xs text-white/50">{tr('lego.scansToday', { count: todayQuery.data })}</p>}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {(tid == null || !token) && <p className="text-sm text-white/60">{t.lego.scanNeedsLogin}</p>}

        {tid != null && token && !done && (
          <section className="space-y-3">
            <p className="text-xs text-white/60">{t.lego.scannerDesc}</p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="camera-input"
              onChange={(e) => { start(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" className="hidden" data-testid="gallery-input"
              onChange={(e) => { start(e.target.files?.[0]); e.target.value = ''; }} />
            <div className="flex gap-2">
              <button disabled={scan.isPending} onClick={openCamera} className={`${btn} bg-red-600 disabled:opacity-40`}><Camera className="w-4 h-4" />{t.lego.takePhoto}</button>
              <button disabled={scan.isPending} onClick={() => galleryRef.current?.click()} className={`${btn} bg-white/10 disabled:opacity-40`}><ImageIcon className="w-4 h-4" />{t.lego.pickPhoto}</button>
            </div>
            <p className="text-[11px] text-white/40">{t.lego.scanHint}</p>
            {cameraNote && <p className="text-[11px] text-yellow-300/80" role="status">{cameraNote}</p>}
          </section>)}

        {preview && !done && <img src={preview} alt="" className="w-full max-h-56 object-contain rounded-2xl bg-white/5" />}

        {scan.isPending && <div className="flex items-center gap-2 text-sm text-white/60" role="status"><Loader2 className="w-4 h-4 animate-spin" />{t.lego.scanning}</div>}
        {scan.isError && <p className="text-sm text-red-300" role="alert">{errorText(scan.error)}</p>}

        {scan.isSuccess && !done && chosen === null && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold">{t.lego.scanCandidates}</h2>
            {candidates.length === 0 && <p className="text-sm text-white/60">{t.lego.scanNoCandidates}</p>}
            <ul className="space-y-2">
              {candidates.map((c) => {
                const part = partFor(c);
                return (
                  <li key={c.id} className="flex items-center gap-3 bg-white/[0.04] border border-white/8 rounded-xl p-2">
                    <LegoImage src={c.img_url} alt={c.name} className="w-16 h-16 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[11px] text-red-300 font-semibold">{c.id}</p>
                      <p className="text-xs leading-tight line-clamp-2">{c.name}</p>
                      {c.score !== null && <LegoPctBar value={c.score} label={t.lego.scanScore} />}
                      <p className={`text-[10px] ${part ? 'text-green-300' : 'text-yellow-400/80'}`}>{part ? t.lego.scanInCatalog : t.lego.scanNotInCatalog}</p>
                    </div>
                    <button onClick={() => setChosen({ candidate: c, part })} className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold">
                      {part ? t.lego.scanIsThis : t.lego.scanSearchByHand}
                    </button>
                  </li>);
              })}
            </ul>
            <button onClick={() => setChosen('manual')} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.scanNoneMatch}</button>
          </section>)}

        {scan.isSuccess && !done && chosen !== null && tid != null && (
          <section className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
            <button onClick={() => setChosen(null)} className="text-xs text-red-300 underline">{t.lego.scanBackToResults}</button>
            <LegoAddPart key={chosen === 'manual' ? 'manual' : chosen.candidate.id} tid={tid} photo={photo}
              initialPart={chosen === 'manual' ? null : chosen.part}
              initialQuery={chosen === 'manual' ? '' : (chosen.part ? '' : (chosen.candidate.name || chosen.candidate.id))}
              onAdded={(info) => { setAdded(tr('lego.partAdded', { qty: info.qty, name: info.part.name, color: info.color.name })); setDone(true); }} />
          </section>)}

        {done && (
          <section className="space-y-3">
            <p className="text-sm text-green-300" role="status">{added}</p>
            <button onClick={reset} className="w-full rounded-xl bg-red-600 py-3 text-sm font-bold">{t.lego.scanAnother}</button>
            <button onClick={() => navigate(RoutePaths.LegoParts)} className="w-full rounded-xl bg-white/10 py-2 text-sm">{t.lego.inventory}</button>
          </section>)}

        <p className="text-[11px] text-white/30 pt-4">
          <a href="https://brickognize.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.scanBy}</a>
          {' · '}
          <a href="https://rebrickable.com" target="_blank" rel="noopener noreferrer" className="underline">{t.lego.attribution}</a>
        </p>
      </div>
    </div>
  );
}
