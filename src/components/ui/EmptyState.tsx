import type { ReactNode } from 'react';

import { cx } from '@/utils';

/**
 * EmptyState — the shared "nothing here yet" surface.
 *
 * Used by collection, wishlist, and explorer when there's no data. Renders an
 * icon, a clear title, supportive copy, and an optional CTA. Designed to feel
 * inviting rather than broken.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in',
        className
      )}
    >
      {icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
