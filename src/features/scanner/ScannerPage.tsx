import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, ScanLine, RefreshCw, Sparkles, X,
  Search, CheckCircle2, AlertCircle, Plus, Loader2, Tv, Zap, PenLine,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useCreateCollectionItem } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { useMissions } from '@/hooks/use-missions';
import { RarityBadge } from '@/components/RarityBadge';
import { compressImage } from '@/lib/image';
import { authHeaders, reportCardsAdded } from '@/lib/session-token';
import { cardmarketEur, normalizeVariant, pricesForCollection } from '@/lib/card-pricing';
import { buildQueries, confidence, esc, rankCards, type CardRead, type Confidence, type Ranked } from '@/lib/card-match';
import { POKEMON_API_KEY } from '@/lib/pokemon-key';

interface PokemonCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  hp?: string;
  artist?: string;
  regulationMark?: string;
  types?: string[];
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; total?: number; printedTotal?: number; ptcgoCode?: string; releaseDate?: string };
  cardmarket?: { prices?: Record<string, number | undefined> };
  tcgplayer?: { prices?: Record<string, { market?: number } | undefined> };
}

type ScanPhase = 'idle' | 'preview' | 'analyzing' | 'results' | 'no-results' | 'error';

const DAILY_SCAN_LIMIT = 5;
const AD_BONUS_SCANS = 1;

interface Quota { used: number; accumulated: number; limit: number; premium: boolean }
interface VisionResponse { read: CardRead; quota: Quota }

class ScanFailure extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Asks our backend to READ the card (printed text only). It needs the session and counts one scan. */
async function readCard(photo: File): Promise<VisionResponse> {
  // a phone photo is several MB; ~1600 px is plenty to read the small print and keeps the request small
  const blob = await compressImage(photo, 1600, 0.88);
  const base64 = await toBase64(blob);
  const res = await fetch('/api/vision', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ image: base64 }) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new ScanFailure('unauthorized', 'Tu sesión ha caducado. Vuelve a entrar en la app.');
  if (res.status === 429) throw new ScanFailure('daily_limit', 'Límite diario alcanzado. Ve un anuncio para conseguir más escaneos.');
  if (!res.ok) throw new ScanFailure('vision', data?.error ?? `Vision error: ${res.status}`);
  return data as VisionResponse;
}

