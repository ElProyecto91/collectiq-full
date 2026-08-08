import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Cpu, ScanLine, Image as ImageIcon, RefreshCw, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui';
import { PageHeader } from '@/layouts';
import { useScannerStore } from '@/store';
import { RoutePaths } from '@/config';
import { useI18n } from '@/i18n';
import { cx } from '@/utils';
import { processImage } from '@/features/scanner/utils/image-processor';

/**
 * Scanner page — Phase 1: image capture only.
 *
 * The user picks or photographs a card via <input type="file" accept="image/*">.
 * The image is immediately displayed and processed (resized to max 1024px,
 * JPEG 0.85). No recognition or network call happens yet — the "Analyze card"
 * button is wired for a future phase.
 */
export function ScannerPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const phase = useScannerStore((s) => s.phase);
  const capturedImage = useScannerStore((s) => s.capturedImage);
  const error = useScannerStore((s) => s.error);
  const setPhase = useScannerStore((s) => s.setPhase);
  const setCapturedImage = useScannerStore((s) => s.setCapturedImage);
  const setProcessedImage = useScannerStore((s) => s.setProcessedImage);
  const setError = useScannerStore((s) => s.setError);
  const reset = useScannerStore((s) => s.reset);

  const hasImage = phase === 'capturing' && capturedImage !== null;

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
      setProcessedImage(dataUrl);
      setError(null);
    } catch {
      setError(t.scanner.imageError);
      setCapturedImage(null);
      setProcessedImage(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    reset();
    openFilePicker();
  };

  const handleCancel = () => {
    reset();
  };

  const handleAnalyze = () => {
    // Phase 2 will wire this to scannerService.scan({ image: processedImage }).
  };

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
                  !isProcessing && 'animate-pulse-glow'
                )}
              >
                {isProcessing ? (
                  <RefreshCw size={36} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <ScanLine size={36} strokeWidth={1.8} />
                )}
              </div>
              <p className="px-8 text-sm text-ink-soft">
                {isProcessing ? t.scanner.processingImage : t.scanner.cameraPreview}
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
        <p className="mt-4 max-w-xs px-4 text-center text-xs leading-relaxed text-ink-muted">
          {t.scanner.captureHint}
        </p>

        {/* Action buttons */}
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
      </div>

      {/* Info card — shown only in idle state */}
      {!hasImage && (
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
      {phase === 'error' && error && (
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

      {/* Hidden file input — accepts any image, camera or gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
