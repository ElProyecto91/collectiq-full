import type { ReactNode } from 'react';

import { cx } from '@/utils';

/**
 * PageHeader — the consistent top-of-page title block.
 *
 * Renders an optional eyebrow, a display-font title, and a supporting
 * subtitle. Right-aligned actions (e.g. filter buttons) can be passed via the
 * `action` slot. Padding respects the Telegram safe-area inset.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, eyebrow, action, className }: PageHeaderProps) {
  return (
    <header
      className={cx('flex items-start justify-between gap-3 pt-2', className)}
      style={{ paddingTop: 'calc(var(--tg-safe-top) + 0.5rem)' }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-soft">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate font-display text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
