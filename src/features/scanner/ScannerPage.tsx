import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  ScanLine,
  RefreshCw,
  Sparkles,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Type,
  Plus,
  Cpu,
} from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { RoutePaths } from '@/config';
import { useI18n } from '@/i18n';
import { cx } from '@/utils';

/* ──────────────────────────────────────────────────────────────── */
/*  Types — self-contained, no imports from feature modules          */
/* ──────────────────────────────────────────────────────────────── */

interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  images: { small: string; large: string };
  set: { id: string; name: string };
}

interface TcgApiResponse {
  data: TcgCard[];
}

interface SavedCard {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  image: string;
  setName: string;
  savedAt: string;
}

type View = 'capture' | 'results';

/* ──────────────────────────────────────────────────────────────── */
/*  Constants                                                         */
/* ──────────────────────────────────────────────────────────────── */

const TCG_API = 'https://api.pokemontcg.io/v2/cards';
const STORAGE_KEY = 'pokemon-collection';

/* ──────────────────────────────────────────────────────────────── */
/*  localStorage helpers                                              */
/* ──────────────────────────────────────────────────────────────── */

function loadCollection(): SavedCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedCard[]) : [];
  } catch {
    return [];
  }
}

function saveToCollection(card: TcgCard): SavedCard {
  const entry: SavedCard = {
    id: card.id,
    name: card.name,
    number: card.number,
    rarity: card.rarity,
    image: card.images.small,
    setName: card.set.name,
    savedAt: new Date().toISOString(),
  };
  const existing = loadCollection();
  if (!existing.some((c) => c.id === entry.id)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, entry]));
  }
  return entry;
}

/* ──────────────────────────────────────────────────────────────── */
/*  Image processing                                                  */
/* ──────────────────────────────────────────────────────────────── */

async function fileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('load'));
      el.src = url;
    });
    const max = 1024;
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ──────────────────────────────────────────────────────────────── */
/*  Basic OCR — uses the browser's TextDetector when available,      */
/*  otherwise returns empty (manual entry fallback).                 */
/* ──────────────────────────────────────────────────────────────── */

async function detectText(dataUrl: string): Promise<string> {
  const w = window as Window & { TextDetector?: new () => { detect: (img: ImageBitmap) => Promise<{ rawValue?: string }[]> } };
  if (!w.TextDetector) return '';

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const detector = new w.TextDetector();
    const results = await detector.detect(bitmap);
    const words: string[] = [];
    for (const r of results) {
      const raw = r.rawValue ?? '';
      for (const part of raw.split(/\s+/)) {
        const clean = part.trim();
        if (clean.length >= 2) words.push(clean);
      }
    }
    // Pick the longest run of capitalized words — most likely the card name
    const runs: string[] = [];
    let current: string[] = [];
    for (const word of words) {
      if (/^[A-Z][a-zA-Z''-]+$/.test(word)) {
        current.push(word);
      } else if (current.length > 0) {
        runs.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) runs.push(current.join(' '));
    if (runs.length === 0) return words.join(' ');
    return runs.sort((a, b) => b.length - a.length)[0];
  } catch {
    return '';
  }
}

/* ──────────────────────────────────────────────────────────────── */
/*  Pokémon TCG API search                                            */
/* ──────────────────────────────────────────────────────────────── */

