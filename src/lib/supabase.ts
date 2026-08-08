import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { AppConfig } from '@/config';

/**
 * Shared Supabase client singleton.
 *
 * The browser only ever needs one client — recreating it per request causes
 * auth-token refresh storms and socket leaks. Anything that talks to Supabase
 * imports from here instead of constructing its own client.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { url, anonKey } = AppConfig.supabase;
  if (!url || !anonKey) {
    // Fail loudly at startup rather than letting every query fail silently.
    throw new Error(
      'Supabase connection is not configured. ' +
        'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in the environment.'
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

/** Typed accessor — kept separate so callers can mock the client in tests. */
export const supabase = getSupabase();
