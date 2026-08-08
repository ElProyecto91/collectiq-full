import type { ReactNode } from 'react';

import { cx, initials } from '@/utils';
import { useI18n } from '@/i18n';

/**
 * Avatar — collector profile image with graceful fallback.
 *
 * Renders the Telegram/Supabase photo when available; otherwise a monogram
 * generated from the display name on a gradient surface. Used in the profile
 * screen and home greeting.
 */
export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  children?: ReactNode;
}

export function Avatar({ src, name, size = 56, className, children }: AvatarProps) {
  const { t } = useI18n();

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? t.cardImage.noImage}
        width={size}
        height={size}
        loading="lazy"
        className={cx('rounded-full object-cover border border-line', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cx(
        'flex items-center justify-center rounded-full border border-line bg-gradient-to-br from-surface-3 to-surface-2 font-display font-bold text-ink-soft',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-label={name ? `${name}'s avatar` : t.cardImage.noImage}
      role="img"
    >
      {children ?? initials(name)}
    </div>
  );
}