async function searchCards(query: string): Promise<TcgCard[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${TCG_API}?q=name:${encodeURIComponent(q)}&pageSize=24`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = (await res.json()) as TcgApiResponse;
  return json.data ?? [];
}

/* ──────────────────────────────────────────────────────────────── */
/*  Component                                                         */
/* ──────────────────────────────────────────────────────────────── */

export function ScannerPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cards, setCards] = useState<TcgCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedCardName, setAddedCardName] = useState<string | null>(null);

  const hasImage = capturedImage !== null;

  /* -- File selection -- */

  const openFilePicker = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setCapturedImage(dataUrl);

      // Run text detection and pre-fill the search box
      const detected = await detectText(dataUrl);
      setSearchQuery(detected);
      setView('results');

      // If we got text, auto-search immediately
      if (detected) {
        runSearch(detected);
      }
    } catch {
      setError(t.scanner.imageError);
    } finally {
      setAnalyzing(false);
    }
  };

  /* -- Search -- */

  const runSearch = async (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const results = await searchCards(q);
      setCards(results);
    } catch {
      setCards([]);
      setError(t.scanner.noResults);
    } finally {
      setSearching(false);
    }
  };

  /* -- Add to collection -- */

  const handleAddCard = (card: TcgCard) => {
    saveToCollection(card);
    setAddedCardName(card.name);
    setTimeout(() => setAddedCardName(null), 2500);
  };

  /* -- Reset -- */

  const handleReset = () => {
    setCapturedImage(null);
    setSearchQuery('');
    setCards([]);
    setError(null);
    setView('capture');
  };

  const handleScanAnother = () => {
    handleReset();
    setTimeout(openFilePicker, 50);
  };

  /* ── Render ── */

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate(RoutePaths.Home)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} /> {t.scanner.back}
      </button>

      <PageHeader
        eyebrow={t.scanner.eyebrow}
        title={t.scanner.title}
        subtitle={t.scanner.subtitle}
      />

      <div className="mt-8 flex flex-col items-center">
        {/* Scanner frame — preview or placeholder */}
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-3xl border border-line bg-surface-2">
          {hasImage && capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured card"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div
                className={cx(
                  'flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary-soft',
                  !analyzing && 'animate-pulse-glow'
                )}
              >
                {analyzing ? (
                  <RefreshCw size={36} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <ScanLine size={36} strokeWidth={1.8} />
                )}
              </div>
              <p className="px-8 text-sm text-ink-soft">
                {analyzing ? t.scanner.analyzing : t.scanner.cameraPreview}
              </p>
            </div>
          )}

          {/* Corner guides */}
          <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-primary/50" />
          <span className="pointer-events-none absolute right-4 top-4 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-primary/50" />
          <span className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary/50" />
          <span className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary/50" />
        </div>

        {/* Capture button — only in capture view */}
        {view === 'capture' && (
          <>
            <p className="mt-4 max-w-xs px-4 text-center text-xs leading-relaxed text-ink-muted">
              {t.scanner.captureHint}
            </p>
            <div className="mt-6 w-full max-w-xs">
              <Button
                size="lg"
                fullWidth
                leftIcon={<Camera size={20} />}
                onClick={openFilePicker}
                disabled={analyzing}
                isLoading={analyzing}
              >
                {t.scanner.scanCard}
              </Button>
            </div>

            {/* Info card */}
            <div className="mt-8 w-full max-w-xs rounded-2xl border border-line-soft bg-surface-1 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Cpu size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">{t.scanner.aiRecognition}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {t.scanner.aiRecognitionDesc}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error toast */}
        {error && view === 'capture' && (
          <div className="mt-6 max-w-xs self-center">
            <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Results view — search box + card grid */}
      {view === 'results' && (
        <div className="mt-6 animate-fade-in">
          {/* Captured image thumbnail + retake */}
          <div className="mb-4 flex items-center gap-3">
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className="h-16 w-12 shrink-0 rounded-lg border border-line-soft object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {t.scanner.resultsTitle}
              </p>
              <p className="truncate text-xs text-ink-soft">
                {t.scanner.resultsDesc}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw size={14} />}
              onClick={handleScanAnother}
            >
              {t.scanner.changeImage}
            </Button>
          </div>

          {/* Search box — pre-filled with detected text */}
          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line-soft bg-surface-3 px-3">
              <Search size={16} className="shrink-0 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch();
                }}
                placeholder={t.scanner.manualSearchPlaceholder}
                className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 text-ink-muted hover:text-ink"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button
              size="md"
              variant="primary"
              onClick={() => runSearch()}
              disabled={searchQuery.trim().length < 2 || searching}
              isLoading={searching}
            >
              {t.scanner.search}
            </Button>
          </div>

          {/* Detected text indicator */}
          {searchQuery && (
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <Type size={14} className="shrink-0 text-primary-soft" />
              <span>{t.scanner.detectedText}: {searchQuery}</span>
            </div>
          )}

          {/* Added confirmation toast */}
          {addedCardName && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success animate-scale-in">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{t.scanner.addedToCollection}: {addedCardName}</span>
            </div>
          )}

          {/* Loading skeletons */}
          {searching && cards.length === 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] animate-pulse rounded-2xl border border-line-soft bg-surface-2"
                />
              ))}
            </div>
          )}

          {/* No results */}
          {!searching && cards.length === 0 && searchQuery.trim().length >= 2 && (
            <div className="mt-4 rounded-2xl border border-line-soft bg-surface-1 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-ink-muted">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-semibold text-ink">{t.scanner.noResults}</h3>
              <p className="mt-1 text-sm text-ink-soft">{t.scanner.noResultsDesc}</p>
            </div>
          )}

          {/* Card grid */}
          {cards.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.slice(0, 24).map((card) => (
                <ScannerResultCard
                  key={card.id}
                  card={card}
                  onAdd={handleAddCard}
                />
              ))}
            </div>
          )}

          {/* Cancel / back */}
          <div className="mt-6 flex w-full gap-3">
            <Button
              size="md"
              variant="ghost"
              fullWidth
              leftIcon={<X size={18} />}
              onClick={handleReset}
            >
              {t.scanner.cancel}
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Result card tile                                                  */
/* ──────────────────────────────────────────────────────────────── */

interface ScannerResultCardProps {
  card: TcgCard;
  onAdd: (card: TcgCard) => void;
}

function ScannerResultCard({ card, onAdd }: ScannerResultCardProps) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd(card);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Card
      interactive
      padding="sm"
      className="flex flex-col gap-2 animate-scale-in"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-3">
        <img
          src={card.images.small}
          alt={card.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="px-1 pb-1">
        <p className="truncate text-sm font-semibold text-ink">{card.name}</p>
        <p className="mt-0.5 truncate text-xs text-ink-soft">{card.set.name}</p>
        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <span className="text-[11px] text-ink-muted">#{card.number}</span>
          {card.rarity && (
            <span
              className="truncate text-[11px] font-medium text-accent"
              title={card.rarity}
            >
              {card.rarity}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={added}
        className={cx(
          'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
          added
            ? 'bg-success/15 text-success'
            : 'bg-primary/10 text-primary-soft hover:bg-primary/20'
        )}
      >
        {added ? (
          <>
            <CheckCircle2 size={14} /> Added
          </>
        ) : (
          <>
            <Plus size={14} /> Add
          </>
        )}
      </button>
    </Card>
  );
}