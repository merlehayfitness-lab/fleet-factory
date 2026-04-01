import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/_lib/supabase/server";
import {
  parseTwilioInbound,
  parseMetaInbound,
  verifyTwilioSignature,
  verifyMetaWebhook,
  parseWhatsAppCommand,
  getWhatsAppHelpMessage,
  sendWhatsAppMessage,
} from "@agency-factory/core/server";

/**
 * WhatsApp webhook handler.
 * Supports both Twilio and Meta webhook formats.
 *
 * GET: Meta webhook verification
 * POST: Inbound message handling
 */

// Meta webhook verification
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode") ?? "";
  const token = request.nextUrl.searchParams.get("hub.verify_token") ?? "";
  const challenge = request.nextUrl.searchParams.get("hub.challenge") ?? "";

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const result = verifyMetaWebhook(verifyToken, mode, token, challenge);
  if (result) {
    return new NextResponse(result, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Inbound message handler
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const supabase = await createServerClient();

  try {
    // Detect provider from content type / headers
    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio webhook
      const formData = await request.formData();
      const body: Record<string, string> = {};
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });

      // Verify signature if configured
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const signature = request.headers.get("x-twilio-signature");
      if (authToken && signature) {
        const url = request.url;
        if (!verifyTwilioSignature(authToken, url, body, signature)) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
        }
      }

      const message = parseTwilioInbound(body);
      await handleInboundMessage(supabase, message.from, message.body);

      return new NextResponse("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Meta webhook
    const payload = await request.json();
    const messages = parseMetaInbound(payload);

    for (const message of messages) {
      await handleInboundMessage(supabase, message.from, message.body);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleInboundMessage(
  supabase: ReturnType<typeof createServerClient> extends Promise<infer T> ? T : never,
  from: string,
  body: string,
) {
  // Find business associated with this phone number
  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("phone_number", from)
    .eq("is_active", true)
    .single();

  if (!config) {
    // Unknown sender — could log or ignore
    return;
  }

  // Parse the command
  const command = parseWhatsAppCommand(body);

  let response: string;

  switch (command.intent) {
    case "status": {
      // Get business status
      const { data: business } = await supabase
        .from("businesses")
        .select("name, status")
        .eq("id", config.business_id)
        .single();

      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("business_id", config.business_id)
        .in("status", ["open", "in_progress"]);

      response = `${business?.name ?? "Business"}: ${business?.status ?? "unknown"}\nOpen tasks: ${taskCount ?? 0}`;
      break;
    }

    case "list_tasks": {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, priority, status")
        .eq("business_id", config.business_id)
        .in("status", ["open", "in_progress"])
        .limit(5);

      if (!tasks || tasks.length === 0) {
        response = "No open tasks.";
      } else {
        response = "Open tasks:\n" + tasks.map((t, i) =>
          `${i + 1}. [${t.priority}] ${t.title}`,
        ).join("\n");
      }
      break;
    }

    case "unknown":
    default:
      response = getWhatsAppHelpMessage();
      break;
  }

  // Send response back
  await sendWhatsAppMessage(
    {
      id: config.id,
      businessId: config.business_id,
      phoneNumber: config.phone_number,
      provider: config.provider,
      providerConfig: config.provider_config,
      notificationPreferences: config.notification_preferences,
      dailyDigestTime: config.daily_digest_time,
      isActive: config.is_active,
      verifiedAt: config.verified_at,
    },
    { to: from, body: response },
  );
}
