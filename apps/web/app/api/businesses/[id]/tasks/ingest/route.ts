import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/_lib/env";

/**
 * Webhook ingestion endpoint for external task creation.
 * POST /api/businesses/[id]/tasks/ingest
 *
 * External systems send events here to create tasks for a business.
 * Authentication: Bearer token matching a secret with category='api_key'
 * and key='webhook_key' stored in the business's secrets table.
 *
 * SECURITY NOTE (SECR-05): This endpoint uses a Supabase service_role client
 * because webhooks come from external systems without user auth sessions.
 * The webhook verifies a shared secret stored in the business's secrets table.
 * This is the one exception to the normal user-auth pattern.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params;

  // 1. Validate Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 },
    );
  }

  const providedKey = authHeader.slice(7); // Remove "Bearer " prefix

  // 2. Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json(
      { error: "Missing required field: title" },
      { status: 400 },
    );
  }

  // 3. Create service_role client for webhook auth (see SECR-05 note above)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const supabase = createClient(getSupabaseUrl(), serviceRoleKey);

  // 4. Verify the webhook key matches the business secret
  const { data: secret, error: secretError } = await supabase
    .from("secrets")
    .select("encrypted_value")
    .eq("business_id", businessId)
    .eq("key", "webhook_key")
    .eq("category", "api_key")
    .single();

  if (secretError || !secret) {
    return NextResponse.json(
      { error: "Unauthorized: no webhook key configured for this business" },
      { status: 401 },
    );
  }

  // For MVP: compare the provided key directly against the encrypted_value.
  // In production, this would decrypt and compare. For now we store the key
  // as the encrypted_value (set via the secrets service which encrypts).
  // Since we can't decrypt here without importing node:crypto into an edge route,
  // we do a simple comparison against the stored value.
  // TODO: Use proper decryption when webhook auth is hardened post-MVP.
  if (secret.encrypted_value !== providedKey) {
    return NextResponse.json(
      { error: "Unauthorized: invalid webhook key" },
      { status: 401 },
    );
  }

  // 5. Validate optional fields
  const title = body.title as string;
  const description = (body.description as string) ?? undefined;
  const departmentId = body.department_id as string | undefined;
  const priority = (body.priority as string) ?? "medium";
  const payload = (body.payload as Record<string, unknown>) ?? {};

  if (priority && !["low", "medium", "high"].includes(priority)) {
    return NextResponse.json(
      { error: "Invalid priority. Must be: low, medium, high" },
      { status: 400 },
    );
  }

  // 6. If no department_id provided, find a default department
  let resolvedDepartmentId = departmentId;
  if (!resolvedDepartmentId) {
    const { data: defaultDept } = await supabase
      .from("departments")
      .select("id")
      .eq("business_id", businessId)
      .eq("type", "operations")
      .limit(1)
      .single();

    if (!defaultDept) {
      return NextResponse.json(
        { error: "No department_id provided and no default department found" },
        { status: 400 },
      );
    }
    resolvedDepartmentId = defaultDept.id;
  }

  try {
    // 7. Create the task with source='webhook'
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        business_id: businessId,
        department_id: resolvedDepartmentId,
        title,
        description: description ?? null,
        payload,
        priority: priority as string,
        status: "queued",
        source: "webhook",
      })
      .select("id, status")
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: `Failed to create task: ${taskError?.message ?? "Unknown error"}` },
        { status: 500 },
      );
    }

    // 8. Audit log (best-effort)
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      action: "task.created",
      entity_type: "task",
      entity_id: task.id,
      metadata: {
        title,
        source: "webhook",
        priority,
        department_id: resolvedDepartmentId,
      },
    });

    // 9. Return success
    return NextResponse.json(
      { task_id: task.id, status: task.status },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
