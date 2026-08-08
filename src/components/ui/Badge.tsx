import type { HTMLAttributes } from 'react';

import { cx } from '@/utils';

/**
 * Badge — small status/label chip.
 *
 * Used for TCG tags, conditions, and rarity indicators. Variants map to the
 * semantic color system.
 */
type BadgeVariant = 'default' | 'primary' | 'gold' | 'success' | 'warning' | 'error';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-3 text-ink-soft border-line',
  primary: 'bg-primary/15 text-primary-soft border-primary/25',
  gold: 'bg-accent/15 text-accent border-accent/25',
  success: 'bg-success/15 text-success border-success/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  error: 'bg-error/15 text-error border-error/25',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
