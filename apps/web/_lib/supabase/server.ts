import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "../env";

/**
 * Creates a Supabase client for Server Components and Server Actions.
 * Uses cookie-based session management via @supabase/ssr.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll is called from a Server Component where cookies cannot be set.
          // This is expected -- the middleware handles cookie refresh instead.
        }
      },
    },
  });
}
