import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";

/**
 * Business overview — minimal debug version.
 * Stripped to isolate the 500 error source.
 */
export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let debugInfo = "Starting...\n";

  try {
    debugInfo += "1. Creating supabase client\n";
    const supabase = await createServerClient();

    debugInfo += "2. Fetching business\n";
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id, name, status, slug")
      .eq("id", id)
      .single();

    if (error || !business) {
      debugInfo += `3. Business not found: ${error?.message ?? "null"}\n`;
      notFound();
    }

    debugInfo += `3. Business loaded: ${business.name}\n`;

    return (
      <div style={{ padding: "2rem", fontFamily: "monospace" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          Business: {business.name}
        </h1>
        <p>Status: {business.status}</p>
        <p>Slug: {business.slug}</p>
        <p>ID: {business.id}</p>
        <hr style={{ margin: "1rem 0" }} />
        <h2>Debug Log:</h2>
        <pre style={{ background: "#f0f0f0", padding: "1rem", borderRadius: "0.5rem" }}>
          {debugInfo}
        </pre>
        <p style={{ color: "green", marginTop: "1rem" }}>
          If you can see this, the page works. The 500 was in the HealthDashboard component.
        </p>
      </div>
    );
  } catch (e) {
    // Re-throw Next.js navigation errors
    const digest = (e as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_")) throw e;

    debugInfo += `CRASH: ${(e as Error).message}\n`;
    debugInfo += `Stack: ${(e as Error).stack}\n`;

    return (
      <div style={{ padding: "2rem", fontFamily: "monospace", color: "red" }}>
        <h1>Page Crashed</h1>
        <pre>{debugInfo}</pre>
      </div>
    );
  }
}
