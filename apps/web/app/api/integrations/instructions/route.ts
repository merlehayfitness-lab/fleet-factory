import { createServerClient } from "@/_lib/supabase/server";
import { streamSetupInstructions } from "@fleet-factory/core/server";

/**
 * POST /api/integrations/instructions
 *
 * Streaming API route that bridges the core instructions service to the client.
 * Returns a ReadableStream of text chunks as Claude generates setup instructions.
 * After streaming completes, persists the full instructions to the integration record.
 */
export async function POST(request: Request) {
  // Auth check via Supabase session
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse request body
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const {
    integrationId,
    businessId,
    integrationName,
    integrationCategory,
    provider,
    targetName,
    targetType,
  } = body;

  if (!integrationName || !provider || !targetName || !targetType) {
    return new Response("Missing required fields", { status: 400 });
  }

  // Fetch business context for richer instructions
  let businessName: string | undefined;
  let businessIndustry: string | undefined;

  if (businessId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("name, industry")
      .eq("id", businessId)
      .single();

    businessName = business?.name ?? undefined;
    businessIndustry = business?.industry ?? undefined;
  }

  // Create a ReadableStream from the async generator
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamSetupInstructions({
          integrationName,
          integrationCategory,
          provider,
          targetName,
          targetType,
          businessName,
          businessIndustry,
        });

        for await (const chunk of generator) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        // After streaming completes, persist full instructions to DB
        if (integrationId && businessId && fullText.length > 0) {
          await supabase
            .from("integrations")
            .update({ setup_instructions: fullText })
            .eq("id", integrationId)
            .eq("business_id", businessId);
        }

        controller.close();
      } catch (err) {
        const fallback = "Setup instructions could not be generated.";
        controller.enqueue(encoder.encode(fallback));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
