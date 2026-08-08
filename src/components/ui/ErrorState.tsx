import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from './Button';
import { toAppError } from '@/utils';
import { cx } from '@/utils';
import { useI18n } from '@/i18n';

/**
 * ErrorState — the shared error surface.
 *
 * Renders a consistent error block for failed queries/mutations. The message
 * is pulled from the typed AppError so user-facing errors show their message
 * and unexpected errors show a safe generic line. A retry button is offered
 * when an `onRetry` handler is provided.
 */
export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export function ErrorState({ error, onRetry, title, className }: ErrorStateProps) {
  const { t } = useI18n();
  const appError = toAppError(error);
  const message = appError.isUserFacing ? appError.message : t.common.safeErrorMsg;
  const heading = title ?? t.common.somethingWentWrong;

  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in',
        className
      )}
      role="alert"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
        <AlertTriangle size={28} strokeWidth={1.8} />
      </div>
      <h3 className="text-lg font-semibold text-ink">{heading}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" leftIcon={<RefreshCw size={15} />} onClick={onRetry} className="mt-6">
          {t.common.tryAgain}
        </Button>
      )}
    </div>
  );
}
