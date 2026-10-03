import { useState } from 'react';
import { Box } from 'lucide-react';

interface Props {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

/**
 * Catalog images are hotlinked from Rebrickable's CDN and a share of the URLs in
 * the dump return 404, so a placeholder is always ready.
 */
export function LegoImage({ src, alt, className = '' }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-white/5 text-white/20 ${className}`} role="img" aria-label={alt}>
        <Box className="w-1/3 h-1/3 max-w-8 max-h-8" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain bg-white/5 ${className}`}
    />
  );
}
