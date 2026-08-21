import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, ScanLine, RefreshCw, Sparkles, X,
  Search, CheckCircle2, AlertCircle, Plus, Loader2, PenLine, Tv, Zap,
} from 'lucide-react';
import { RoutePaths } from '@/config';
import { cx } from '@/utils';
import { useCreateCollectionItem } from '@/hooks/use-collection';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { useMissions } from '@/hooks/use-missions';
import { useAnalytics } from '@/hooks/use-analytics';

interface PokemonCard {
  id: string; name: string; number: string; rarity?: string;
  images: { small: string; large: string };
  set: { name: string; series: string; total?: number };
  cardmarket?: { prices?: { averageSellPrice?: number; reverseHoloSell?: number } };
  tcgplayer?: { prices?: {
    normal?: { market?: number };
    holofoil?: { market?: number };
    reverseHolofoil?: { market?: number };
    '1stEditionHolofoil'?: { market?: number };
  }};
}

interface VisionResult {
  text: string;
  number?: string;
  set_code?: string;
  language?: string;
  variant?: string;
  name_confidence?: number;
  variant_confidence?: number;
}

type ScanPhase = 'idle' | 'preview' | 'analyzing' | 'results' | 'no-results' | 'error';

const POKEMON_API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY ?? '';
const DAILY_SCAN_LIMIT = 5;
const AD_BONUS_SCANS = 1;

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractCardDataWithVision(base64: string): Promise<VisionResult> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? `Vision error: ${res.status}`);
  }
  const data = await res.json();
  if (!data.text) throw new Error('No se detectó texto en la imagen');
  return data as VisionResult;
}

function getPriceForVariant(card: PokemonCard, variant: string): number | null {
  const tcg = card.tcgplayer?.prices;
  const cm = card.cardmarket?.prices;

  if (variant === 'reverse_holo') {
    return tcg?.reverseHolofoil?.market ?? cm?.reverseHoloSell ?? null;
  }
  if (variant === 'holo' || variant === 'full_art' || variant === 'secret_rare') {
    return tcg?.holofoil?.market ?? cm?.averageSellPrice ?? null;
  }
  if (variant === 'first_edition') {
    return tcg?.['1stEditionHolofoil']?.market ?? tcg?.holofoil?.market ?? null;
  }
  // normal / promo / default
  return cm?.averageSellPrice ?? tcg?.normal?.market ?? tcg?.holofoil?.market ?? null;
}

function getVariantLabel(variant: string): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    holo: 'Holo',
    reverse_holo: 'Reverse Holo',
    full_art: 'Full Art',
    secret_rare: 'Secret Rare',
    promo: 'Promo',
    first_edition: '1ª Edición',
  };
  return labels[variant] ?? variant;
}

function getLanguageLabel(lang: string): string {
  const labels: Record<string, string> = {
    en: '🇬🇧', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
    fr: '🇫🇷', de: '🇩🇪', es: '🇪🇸', it: '🇮🇹', pt: '🇵🇹',
  };
  return labels[lang] ?? '🌐';
}

function getRarityColor(rarity?: string): string {
  if (!rarity) return 'text-gray-400';
  const r = rarity.toLowerCase();
  if (r.includes('secret') || r.includes('hyper')) return 'text-yellow-300';
  if (r.includes('ultra') || r.includes('rainbow')) return 'text-purple-400';
  if (r.includes('rare')) return 'text-blue-400';
  return 'text-gray-400';
}

async function searchPokemonTCG(name: string, number?: string, retries = 3): Promise<PokemonCard[]> {
  let query = `name:"${encodeURIComponent(name)}"`;
  if (number) query += ` number:${encodeURIComponent(number)}`;
  const url = `https://api.pokemontcg.io/v2/cards?q=${query}&pageSize=20&orderBy=-set.releaseDate`;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'X-Api-Key': POKEMON_API_KEY } });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1000 * (i + 1))); continue; }
      if (!res.ok) throw new Error(`PokéTCG error: ${res.status}`);
      const json = await res.json();
      return (json.data ?? []) as PokemonCard[];
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
  return [];
}

