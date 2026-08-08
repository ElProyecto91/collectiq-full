import { supabase } from '@/lib/supabase';
import { ApiError, fromPostgrestError } from '@/utils/error';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Shared base for Supabase-backed services.
 *
 * Each feature service (collection, wishlist, profile) extends this to get a
 * consistent error-handling boundary. `unwrap` turns a `{ data, error }`
 * Supabase response into either the data or a thrown ApiError — so callers
 * can use plain try/catch instead of repeating the error-branch boilerplate.
 *
 * The parameter is typed as `PromiseLike` (not `Promise`) because Supabase's
 * query builders are thenables but do not implement the full Promise interface.
 */
type SupabaseResult<T> = { data: T; error: PostgrestError | null };

export abstract class BaseSupabaseService {
  protected readonly client = supabase;

  protected unwrap<T>(thenable: PromiseLike<SupabaseResult<T>>, operation: string): Promise<T> {
    return Promise.resolve(thenable).then(({ data, error }) => {
      if (error) throw fromPostgrestError(error, operation);
      return data;
    });
  }

  protected unwrapMaybe<T>(
    thenable: PromiseLike<SupabaseResult<T | null>>,
    operation: string
  ): Promise<T | null> {
    return Promise.resolve(thenable).then(({ data, error }) => {
      if (error) throw fromPostgrestError(error, operation);
      return data ?? null;
    });
  }

  /** Convert any thrown value into a typed ApiError for UI boundaries. */
  protected toApiError(error: unknown, operation: string): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof Error) {
      return new ApiError(error.message, { code: 'SERVICE_ERROR', context: { operation }, cause: error });
    }
    return new ApiError('Unexpected service error', { code: 'SERVICE_ERROR', context: { operation }, cause: error });
  }
}
