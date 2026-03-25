import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "../env";

/**
 * Refreshes the Supabase session and protects routes.
 * Called from the Next.js middleware on every matched request.
 *
 * Pattern: Supabase SSR docs for Next.js App Router middleware.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: Do NOT use getSession() here.
  // getUser() validates with the Supabase Auth server.
  // getSession() only reads the local JWT which could be tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow public auth routes without authentication
  const publicPaths = ["/sign-in", "/sign-up", "/auth/callback"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // If user is authenticated and visits an auth page, redirect to dashboard
  if (user && isPublicPath && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/businesses";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
