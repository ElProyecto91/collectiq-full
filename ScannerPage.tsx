import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Cpu,
  ScanLine,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Type,
} from 'lucide-react';

import { Button, Card } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useScannerStore } from '@/store';
import { RoutePaths } from '@/config';
import { useI18n } from '@/i18n';
import { cx } from '@/utils';
import { processImage } from '@/features/scanner/utils/image-processor';
import { scannerService } from '@/features/scanner/services';
import type { RecognitionResult } from '@/features/scanner/services';
import { CardImage } from '@/features/catalog/components';
import { AddToCollectionModal } from '@/features/collection/components';
import { cardRepository } from '@/features/catalog/services';
import type { CatalogCard } from '@/features/catalog/types/catalog';

type View = 'capture' | 'analyzing' | 'results' | 'added';

/**
 * Scanner page — capture a card photo, run basic OCR text extraction, search
 * the Pokémon TCG API for matching cards, and let the user pick one to add to
 * their collection. Manual name entry is offered as a fallback when no text is
 * detected or no matches are found.
 */
export function ScannerPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<View>('capture');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [manualCards, setManualCards] = useState<CatalogCard[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const setPhase = useScannerStore((s) => s.setPhase);
  const setCapturedImageStore = useScannerStore((s) => s.setCapturedImage);
  const setProcessedImage = useScannerStore((s) => s.setProcessedImage);
  const setErrorStore = useScannerStore((s) => s.setError);
  const reset = useScannerStore((s) => s.reset);

  const hasImage = capturedImage !== null;

  const openFilePicker = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    setPhase('capturing');
    try {
      const { dataUrl } = await processImage(file);
      setCapturedImage(dataUrl);
      setCapturedImageStore(dataUrl);
      setProcessedImage(dataUrl);
      setError(null);
      setView('capture');
    } catch {
      setError(t.scanner.imageError);
      setErrorStore(t.scanner.imageError);
      setCapturedImage(null);
      setCapturedImageStore(null);
      setProcessedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    setManualQuery('');
    setManualCards([]);
    setView('capture');
    reset();
    openFilePicker();
  };

  const handleCancel = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    setManualQuery('');
    setManualCards([]);
    setView('capture');
    reset();
  };

  const handleAnalyze = async () => {
    if (!capturedImage) return;
    setView('analyzing');
    setPhase('recognizing');
    setError(null);
    try {
      const res = await scannerService.scan({ image: capturedImage, tcg: 'pokemon' });
      setResult(res);
      setView('results');
      setPhase('result');
    } catch {
      setError(t.scanner.imageError);
      setErrorStore(t.scanner.imageError);
      setView('capture');
      setPhase('error');
    }
  };

  const handleRetryAnalysis = () => {
    setResult(null);
    setManualQuery('');
    setManualCards([]);
    setView('capture');
    setPhase('capturing');
  };

  const handleManualSearch = async () => {
    const q = manualQuery.trim();
    if (q.length < 2) return;
    setManualSearching(true);
    try {
      const page = await cardRepository.search(q, 1);
      setManualCards(page.cards);
    } catch {
      setManualCards([]);
    } finally {
      setManualSearching(false);
    }
  };

  const handleSelectCard = (card: CatalogCard) => {
    setSelectedCard(card);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    if (view === 'results') {
      setView('added');
    }
  };

  const handleScanAnother = () => {
    setCapturedImage(null);
    setResult(null);
    setSelectedCard(null);
    setManualQuery('');
    setManualCards([]);
    setView('capture');
    reset();
    openFilePicker();
  };

  const detectedText = result?.extracted?.text ?? '';
  const resultCards = result?.cards ?? [];
  const showManualFallback =
    view === 'results' && resultCards.length === 0 && (!result?.extracted || !result.extracted.usedDetector || result.extracted.words.length === 0);
  const showNoResults =
    view === 'results' && resultCards.length === 0 && !showManualFallback;
  const displayCards = resultCards.length > 0 ? resultCards : manualCards;

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
        {/* Viewport — shows placeholder or captured image */}
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-3xl border border-line bg-surface-2">
          {hasImage && capturedImage ? (
            <img
              src={capturedImage}
              alt={t.scanner.selectOrPhoto}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div
                className={cx(
                  'flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary-soft',
                  !isProcessing && view === 'capture' && 'animate-pulse-glow'
                )}
              >
                {isProcessing || view === 'analyzing' ? (
                  <RefreshCw size={36} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <ScanLine size={36} strokeWidth={1.8} />
                )}
              </div>
              <p className="px-8 text-sm text-ink-soft">
                {isProcessing
                  ? t.scanner.processingImage
                  : view === 'analyzing'
                    ? t.scanner.analyzing
                    : t.scanner.cameraPreview}
              </p>
            </div>
          )}

          {/* Corner guides — always visible */}
          <span className="absolute left-4 top-4 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-primary/50" />
          <span className="absolute right-4 top-4 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-primary/50" />
          <span className="absolute bottom-4 left-4 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-primary/50" />
          <span className="absolute bottom-4 right-4 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-primary/50" />
        </div>

        {/* Hint text */}
        {view === 'capture' && (
          <p className="mt-4 max-w-xs px-4 text-center text-xs leading-relaxed text-ink-muted">
            {t.scanner.captureHint}
          </p>
        )}

        {view === 'analyzing' && (
          <p className="mt-4 max-w-xs px-4 text-center text-xs leading-relaxed text-ink-muted">
            {t.scanner.analyzingDesc}
          </p>
        )}

        {/* Action buttons — capture view */}
        {view === 'capture' && (
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            {!hasImage ? (
              <Button
                size="lg"
                fullWidth
                leftIcon={<Camera size={20} />}
                onClick={openFilePicker}
                disabled={isProcessing}
              >
                {t.scanner.scanCard}
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="primary"
                  fullWidth
                  leftIcon={<Sparkles size={20} />}
                  onClick={handleAnalyze}
                  disabled={isProcessing}
                >
                  {t.scanner.analyzeCard}
                </Button>
                <div className="flex gap-3">
                  <Button
                    size="md"
                    variant="outline"
                    fullWidth
                    leftIcon={<RefreshCw size={18} />}
                    onClick={handleRetake}
                  >
                    {t.scanner.changeImage}
                  </Button>
                  <Button
                    size="md"
                    variant="ghost"
                    fullWidth
                    leftIcon={<X size={18} />}
                    onClick={handleCancel}
                  >
                    {t.scanner.cancel}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Added view */}
        {view === 'added' && (
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{t.scanner.addedToCollection}</span>
            </div>
            <Button
              size="lg"
              variant="primary"
              fullWidth
              leftIcon={<Camera size={20} />}
              onClick={handleScanAnother}
            >
              {t.scanner.addAnother}
            </Button>
            <Button
              size="md"
              variant="ghost"
              fullWidth
              onClick={handleCancel}
            >
              {t.scanner.back}
            </Button>
          </div>
        )}
      </div>

      {/* Results section */}
      {view === 'results' && (
        <div className="mt-6 animate-fade-in">
          {/* Detected text */}
          {detectedText ? (
            <div className="mb-4 rounded-2xl border border-line-soft bg-surface-1 p-4">
              <div className="flex items-start gap-2">
                <Type size={16} className="mt-0.5 shrink-0 text-primary-soft" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    {t.scanner.detectedText}
                  </p>
                  <p className="mt-1 text-sm text-ink">{detectedText}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-line-soft bg-surface-1 p-4">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-ink-muted" />
              <p className="text-sm text-ink-soft">{t.scanner.noTextDetected}</p>
            </div>
          )}

          {/* Results header */}
          {displayCards.length > 0 && (
            <>
              <h3 className="font-display text-base font-bold text-ink">
                {t.scanner.resultsTitle}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{t.scanner.resultsDesc}</p>
            </>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="rounded-2xl border border-line-soft bg-surface-1 p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 text-ink-muted">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-semibold text-ink">{t.scanner.noResults}</h3>
              <p className="mt-1 text-sm text-ink-soft">{t.scanner.noResultsDesc}</p>
            </div>
          )}

          {/* Card results grid */}
          {displayCards.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displayCards.slice(0, 12).map((card) => (
                <ScannerResultCard
                  key={card.id}
                  card={card}
                  onSelect={handleSelectCard}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Manual search fallback */}
          {showManualFallback && (
            <div className="mt-2">
              <h3 className="font-display text-base font-bold text-ink">
                {t.scanner.manualSearch}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">{t.scanner.noTextDetected}</p>
            </div>
          )}

          {view === 'results' && (
            <div className="mt-4 flex gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-line-soft bg-surface-3 px-3">
                <Search size={16} className="shrink-0 text-ink-muted" />
                <input
                  type="text"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSearch();
                  }}
                  placeholder={t.scanner.manualSearchPlaceholder}
                  className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
              <Button
                size="md"
                variant="primary"
                onClick={handleManualSearch}
                disabled={manualQuery.trim().length < 2 || manualSearching}
                isLoading={manualSearching}
              >
                {t.scanner.search}
              </Button>
            </div>
          )}

          {/* Retry / retake actions */}
          <div className="mt-6 flex w-full gap-3">
            <Button
              size="md"
              variant="outline"
              fullWidth
              leftIcon={<RefreshCw size={18} />}
              onClick={handleRetryAnalysis}
            >
              {t.scanner.retryAnalysis}
            </Button>
            <Button
              size="md"
              variant="ghost"
              fullWidth
              leftIcon={<X size={18} />}
              onClick={handleCancel}
            >
              {t.scanner.cancel}
            </Button>
          </div>
        </div>
      )}

      {/* Info card — shown only in idle/capture state with no image */}
      {view === 'capture' && !hasImage && (
        <div className="mt-8 rounded-2xl border border-line-soft bg-surface-1 p-5">
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
      )}

      {/* Error state */}
      {error && view === 'capture' && (
        <div className="mt-6 max-w-xs self-center">
          <div className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            <ImageIcon size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            size="md"
            variant="outline"
            fullWidth
            className="mt-3"
            onClick={openFilePicker}
          >
            {t.scanner.scanCard}
          </Button>
        </div>
      )}

      {/* Add to collection modal */}
      {selectedCard && (
        <AddToCollectionModal
          card={selectedCard}
          open={modalOpen}
          onClose={handleModalClose}
        />
      )}

      {/* Hidden file input — accepts any image, camera or gallery */}
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

/* ── Result card tile ──────────────────────────────────────────── */

interface ScannerResultCardProps {
  card: CatalogCard;
  onSelect: (card: CatalogCard) => void;
  t: ReturnType<typeof useI18n>['t'];
}

function ScannerResultCard({ card, onSelect, t }: ScannerResultCardProps) {
  return (
    <Card
      interactive
      padding="sm"
      className="flex flex-col gap-2 animate-scale-in"
      onClick={() => onSelect(card)}
      role="button"
      tabIndex={0}
      aria-label={`${card.name} from ${card.set.name}`}
    >
      <CardImage
        src={card.images.small}
        alt={card.name}
        className="aspect-[3/4] w-full"
      />
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
    </Card>
  );
}
