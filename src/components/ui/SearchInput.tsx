import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Search, X } from 'lucide-react';

import { cx } from '@/utils';
import { useI18n } from '@/i18n';

/**
 * SearchInput — the shared search field.
 *
 * Controlled-by-default with an optional debounce so filter queries don't fire
 * on every keystroke. Rounded, dark, with a clear button. Accessible (label,
 * aria-label, keyboard clear). Used by collection, explorer, and wishlist.
 */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Debounce onChange by this many ms (default 200). */
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  debounceMs = 200,
  className,
}: SearchInputProps) {
  const { t } = useI18n();
  const [internal, setInternal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep internal field in sync when the parent resets the value.
  useEffect(() => {
    setInternal(value);
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInternal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), debounceMs);
  };

  const clear = () => {
    setInternal('');
    onChange('');
  };

  return (
    <div className={cx('relative', className)}>
      <Search
        size={18}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        strokeWidth={2}
      />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder ?? t.common.search}
        aria-label={ariaLabel ?? t.common.search}
        className={cx(
          'h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-9 text-sm text-ink placeholder:text-ink-muted',
          'transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-premium)]',
          'focus:border-primary-soft focus:outline-none focus:ring-2 focus:ring-primary-glow'
        )}
      />
      {internal && (
        <button
          type="button"
          onClick={clear}
          aria-label={t.common.clearSearch}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
