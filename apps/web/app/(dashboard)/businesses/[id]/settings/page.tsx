import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { SettingsPage } from "@/_components/settings-page";
import { getSecretsByProvider } from "@agency-factory/core/server";

/**
 * Settings page (Server Component).
 *
 * Fetches business, grouped secrets by provider, and provider field definitions.
 * Renders the SettingsPage client component with Emergency Controls and Secrets sections.
 */
export default async function SettingsPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: businessId } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Verify business exists
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, slug, status")
    .eq("id", businessId)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch secrets grouped by provider
  const groupedSecrets = await getSecretsByProvider(supabase, businessId);

  // Fetch all provider field definitions grouped by provider
  const { data: fieldRows } = await supabase
    .from("provider_credential_fields")
    .select("*")
    .order("provider")
    .order("field_order");

  const providerFields: Record<
    string,
    Array<{
      id: string;
      provider: string;
      field_name: string;
      field_type: "password" | "text" | "url";
      display_label: string;
      placeholder: string | null;
      help_text: string | null;
      field_order: number;
    }>
  > = {};
  for (const field of fieldRows ?? []) {
    const provider = field.provider as string;
    if (!providerFields[provider]) {
      providerFields[provider] = [];
    }
    providerFields[provider].push({
      id: field.id as string,
      provider: field.provider as string,
      field_name: field.field_name as string,
      field_type: field.field_type as "password" | "text" | "url",
      display_label: field.display_label as string,
      placeholder: (field.placeholder as string) ?? null,
      help_text: (field.help_text as string) ?? null,
      field_order: field.field_order as number,
    });
  }

  return (
    <SettingsPage
      business={business}
      groupedSecrets={groupedSecrets}
      providerFields={providerFields}
    />
  );
}
