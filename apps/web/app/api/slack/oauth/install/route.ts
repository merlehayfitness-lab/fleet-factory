import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/_lib/supabase/server";
import { getSlackInstallUrl } from "@fleet-factory/core/server";

/**
 * GET handler to initiate Slack OAuth install flow.
 * Validates that the user is authenticated and is a member of the business,
 * then redirects to the Slack authorize URL.
 */
export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json(
      { error: "Missing businessId parameter" },
      { status: 400 },
    );
  }

  // Validate user is authenticated
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Validate user is a member of the business
  const { data: membership } = await supabase
    .from("business_users")
    .select("id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this business" },
      { status: 403 },
    );
  }

  // Generate install URL and redirect (pass supabase for DB credential lookup)
  const installUrl = await getSlackInstallUrl(businessId, supabase);
  return NextResponse.redirect(installUrl);
}
