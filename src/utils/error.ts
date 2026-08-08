import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Base application error. Every domain error extends this so callers can catch
 * a single type and inspect `code`/`context` without sniffing message strings.
 */
export class AppError extends Error {
  /** Machine-readable code — use for branching, never for user display. */
  readonly code: string;
  /** Optional structured context for logging/analytics. */
  readonly context?: Record<string, unknown>;
  /** Whether the error is safe to show to the end user verbatim. */
  readonly isUserFacing: boolean;

  constructor(
    message: string,
    options: {
      code?: string;
      context?: Record<string, unknown>;
      isUserFacing?: boolean;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code ?? 'APP_ERROR';
    this.context = options.context;
    this.isUserFacing = options.isUserFacing ?? false;
  }
}

/** A request to the backend failed (network, RLS, or server error). */
export class ApiError extends AppError {
  readonly status?: number;

  constructor(
    message: string,
    options: { status?: number; code?: string; context?: Record<string, unknown>; cause?: unknown } = {}
  ) {
    super(message, {
      code: options.code ?? 'API_ERROR',
      context: options.context,
      isUserFacing: true,
      cause: options.cause,
    });
    this.status = options.status;
  }
}

/** Convert a raw Supabase PostgrestError into a typed ApiError. */
export function fromPostgrestError(error: PostgrestError, operation: string): ApiError {
  return new ApiError(error.message || `${operation} failed`, {
    status: Number(error.code) || undefined,
    code: error.code || 'POSTGREST_ERROR',
    context: { operation, hint: error.hint, details: error.details },
    cause: error,
  });
}

/** Narrow an unknown catch value into an Error (or AppError) for display. */
export function toAppError(value: unknown): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) {
    return new AppError(value.message, { code: 'UNEXPECTED', cause: value });
  }
  return new AppError('Something went wrong', { code: 'UNEXPECTED', cause: value });
}
