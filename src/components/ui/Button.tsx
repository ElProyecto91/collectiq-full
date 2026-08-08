import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cx } from '@/utils';

/**
 * Button — the single action primitive used across the app.
 *
 * Variants cover the full range of affordances: `primary` (electric blue,
 * high-contrast CTA), `gold` (premium accent), `ghost` (low-emphasis inline),
 * and `outline` (bordered, for secondary actions on busy surfaces). Sizes are
 * tuned for touch targets (min 44px on mobile).
 */
type Variant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Leading icon node. */
  leftIcon?: ReactNode;
  /** Trailing icon node. */
  rightIcon?: ReactNode;
  /** Stretch to fill the parent width. */
  fullWidth?: boolean;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-strong active:bg-primary-strong shadow-[0_8px_24px_-10px_var(--color-primary-glow)]',
  gold:
    'bg-accent text-base hover:bg-accent-strong active:bg-accent-strong shadow-[0_8px_24px_-10px_var(--color-accent-glow)]',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink active:bg-surface-3',
  outline:
    'bg-transparent border border-line text-ink hover:border-primary-soft hover:text-primary-soft active:border-primary',
  danger: 'bg-transparent text-error hover:bg-error/10 active:bg-error/15 border border-error/30',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth,
    isLoading,
    disabled,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cx(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-[background-color,color,border-color,transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-premium)]',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {isLoading ? <Spinner size={size === 'lg' ? 20 : 16} /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
