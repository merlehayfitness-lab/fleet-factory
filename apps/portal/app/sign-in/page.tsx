import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { SignInForm } from "./_sign-in-form";

/**
 * Portal sign-in page.
 *
 * If the user is already authenticated, redirect them directly to the dashboard.
 */
export default async function SignInPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Business Portal
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your business workspace
          </p>
        </div>
        <SignInForm />
      </div>
    </main>
  );
}
