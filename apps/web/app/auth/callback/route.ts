import { createServerClient } from "@/_lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /auth/callback
 *
 * Handles OAuth and email confirmation callbacks.
 * Exchanges the authorization code for a session, then redirects.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/businesses`);
    }
  }

  // If no code or exchange failed, redirect to sign-in
  return NextResponse.redirect(`${origin}/sign-in`);
}
