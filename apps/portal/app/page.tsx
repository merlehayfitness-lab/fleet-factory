import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";

/**
 * Portal root page.
 *
 * Checks auth and redirects to the dashboard if the user is signed in,
 * or to the sign-in page if they are not.
 *
 * The dashboard itself reads the business context from the session
 * (business_id stored in user metadata or a scoping claim).
 */
export default async function PortalRootPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  redirect("/dashboard");
}
