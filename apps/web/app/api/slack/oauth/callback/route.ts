import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/_lib/supabase/server";
import {
  handleSlackOAuthCallback,
  createDepartmentChannels,
  getSlackClient,
} from "@agency-factory/core/server";

/**
 * GET handler for Slack OAuth redirect callback.
 * Exchanges the authorization code for a bot token,
 * stores credentials, creates department channels,
 * and redirects back to the integrations page.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state"); // businessId
  const error = request.nextUrl.searchParams.get("error");

  // Handle user denying the installation
  if (error) {
    const redirectUrl = state
      ? `/businesses/${state}/integrations?slack_error=${error}`
      : "/businesses";
    return NextResponse.redirect(new URL(redirectUrl, baseUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/businesses?slack_error=missing_params", baseUrl),
    );
  }

  const businessId = state;
  const supabase = await createServerClient();

  try {
    // Exchange code for token and create installation
    await handleSlackOAuthCallback(supabase, code, businessId);

    // Auto-create department channels after successful installation
    try {
      const client = await getSlackClient(supabase, businessId);
      if (client) {
        // Fetch business slug for channel naming
        const { data: business } = await supabase
          .from("businesses")
          .select("slug")
          .eq("id", businessId)
          .single();

        const slug = (business?.slug as string) ?? "biz";
        await createDepartmentChannels(client, supabase, businessId, slug);
      }
    } catch (channelErr) {
      // Channel creation failure is non-fatal -- installation succeeded
      console.error("Failed to auto-create Slack channels:", channelErr);
    }

    // Return self-closing page — parent window is polling for connection status
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Slack connected! You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err) {
    console.error("Slack OAuth callback failed:", err);
    return new NextResponse(
      `<html><body><script>window.close();</script><p>Connection failed. You can close this window and try again.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}
