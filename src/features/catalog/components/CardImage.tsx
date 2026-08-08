import { useState, type ImgHTMLAttributes } from 'react';
import { ImageIcon } from 'lucide-react';

import { cx } from '@/utils';
import { useI18n } from '@/i18n';

/**
 * CardImage — premium card image with robust loading states.
 *
 * The image is always rendered at opacity-100 (never hidden behind a
 * state gate). A shimmer background sits BEHIND the image on the container
 * and is removed once `onLoad` fires. This avoids the failure mode where
 * `onLoad` never fires (cached images, lazy-loading heuristics) and the
 * image stays permanently invisible.
 *
 * If the URL is missing or the request errors, an icon placeholder replaces
 * the broken-image glyph.
 */
export interface CardImageProps {
  src: string | null;
  alt: string;
  /** Tailwind class for the frame's aspect ratio, e.g. "aspect-[3/4]". */
  className?: string;
  /** Extra classes for the <img> element. */
  imgClassName?: string;
  /** Fallback icon size in pixels. */
  fallbackIconSize?: number;
  /** Whether to enable native lazy loading (default false — grid images are visible). */
  lazy?: boolean;
  /** Optional extra <img> attributes (srcset, sizes, etc.). */
  imgProps?: Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    'src' | 'alt' | 'onLoad' | 'onError' | 'loading'
  >;
}

export function CardImage({
  src,
  alt,
  className,
  imgClassName,
  fallbackIconSize = 28,
  lazy = false,
  imgProps,
}: CardImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t, tr } = useI18n();

  const handleLoad = () => {
    setLoaded(true);
    setFailed(false);
  };

  const handleError = () => {
    setFailed(true);
    setLoaded(false);
  };

  const showShimmer = src !== null && !loaded && !failed;
  const showFallback = src === null || failed;

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-xl bg-surface-3',
        showShimmer && 'animate-shimmer',
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cx('h-full w-full object-contain', imgClassName)}
          {...imgProps}
        />
      ) : null}

      {showFallback && (
        <div
          className="absolute inset-0 flex items-center justify-center text-ink-faint"
          aria-label={failed ? tr('cardImage.imageUnavailable', { alt }) : t.cardImage.noImage}
        >
          <ImageIcon size={fallbackIconSize} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
