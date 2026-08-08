import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '@/utils';

/**
 * Card — the primary surface container.
 *
 * Rounded, softly elevated, with optional padding and interactive (pressable)
 * treatment. Used for stats, list items, and hero blocks. Glass variant is
 * reserved for elevated/floating surfaces per the design system.
 */
type CardVariant = 'default' | 'glass' | 'flat';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Make the card behave like a button (cursor, press scale, hover). */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  variant = 'default',
  interactive = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        'rounded-2xl',
        variant === 'default' && 'bg-surface-2 border border-line-soft shadow-[var(--shadow-card)]',
        variant === 'glass' && 'glass border border-line/60 shadow-[var(--shadow-card)]',
        variant === 'flat' && 'bg-surface-2 border border-line-soft',
        interactive &&
          'cursor-pointer transition-[transform,box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-premium)] hover:border-line active:scale-[0.985] hover:shadow-[var(--shadow-elevated)]',
        paddingClasses[padding],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
