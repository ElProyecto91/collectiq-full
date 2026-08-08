import { cx } from '@/utils';

/**
 * Stat tile — a compact metric block (label + value).
 *
 * Used on the home screen and profile for collection statistics. The value
 * uses the display font for a premium, data-dense feel.
 */
export interface StatTileProps {
  label: string;
  value: string | number;
  /** Optional accent color for the value (e.g. gold for rare counts). */
  accent?: 'primary' | 'gold' | 'default';
  icon?: React.ReactNode;
  className?: string;
}

const accentClasses = {
  primary: 'text-primary-soft',
  gold: 'text-gradient-gold',
  default: 'text-ink',
};

export function StatTile({ label, value, accent = 'default', icon, className }: StatTileProps) {
  return (
    <div
      className={cx(
        'flex flex-col gap-1 rounded-xl border border-line-soft bg-surface-2 p-4',
        className
      )}
    >
      <div className="flex items-center gap-2 text-ink-muted">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className={cx('font-display text-2xl font-bold tabular-nums', accentClasses[accent])}>
        {value}
      </span>
    </div>
  );
}