function getTodayKey() { return 'scans_' + new Date().toISOString().split('T')[0]; }
function getScansToday(): number { return parseInt(localStorage.getItem(getTodayKey()) ?? '0'); }
function incrementScansToday() { localStorage.setItem(getTodayKey(), String(getScansToday() + 1)); }
function getAccumulatedScans(): number { return parseInt(localStorage.getItem('scans_accumulated') ?? '0'); }
function setAccumulatedScans(n: number) { localStorage.setItem('scans_accumulated', String(n)); }

export default function ScannerPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTutorial] = useState(true);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [detectedName, setDetectedName] = useState('');
  const [detectedVariant, setDetectedVariant] = useState('normal');
  const [detectedLanguage, setDetectedLanguage] = useState('en');
  const [nameConfidence, setNameConfidence] = useState(0);
  const [variantConfidence, setVariantConfidence] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [scansToday, setScansToday] = useState(getScansToday());
  const [accumulated, setAccumulated] = useState(getAccumulatedScans());
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [watchingAd, setWatchingAd] = useState(false);

  const { mutate: createItem } = useCreateCollectionItem();
  const telegramUser = useUserStore((s) => s.telegramUser);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);
  const { updateMission } = useMissions();
  const { track } = useAnalytics();

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!telegramUser?.id) { setIsPremium(false); return; }
    supabase.from('user_premium').select('plan, expires_at')
      .eq('telegram_user_id', telegramUser.id).maybeSingle()
      .then(({ data }) => {
        const isExpired = data?.expires_at ? new Date(data.expires_at) < new Date() : true;
        setIsPremium(data?.plan === 'go' && !isExpired);
      });
  }, [telegramUser?.id, sessionLoaded]);

  const totalScansAvailable = DAILY_SCAN_LIMIT + accumulated;
  const canScan = isPremium === true || (isPremium !== null && scansToday < totalScansAvailable);
  const remainingScans = Math.max(0, totalScansAvailable - scansToday);

  const watchAd = useCallback(() => {
    if (watchingAd) return;
    setWatchingAd(true);
    (window as any).show_11612154?.()
      .then(() => {
        const newAccumulated = accumulated + AD_BONUS_SCANS;
        setAccumulated(newAccumulated);
        setAccumulatedScans(newAccumulated);
        setStatusMsg('🎉 +' + AD_BONUS_SCANS + ' escaneo añadido');
        track('ad_watched', { result: 'completed' });
        setTimeout(() => setStatusMsg(''), 3000);
      })
      .catch(() => {
        setStatusMsg('❌ Anuncio no completado. Inténtalo de nuevo.');
        setTimeout(() => setStatusMsg(''), 3000);
      })
      .finally(() => setWatchingAd(false));
  }, [watchingAd, accumulated]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCurrentFile(file);
    setPhase('preview');
    setResults([]);
    setDetectedName('');
    setDetectedVariant('normal');
    setDetectedLanguage('en');
    setNameConfidence(0);
    setVariantConfidence(0);
    setSearchQuery('');
    setErrorMsg('');
    setStatusMsg('');
    e.target.value = '';
  }, []);

  const openCamera = () => {
    if (!telegramUser?.id) {
      setStatusMsg('Inicia sesión para escanear cartas.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    if (!canScan) {
      setStatusMsg('Límite diario alcanzado. Ve un anuncio para conseguir más escaneos.');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    fileInputRef.current?.click();
  };

  const analyzeCard = useCallback(async () => {
    if (!currentFile || !canScan) return;
    track('scan_started');
    setPhase('analyzing');
    setProgress(20);
    setStatusMsg('Enviando imagen a Gemini…');
    try {
      const base64 = await toBase64(currentFile);
      setProgress(40);
      setStatusMsg('Identificando la carta…');
      const visionData = await extractCardDataWithVision(base64);
      setProgress(60);

      const cardName = visionData.text?.trim();
      const cardNumber = visionData.number ?? undefined;
      const variant = visionData.variant ?? 'normal';
      const language = visionData.language ?? 'en';
      const nameConf = visionData.name_confidence ?? 0;
      const variantConf = visionData.variant_confidence ?? 0;

      setDetectedVariant(variant);
      setDetectedLanguage(language);
      setNameConfidence(nameConf);
      setVariantConfidence(variantConf);

      if (!cardName) {
        setDetectedName('');
        setSearchQuery('');
        setResults([]);
        setPhase('no-results');
        return;
      }

      let cards: PokemonCard[] = [];
      let usedName = '';

      try {
        setStatusMsg(`Buscando "${cardName}"…`);
        // Primero buscar con número si lo tenemos (más preciso)
        if (cardNumber) {
          cards = await searchPokemonTCG(cardName, cardNumber);
        }
        // Si no encontró con número, buscar solo por nombre
        if (cards.length === 0) {
          cards = await searchPokemonTCG(cardName);
        }
        if (cards.length > 0) usedName = cardName;
      } catch {
        throw new Error('pokétcg_error');
      }

      if (!isPremium) {
        if (accumulated > 0) {
          const newAcc = accumulated - 1;
          setAccumulated(newAcc);
          setAccumulatedScans(newAcc);
        } else {
          incrementScansToday();
          setScansToday(getScansToday());
        }
      }

      setProgress(100);
      setDetectedName(usedName || cardName);
      setSearchQuery(usedName || cardName);
      setResults(cards);
      setPhase(cards.length === 0 ? 'no-results' : 'results');
      track(cards.length === 0 ? 'scan_no_results' : 'scan_success', {
        cardName: usedName,
        resultsCount: cards.length,
        language,
        variant,
        nameConfidence: nameConf,
      });

    } catch (err: any) {
      const msg = err?.message ?? '';
      track('scan_failed', { error: msg });
      if (msg === 'pokétcg_error' || msg.includes('fetch') || msg.includes('500') || msg.includes('503') || msg.includes('PokéTCG')) {
        setErrorMsg('La base de datos oficial de Pokémon está caída. Inténtalo de nuevo en unos minutos. No se ha descontado ningún escaneo.');
      } else {
        setErrorMsg(msg || 'Error al analizar la carta. Inténtalo de nuevo.');
      }
      setPhase('error');
    }
  }, [currentFile, canScan, accumulated, isPremium]);

  const manualSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setPhase('analyzing');
    setProgress(50);
    setStatusMsg(`Buscando "${searchQuery}"…`);
    try {
      const cards = await searchPokemonTCG(searchQuery.trim());
      setProgress(100);
      setResults(cards);
      setPhase(cards.length === 0 ? 'no-results' : 'results');
      track(cards.length === 0 ? 'scan_no_results' : 'scan_success', { cardName: searchQuery, resultsCount: cards.length });
    } catch (err: any) {
      const msg = err?.message ?? '';
      track('scan_failed', { error: msg });
      setErrorMsg('La base de datos oficial de Pokémon está caída. Inténtalo de nuevo en unos minutos.');
      setPhase('error');
    }
  }, [searchQuery]);

  const addCard = async (card: PokemonCard) => {
    if (!telegramUser?.id) return;
    const price = getPriceForVariant(card, detectedVariant);
    createItem({
      cardId: card.id, tcg: 'pokemon', telegramUserId: telegramUser.id,
      cardName: card.name, setName: card.set.name, cardNumber: card.number,
      rarity: card.rarity ?? null, imageUrl: card.images.small, quantity: 1,
      favorite: false, setTotal: card.set.total ?? null,
      marketPrice: price ?? card.cardmarket?.prices?.averageSellPrice ?? null,
      tcgplayerPrice: getPriceForVariant(card, detectedVariant) ?? null,
      currency: 'EUR',
    });
    setAddedIds(prev => new Set(prev).add(card.id));
    setStatusMsg(`✅ ${card.name} añadida a tu colección`);
    setTimeout(() => setStatusMsg(''), 3000);
    await updateMission('add_card');
    track('card_added', { cardName: card.name, setName: card.set.name, variant: detectedVariant, language: detectedLanguage });

    const { count: totalCards } = await supabase
      .from('collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('telegram_user_id', telegramUser.id);
    fetch('/api/check-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUserId: telegramUser.id, totalCards: (totalCards ?? 0) + 1 }),
    });
  };

  const reset = () => {
    setPhase('idle'); setPreviewUrl(null); setCurrentFile(null);
    setDetectedName(''); setSearchQuery(''); setResults([]);
    setErrorMsg(''); setStatusMsg(''); setProgress(0);
    setDetectedVariant('normal'); setDetectedLanguage('en');
    setNameConfidence(0); setVariantConfidence(0);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f] text-white pb-24">
      <div className="relative px-4 pt-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-transparent pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => navigate(RoutePaths.Home)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
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
        {!sessionLoaded && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
        )}
        {sessionLoaded && !telegramUser?.id && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3">
            <p className="text-xs text-gray-500 text-center">Inicia sesión para ver tus escaneos</p>
          </div>
        )}
        {sessionLoaded && telegramUser?.id && isPremium === null && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/2" />
          </div>
        )}
        {sessionLoaded && telegramUser?.id && isPremium === true && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3 flex items-center gap-2">
            <Zap size={16} className="text-yellow-400" />
            <p className="text-xs font-bold" style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>CollectIQ GO · Escaneos ilimitados ✨</p>
          </div>
        )}
        {sessionLoaded && telegramUser?.id && isPremium === false && (
          <div className="bg-[#111118] border border-white/8 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-400" />
              <div>
                <p className="text-xs font-bold text-white">
                  {remainingScans} escaneo{remainingScans !== 1 ? 's' : ''} disponible{remainingScans !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-gray-500">
                  {scansToday}/{DAILY_SCAN_LIMIT} diarios · {accumulated} extra
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
        <div className="relative rounded-2xl overflow-hidden bg-[#111118] border border-white/10" style={{ aspectRatio: '3/4' }}>
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
            <span key={c} className={cx('absolute w-5 h-5 border-blue-400',
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
                <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        {statusMsg && phase !== 'analyzing' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3 text-sm text-blue-300 text-center">{statusMsg}</div>
        )}

        {sessionLoaded && telegramUser?.id && isPremium === false && !canScan && phase === 'idle' && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-orange-300">⚡ Límite diario alcanzado</p>
            <p className="text-xs text-orange-400/80">Has usado tus {DAILY_SCAN_LIMIT} escaneos de hoy. Ve un anuncio para conseguir más o hazte GO para escaneos ilimitados.</p>
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
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && manualSearch()}
              placeholder="Nombre de la carta…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
              autoFocus={phase === 'no-results'} />
            <button onClick={manualSearch} className="bg-blue-600 hover:bg-blue-500 rounded-xl px-4 flex items-center justify-center transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {detectedName && phase === 'results' && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 flex-wrap">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-blue-300">
              {getLanguageLabel(detectedLanguage)} <strong className="text-white">{detectedName}</strong>
            </span>
            <span className="ml-auto text-[10px] bg-white/10 rounded-lg px-2 py-0.5 text-gray-300">
              {getVariantLabel(detectedVariant)}
            </span>
            {nameConfidence > 0 && (
              <span className={cx('text-[10px] rounded-lg px-2 py-0.5',
                nameConfidence >= 85 ? 'bg-green-500/20 text-green-400' :
                nameConfidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400')}>
                {nameConfidence}% ID
              </span>
            )}
            {variantConfidence > 0 && (
              <span className={cx('text-[10px] rounded-lg px-2 py-0.5',
                variantConfidence >= 85 ? 'bg-green-500/20 text-green-400' :
                variantConfidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400')}>
                {variantConfidence}% variante
              </span>
            )}
          </div>
        )}

        {/* Selector manual de variante si confianza baja */}
        {phase === 'results' && variantConfidence > 0 && variantConfidence < 75 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 space-y-2">
            <p className="text-xs text-yellow-300 font-medium">⚠️ No estamos seguros de la variante. ¿Cuál es?</p>
            <div className="flex gap-2 flex-wrap">
              {['normal', 'holo', 'reverse_holo', 'promo', 'first_edition'].map(v => (
                <button key={v} onClick={() => setDetectedVariant(v)}
                  className={cx('px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                    detectedVariant === v
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                      : 'bg-white/5 border-white/10 text-gray-400')}>
                  {getVariantLabel(v)}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'results' && results.length > 0 && (
          <>
            <p className="text-xs text-gray-500">{results.length} resultado{results.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-2 gap-3">
              {results.map((card) => {
                const price = getPriceForVariant(card, detectedVariant);
                return (
                  <div key={card.id} className="bg-[#111118] border border-white/8 rounded-2xl overflow-hidden">
                    <div className="relative">
                      <img src={card.images.small} alt={card.name} className="w-full aspect-[2/3] object-cover" />
                      {addedIds.has(card.id) && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <p className="text-xs font-bold truncate">{card.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{card.set.name}</p>
                      {card.rarity && <p className={cx('text-[10px] truncate font-medium', getRarityColor(card.rarity))}>{card.rarity}</p>}
                      {price
                        ? <p className="text-[10px] text-green-400 font-medium">€{price.toFixed(2)} <span className="text-gray-500">({getVariantLabel(detectedVariant)})</span></p>
                        : <p className="text-[10px] text-gray-500">Sin precio</p>
                      }
                      <button onClick={() => addCard(card)} disabled={addedIds.has(card.id)}
                        className={cx('w-full mt-1 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          addedIds.has(card.id) ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95')}>
                        {addedIds.has(card.id) ? <><CheckCircle2 className="w-3 h-3" />Añadida</> : <><Plus className="w-3 h-3" />Añadir</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
                      ['2.', 'Se abrirá el selector de archivos. Toca los tres puntos ⋮ arriba a la derecha'],
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
              <button onClick={openCamera}
                disabled={!sessionLoaded || (!canScan && isPremium !== null && !!telegramUser?.id)}
                className={cx('w-full rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform',
                  !sessionLoaded ? 'bg-white/5 text-gray-500' :
                  !telegramUser?.id ? 'bg-white/5 text-gray-500 cursor-not-allowed' :
                  isPremium === null ? 'bg-white/5 text-gray-500' :
                  canScan ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-900/40' :
                  'bg-white/5 text-gray-500 cursor-not-allowed')}>
                <Camera className="w-5 h-5" />
                {!sessionLoaded ? 'Cargando...' :
                  !telegramUser?.id ? 'Inicia sesión' :
                  isPremium === null ? 'Cargando...' :
                  canScan ? 'Escanear carta' : 'Límite alcanzado'}
              </button>
            </div>
          )}
          {phase === 'preview' && (
            <div className="flex gap-3">
              <button onClick={analyzeCard}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform">
                <Sparkles className="w-4 h-4" />Identificar carta
              </button>
              <button onClick={openCamera} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {(phase === 'results' || phase === 'no-results') && (
            <div className="flex gap-3">
              <button onClick={openCamera}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Camera className="w-4 h-4" />Escanear otra
              </button>
              <button onClick={reset} className="bg-white/8 border border-white/10 rounded-2xl px-4 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
          {phase === 'error' && (
            <button onClick={openCamera}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Camera className="w-4 h-4" />Intentar de nuevo
            </button>
          )}
        </div>

        {phase === 'idle' && (
          <p className="text-center text-[11px] text-gray-600 pb-2">
            Fotografía la carta con buena luz · Sin reflejos · Una sola carta · Cualquier idioma
          </p>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
    </div>
  );
}