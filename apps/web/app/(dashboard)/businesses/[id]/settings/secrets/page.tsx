import { redirect } from "next/navigation";

/**
 * Legacy secrets page redirect.
 *
 * Redirects to the new Settings page with the secrets section anchor
 * so old bookmarks and links still work.
 */
export default async function SecretsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: businessId } = await params;
  redirect(`/businesses/${businessId}/settings#secrets`);
}
