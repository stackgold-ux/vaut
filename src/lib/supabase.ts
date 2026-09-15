/**
 * supabase.ts — Supabase client factory.
 *
 * Wires the client to the environment variables:
 *   SUPABASE_URL               (project URL)
 *   SUPABASE_PUBLISHABLE_KEY   (anon / publishable key)
 *
 * These are exposed to the browser via `define` in vite.config.ts. The service-role
 * key (SUPABASE_SECRET_KEY) is intentionally NOT exposed here — it is only read
 * server-side inside the edge function (`supabase/functions/vault-key/index.ts`).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client from the environment. Reading happens lazily inside the
 * function so that tests (which inject a mock) never touch `import.meta.env`.
 */
export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.'
    );
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Module-level singleton with injectable override for tests. Call `getSupabase()` to
 * obtain the shared client; call `setSupabaseForTesting()` to swap in a mock.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createSupabaseClient();
  }
  return client;
}

export function setSupabaseForTesting(mock: SupabaseClient): void {
  client = mock;
}

export function resetSupabaseForTesting(): void {
  client = null;
}
