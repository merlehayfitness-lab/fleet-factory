/**
 * WhatsApp API client.
 *
 * Supports Twilio and Meta (WhatsApp Business API) providers.
 * Sends messages, verifies webhooks, and handles provider-specific logic.
 */

import type {
  WhatsAppConfig,
  TwilioConfig,
  MetaConfig,
  OutboundMessage,
  InboundMessage,
} from "./whatsapp-types";

// ---------------------------------------------------------------------------
// Send message
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp message via the configured provider.
 */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  message: OutboundMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  switch (config.provider) {
    case "twilio":
      return sendViaTwilio(config.providerConfig as TwilioConfig, message);
    case "meta":
      return sendViaMeta(config.providerConfig as MetaConfig, message);
    default:
      return { success: false, error: `Unknown provider: ${config.provider}` };
  }
}

// ---------------------------------------------------------------------------
// Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(
  config: TwilioConfig,
  message: OutboundMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;

  const body = new URLSearchParams({
    To: `whatsapp:${message.to}`,
    From: `whatsapp:${config.fromNumber}`,
    Body: message.body,
  });

  if (message.mediaUrl) {
    body.append("MediaUrl", message.mediaUrl);
  }

  try {
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, error: `Twilio error: ${errBody}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.sid };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Twilio send failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Meta (WhatsApp Business API)
// ---------------------------------------------------------------------------

async function sendViaMeta(
  config: MetaConfig,
  message: OutboundMessage,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: message.to,
    type: "text",
    text: { body: message.body },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, error: `Meta API error: ${errBody}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Meta send failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Webhook verification
// ---------------------------------------------------------------------------

/**
 * Verify Twilio webhook signature.
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  // Build the string to sign
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  try {
    const crypto = require("node:crypto");
    const hmac = crypto.createHmac("sha1", authToken);
    hmac.update(data);
    const expected = hmac.digest("base64");
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Verify Meta webhook verification request.
 */
export function verifyMetaWebhook(
  verifyToken: string,
  mode: string,
  token: string,
  challenge: string,
): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse inbound messages
// ---------------------------------------------------------------------------

/**
 * Parse a Twilio inbound webhook into an InboundMessage.
 */
export function parseTwilioInbound(body: Record<string, string>): InboundMessage {
  return {
    from: (body.From ?? "").replace("whatsapp:", ""),
    body: body.Body ?? "",
    messageId: body.MessageSid ?? "",
    timestamp: new Date().toISOString(),
    mediaUrl: body.MediaUrl0,
  };
}

/**
 * Parse a Meta inbound webhook into InboundMessage(s).
 */
export function parseMetaInbound(payload: Record<string, unknown>): InboundMessage[] {
  const messages: InboundMessage[] = [];
  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
    for (const change of changes) {
      const value = change.value as Record<string, unknown>;
      const msgs = (value?.messages as Array<Record<string, unknown>>) ?? [];
      for (const msg of msgs) {
        const text = msg.text as Record<string, string> | undefined;
        messages.push({
          from: msg.from as string,
          body: text?.body ?? "",
          messageId: msg.id as string,
          timestamp: msg.timestamp as string,
        });
      }
    }
  }

  return messages;
}
