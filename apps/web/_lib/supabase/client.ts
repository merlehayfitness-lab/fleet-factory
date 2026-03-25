import { createBrowserClient as createBrowserSupabaseClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for Client Components.
 * Uses NEXT_PUBLIC_ env vars which are available in the browser via Next.js.
 */
export function createBrowserClient() {
  return createBrowserSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
