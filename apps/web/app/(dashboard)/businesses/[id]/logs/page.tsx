import { notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { LogsPageClient } from "@/_components/logs-page-client";

/**
 * Logs page for a business.
 * Server Component that fetches initial audit logs and conversations,
 * then passes data to the client-side tabbed viewer.
 */
export default async function LogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch business details
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (businessError || !business) {
    notFound();
  }

  // Fetch initial audit logs (first 50, no filters)
  const { data: auditLogsRaw } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const initialLogs = (auditLogsRaw ?? []).map(
    (row: {
      id: string;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      actor_id: string | null;
      metadata: Record<string, unknown>;
      created_at: string;
    }) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorId: row.actor_id,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }),
  );

  // Fetch conversations with department and agent info
  const { data: conversationsRaw } = await supabase
    .from("conversations")
    .select(`
      id,
      title,
      status,
      created_at,
      updated_at,
      department_id,
      departments(name),
      messages(id)
    `)
    .eq("business_id", id)
    .order("updated_at", { ascending: false });

  // Map conversations to client-friendly shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversations = (conversationsRaw ?? []).map((row: any) => {
    // Supabase joins return arrays for related tables
    const deptData = Array.isArray(row.departments)
      ? row.departments[0]
      : row.departments;
    return {
      id: row.id as string,
      title: row.title as string | null,
      status: row.status as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      departmentId: row.department_id as string,
      departmentName: (deptData?.name as string) ?? "Unknown",
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        {business.name} &mdash; Logs
      </h1>

      <LogsPageClient
        businessId={id}
        initialLogs={initialLogs}
        conversations={conversations}
      />
    </div>
  );
}
