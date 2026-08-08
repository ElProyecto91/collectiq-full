import { cx } from '@/utils';

/** Shimmering placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-lg bg-surface-2',
        className
      )}
      aria-hidden="true"
    />
  );
}

/** A skeleton card matching the collection grid item shape. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-2 p-4">
      <Skeleton className="mb-3 aspect-[3/4] w-full rounded-xl" />
      <Skeleton className="mb-2 h-3.5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** A grid of skeleton cards for list-loading states. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A single-line skeleton for row/list placeholders. */
export function LineSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cx('h-4 w-full', className)} />;
}
