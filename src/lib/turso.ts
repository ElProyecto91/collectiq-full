import { createClient, type Client } from '@libsql/client/web';

import { AppConfig } from '@/config';

/**
 * Turso client for the LEGO catalog (read-only).
 *
 * VITE_TURSO_READ_TOKEN is bundled into the app, so it must be a read-only token
 * (`turso db tokens create <db> --read-only`). The write token is only used by
 * scripts/lego-import.mjs on your machine and never goes into a VITE_ variable.
 */
let client: Client | null = null;

export function getLegoDb(): Client {
  if (client) return client;

  const { url, readToken } = AppConfig.turso;
  if (!url || !readToken) {
    throw new Error(
      'Turso connection is not configured. ' +
        'Set VITE_TURSO_DATABASE_URL and VITE_TURSO_READ_TOKEN in the environment.'
    );
  }

  client = createClient({ url, authToken: readToken });
  return client;
}
