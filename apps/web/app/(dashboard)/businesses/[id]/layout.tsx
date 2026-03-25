import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";

/**
 * Business-specific layout.
 *
 * Validates that the current user has access to this business via RLS.
 * If the business doesn't exist or the user lacks access, returns 404.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", id)
    .single();

  if (error || !business) {
    notFound();
  }

  return <>{children}</>;
}
