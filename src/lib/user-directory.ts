import { getSupabase } from '@/lib/supabase';

/**
 * Where to read "who are the users" (names, profile data). `user_directory` is a view WITHOUT the session
 * tokens (created by the households migration); until it exists we fall back to `user_sessions`, which is
 * what the app always used. Probed once per page load.
 */
let table: Promise<'user_directory' | 'user_sessions'> | null = null;

export function userDirectoryTable(): Promise<'user_directory' | 'user_sessions'> {
  if (!table) {
    table = Promise.resolve(getSupabase().from('user_directory').select('telegram_user_id').limit(1))
      .then(({ error }) => (error ? 'user_sessions' : 'user_directory') as 'user_directory' | 'user_sessions')
      .catch(() => 'user_sessions' as const);
  }
  return table;
}
