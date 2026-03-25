"use server";

import { createServerClient } from "@/_lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Signs the user out and redirects to the sign-in page.
 * Must be in a separate 'use server' file for Server Action usage.
 */
export async function signOut() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