async function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** One catalog query, with a few retries on rate limits and server errors. */
async function queryCatalog(q: string, pageSize: number, retries = 3): Promise<PokemonCard[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=${pageSize}&orderBy=-set.releaseDate`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; }
      if (!res.ok) throw new Error(`PokéTCG error: ${res.status}`);
      const json = await res.json();
      return (json.data ?? []) as PokemonCard[];
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error('PokéTCG error: retries exhausted');
}

/**
 * Candidates for a reading: the specific queries (printed number + set total, set code, name + number) run
 * together, the broad name query only when they are not enough. Ranked by how many printed facts agree.
 */
async function findCandidates(read: CardRead): Promise<{ ranked: Ranked<PokemonCard>[]; conf: Confidence }> {
  const queries = buildQueries(read);
  const specific = queries.filter(q => q.label !== 'name');
  const broad = queries.find(q => q.label === 'name');
  let pool: PokemonCard[] = [];
  let failures = 0;
  const run = async (qs: typeof queries) => {
    const settled = await Promise.allSettled(qs.map(q => queryCatalog(q.q, q.pageSize)));
    for (const r of settled) { if (r.status === 'fulfilled') pool = pool.concat(r.value); else failures++; }
  };
  await run(specific);
  let ranked = rankCards(read, pool);
  if (broad && (ranked.length < 3 || confidence(ranked) !== 'high')) {
    await run([broad]);
    ranked = rankCards(read, pool);
  }
  if (ranked.length === 0 && failures > 0) throw new ScanFailure('catalog', 'pokétcg_error');
  return { ranked: ranked.slice(0, 8), conf: confidence(ranked) };
}

async function searchPokemonTCG(name: string): Promise<PokemonCard[]> {
  return queryCatalog(`name:"${esc(name)}"`, 20);
}

export default function ScannerPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTutorial] = useState(true);

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [detectedName, setDetectedName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Ranked<PokemonCard>[]>([]);
  const [read, setRead] = useState<CardRead | null>(null);
  const [conf, setConf] = useState<Confidence>('low');
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [detectedVariant, setDetectedVariant] = useState<string>('normal');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en');

  const [scansUsed, setScansUsed] = useState(0);
  const [scansAccumulated, setScansAccumulated] = useState(0);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [scansLoaded, setScansLoaded] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);

  const { mutate: createItem } = useCreateCollectionItem();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);
  const { updateMission } = useMissions();

  const applyQuota = useCallback((q: { used?: number; scansUsed?: number; accumulated?: number; scansAccumulated?: number; premium?: boolean }) => {
    setScansUsed(q.used ?? q.scansUsed ?? 0);
    setScansAccumulated(q.accumulated ?? q.scansAccumulated ?? 0);
    if (q.premium !== undefined) setIsPremium(q.premium);
  }, []);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!telegramUser?.id) {
      setIsPremium(false);
      setScansLoaded(true);
      return;
    }
    fetch('/api/scans', { headers: authHeaders() })
      .then(r => r.json())
      .then((data) => { if (!data.error) applyQuota(data); else setIsPremium(false); })
      .catch(() => setIsPremium(false))
      .finally(() => setScansLoaded(true));
  }, [telegramUser?.id, sessionLoaded, applyQuota]);

  const totalScansAvailable = DAILY_SCAN_LIMIT + scansAccumulated;
  const canScan = isPremium === true || (scansLoaded && scansUsed < totalScansAvailable);
  const remainingScans = Math.max(0, totalScansAvailable - scansUsed);

  const updateScans = useCallback(async (action: 'add_accumulated' | 'refund', amount?: number) => {
    if (!telegramUser?.id) return;
    const res = await fetch('/api/scans', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action, amount }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && !data.error) applyQuota(data);
  }, [telegramUser?.id, applyQuota]);

  const watchAd = useCallback(() => {
    if (watchingAd) return;
    setWatchingAd(true);
    (window as any).show_11612154?.()
      .then(async () => {
        await updateScans('add_accumulated', AD_BONUS_SCANS);
        setStatusMsg('🎉 +' + AD_BONUS_SCANS + ' escaneo añadido');
        setTimeout(() => setStatusMsg(''), 3000);
      })
      .catch(() => {
        setStatusMsg('❌ Anuncio no completado. Inténtalo de nuevo.');
        setTimeout(() => setStatusMsg(''), 3000);
      })
      .finally(() => setWatchingAd(false));
  }, [watchingAd, updateScans]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCurrentFile(file);
    setPhase('preview');
    setResults([]);
    setDetectedName('');
    setSearchQuery('');
    setErrorMsg('');
    setStatusMsg('');
    setRead(null);
    e.target.value = '';
  }, []);

  const openCamera = () => {
    if (!canScan) {
      setStatusMsg('Límite diario alcanzado. Ve un anuncio para conseguir más escaneos.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    fileInputRef.current?.click();
  };

  const analyzeCard = useCallback(async () => {
    if (!currentFile) return;
    setPhase('analyzing');
    setProgress(15);
    setStatusMsg('Leyendo la carta…');
    let counted = false;

    try {
      const vision = await readCard(currentFile);
      counted = !vision.quota.premium;
      applyQuota(vision.quota);
      const card = vision.read;
      setRead(card);
      setProgress(55);
      setDetectedVariant(normalizeVariant(card.variant));
      setDetectedLanguage(card.language || 'en');

      if (!card.is_pokemon_card || (!card.name && !card.number)) {
        setDetectedName(''); setSearchQuery(''); setResults([]);
        setPhase('no-results');
        return;
      }

      setStatusMsg('Comparando con el catálogo…');
      const { ranked, conf: c } = await findCandidates(card);
      setProgress(100);
      setStatusMsg('');
      setDetectedName(card.name);
      setSearchQuery(card.name);
      setResults(ranked);
      setConf(c);
      setPhase(ranked.length === 0 ? 'no-results' : 'results');
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (err instanceof ScanFailure && err.code === 'catalog') {
        // the catalog was down: the scan did not produce an answer, give it back
        if (counted) await updateScans('refund');
        setErrorMsg('La base de datos oficial de Pokémon está caída. No se ha descontado ningún escaneo.');
      } else if (msg.includes('PokéTCG')) {
        if (counted) await updateScans('refund');
        setErrorMsg('La base de datos oficial de Pokémon está caída. No se ha descontado ningún escaneo.');
      } else {
        setErrorMsg(msg || 'Error al analizar la carta. Inténtalo de nuevo.');
      }
      setPhase('error');
    }
  }, [currentFile, applyQuota, updateScans]);

  const manualSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPhase('analyzing');
    setProgress(50);
    setStatusMsg(`Buscando "${searchQuery}"…`);
    try {
      const cards = await searchPokemonTCG(searchQuery.trim());
      setProgress(100);
      // typed by hand: no printed facts to compare, so the list is just the catalog's (newest first)
      setResults(cards.map(card => ({ card, score: 0, reasons: [] })));
      setConf('low');
      setPhase(cards.length === 0 ? 'no-results' : 'results');
    } catch {
      setErrorMsg('La base de datos oficial de Pokémon está caída. Inténtalo de nuevo.');
      setPhase('error');
    }
  }, [searchQuery]);

  const addCard = async (card: PokemonCard) => {
    if (!telegramUser?.id) return;
    createItem({
      cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set.name, cardNumber: card.number,
      rarity: card.rarity ?? null, imageUrl: card.images.small, quantity: 1,
      favorite: false, setTotal: card.set.total ?? null,
      // euros (Cardmarket) for the variant read from the photo; dollars apart
      ...pricesForCollection(card, detectedVariant),
      // variant and language read from the photo, as the app's own variant names
      variant: detectedVariant as any,
      cardLanguage: detectedLanguage as any,
    });
    setAddedIds(prev => new Set(prev).add(card.id));
    setStatusMsg(`✅ ${card.name} añadida a tu colección`);
    setTimeout(() => setStatusMsg(''), 3000);
    await updateMission('add_card');

    const { count: totalCards } = await supabase
      .from('collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id);
    reportCardsAdded((totalCards ?? 0) + 1);
  };

  const reset = () => {
    setPhase('idle');
    setPreviewUrl(null);
    setCurrentFile(null);
    setDetectedName('');
    setSearchQuery('');
    setResults([]);
    setErrorMsg('');
    setStatusMsg('');
    setProgress(0);
    setRead(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => navigate(RoutePaths.Home)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">COLLECTIQ</p>
            <h1 className="text-lg font-bold leading-tight">Escanear carta</h1>
          </div>
        </div>
      </div>

      {/* Barra de estado */}
      <div className="mx-4 mb-3">
        {(!sessionLoaded || !scansLoaded) && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
        )}
        {sessionLoaded && scansLoaded && isPremium === true && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <p className="text-xs font-bold" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>CollectIQ GO · Escaneos ilimitados ✨</p>
          </div>
        )}
        {sessionLoaded && scansLoaded && isPremium === false && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-400" />
              <div>
                <p className="text-xs font-bold text-white">
                  {remainingScans} escaneo{remainingScans !== 1 ? 's' : ''} disponible{remainingScans !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-gray-500">
                  {scansUsed}/{DAILY_SCAN_LIMIT} diarios · {scansAccumulated} extra
                </p>
              </div>
            </div>
            <button onClick={watchAd} disabled={watchingAd}
              className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-3 py-2 text-xs font-bold active:scale-95 transition-transform disabled:opacity-50">
              {watchingAd
                ? <><Loader2 size={12} className="animate-spin" />Cargando...</>
                : <><Tv size={12} />+1 escaneo</>}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 space-y-4">
        <div
          className="relative rounded-2xl overflow-hidden bg-[#111118] border border-white/10"
          style={{ aspectRatio: '3/4' }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30" />
                <ScanLine className="absolute inset-0 m-auto w-10 h-10 text-blue-400/60" />
              </div>
              <p className="text-sm text-gray-500 text-center px-8">Apunta la cámara a una carta</p>
            </div>
          )}

          {(['tl','tr','bl','br'] as const).map((c) => (
            <span key={c} className={cx(
              'absolute w-5 h-5 border-blue-400',
              c === 'tl' && 'top-3 left-3 border-t-2 border-l-2 rounded-tl-lg',
              c === 'tr' && 'top-3 right-3 border-t-2 border-r-2 rounded-tr-lg',
              c === 'bl' && 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg',
              c === 'br' && 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg',
            )} />
          ))}

          {phase === 'analyzing' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-6">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-sm text-blue-200 text-center">{statusMsg}</p>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {statusMsg && phase !== 'analyzing' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-blue-300 text-center">
            {statusMsg}
          </div>
        )}

        {sessionLoaded && scansLoaded && isPremium === false && !canScan && phase === 'idle' && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-orange-300">⚡ Límite diario alcanzado</p>
            <p className="text-xs text-orange-400/80">Has usado tus {DAILY_SCAN_LIMIT} escaneos de hoy.</p>
            <button onClick={watchAd} disabled={watchingAd}
              className="w-full flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl py-3 text-sm font-bold active:scale-95 transition-transform disabled:opacity-50">
              {watchingAd
                ? <><Loader2 size={14} className="animate-spin" />Cargando anuncio...</>
                : <><Tv size={14} />Ver anuncio → +1 escaneo</>}
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{errorMsg}</p>
              <button onClick={reset} className="mt-2 text-xs text-red-400 underline">Volver a intentar</button>
            </div>
          </div>
        )}

        {phase === 'no-results' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-start gap-3">
            <PenLine className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-300 font-medium">No encontramos la carta</p>
              <p className="text-xs text-yellow-400/70 mt-1">
                {detectedName ? `Detectamos "${detectedName}" pero no hay resultados. Corrige el nombre abajo.` : 'No detectamos el nombre. Escríbelo manualmente abajo.'}
              </p>
            </div>
          </div>
        )}

        {(phase === 'preview' || phase === 'results' || phase === 'no-results') && (
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && manualSearch()}
              placeholder="Nombre de la carta…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              autoFocus={phase === 'no-results'}
            />
            <button onClick={manualSearch} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 flex items-center justify-center transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'results' && read && (
          <div className="space-y-2">
            <div className={cx(
              'rounded-xl px-3 py-2 border flex items-start gap-2',
              conf === 'high' ? 'bg-green-500/10 border-green-500/20' : conf === 'medium' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-yellow-500/10 border-yellow-500/20'
            )} role="status">
              <Sparkles className={cx('w-3.5 h-3.5 mt-0.5 shrink-0', conf === 'high' ? 'text-green-400' : conf === 'medium' ? 'text-blue-400' : 'text-yellow-400')} />
              <p className={cx('text-xs', conf === 'high' ? 'text-green-300' : conf === 'medium' ? 'text-blue-300' : 'text-yellow-300')}>
                {conf === 'high' && <>Coincidencia segura: <strong className="text-white">{results[0]?.card.name}</strong> · {results[0]?.card.set.name}</>}
                {conf === 'medium' && <>Probable: <strong className="text-white">{results[0]?.card.name}</strong>. Comprueba que sea tu edición antes de añadirla.</>}
                {conf === 'low' && <>No estoy seguro de la edición. Elige la que coincida con tu carta.</>}
              </p>
            </div>
            <p className="text-[10px] text-gray-500">
              Leído en la foto: {[read.name, read.number, read.set_code, read.hp ? `${read.hp} PS` : null, read.artist].filter(Boolean).join(' · ') || '—'}
              {read.language && read.language !== 'en' ? ` · idioma: ${read.language}` : ''}
            </p>
            {read.language && read.language !== 'en' && (
              <p className="text-[10px] text-yellow-400/80">Carta no inglesa: el número y el total del set no sirven para identificar la edición. Se compara por nombre y datos de la carta.</p>
            )}
          </div>
        )}
        {detectedName && phase === 'results' && !read && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-blue-500/10 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300">Búsqueda: <strong className="text-white">{detectedName}</strong></span>
          </div>
        )}

        {phase === 'results' && (
          results.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">
              <ScanLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
              No se encontraron cartas. Prueba editando el nombre.
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}{read ? ' · ordenados por coincidencia' : ''}</p>
              <div className="grid grid-cols-2 gap-3">
                {results.map(({ card, score, reasons }, idx) => {
                  const eur = cardmarketEur(card, detectedVariant);
                  const best = read !== null && idx === 0 && conf !== 'low';
                  return (
                  <div key={card.id} className={cx('bg-[#111118] border rounded-2xl overflow-hidden', best ? 'border-green-500/40' : 'border-white/8')}>
                    <div className="relative">
                      <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" />
                      {best && <span className="absolute left-1.5 top-1.5 rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-bold text-black">Mejor coincidencia</span>}
                      {addedIds.has(card.id) && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.set.name}{card.set.releaseDate ? ` · ${card.set.releaseDate.slice(0, 4)}` : ''}</p>
                      <p className="text-[10px] text-gray-600">#{card.number}{(card.set.printedTotal ?? card.set.total) ? `/${card.set.printedTotal ?? card.set.total}` : ''}</p>
                      {card.rarity && <RarityBadge rarity={card.rarity} />}
                      {eur !== null && <p className="text-[10px] text-green-400 font-medium">€{eur.toFixed(2)}</p>}
                      {read && reasons.length > 0 && <p className="text-[9px] text-gray-500 leading-tight">{score}% · coincide: {reasons.join(', ')}</p>}
                      <button
                        onClick={() => addCard(card)}
                        disabled={addedIds.has(card.id)}
                        className={cx(
                          'w-full mt-1 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          addedIds.has(card.id) ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95',
                        )}
                      >
                        {addedIds.has(card.id) ? <><CheckCircle2 className="w-3 h-3" /> Añadida</> : <><Plus className="w-3 h-3" /> Añadir</>}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </>
          )
        )}

        <div className="space-y-3 pt-2">
          {phase === 'idle' && (
            <div className="space-y-3">
              {showTutorial && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-blue-300">📷 Cómo escanear una carta</p>
                  <div className="space-y-2 text-xs text-gray-400">
                    {[
                      ['1.', 'Toca "Escanear carta" abajo'],
                      ['2.', 'Toca los tres puntos ⋮ arriba a la derecha'],
                      ['3.', 'Selecciona "Cámara" para hacer una foto directamente'],
                      ['4.', 'O elige una foto existente de tu galería'],
                    ].map(([n, text]) => (
                      <div key={n} className="flex items-start gap-2">
                        <span className="text-blue-400 font-bold shrink-0">{n}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={openCamera}
                disabled={!sessionLoaded || !scansLoaded || (!canScan && isPremium === false)}
                className={cx(
                  'w-full rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform',
                  !sessionLoaded || !scansLoaded ? 'bg-white/5 text-gray-500' :
                  canScan ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-900/40' :
                  'bg-white/5 text-gray-500 cursor-not-allowed'
                )}
              >
                <Camera className="w-5 h-5" />
                {!sessionLoaded || !scansLoaded ? 'Cargando...' : canScan ? 'Escanear carta' : 'Límite alcanzado'}
              </button>
            </div>
          )}
          {phase === 'preview' && (
            <div className="flex gap-3">
              <button onClick={analyzeCard} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform">
                <Sparkles className="w-4 h-4" />
                Identificar carta
              </button>
              <button onClick={openCamera} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {(phase === 'results' || phase === 'no-results') && (
            <div className="flex gap-3">
              <button onClick={openCamera} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Camera className="w-4 h-4" />
                Escanear otra
              </button>
              <button onClick={reset} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {phase === 'error' && (
            <button onClick={openCamera} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Camera className="w-4 h-4" />
              Intentar de nuevo
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <p className="text-center text-[11px] text-gray-600 pb-2">
            Fotografía la carta con buena luz · Sin reflejos · Una sola carta
          </p>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
    </div>
  );
}