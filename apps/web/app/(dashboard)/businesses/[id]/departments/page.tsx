import { createServerClient } from "@/_lib/supabase/server";
import { DepartmentsList } from "@/_components/departments-list";
import { DepartmentSkillsPanel } from "@/_components/department-skills-panel";

export const metadata = {
  title: "Departments | Agency Factory",
};

/**
 * Departments list page for a specific business.
 *
 * Server Component that fetches departments via RLS-scoped query.
 * The .eq('business_id', id) fetches data within the user's allowed scope --
 * RLS handles the security boundary.
 */
export default async function DepartmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: departments, error } = await supabase
    .from("departments")
    .select("*")
    .eq("business_id", id)
    .order("created_at");

  if (error) {
    throw new Error(`Failed to load departments: ${error.message}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
        <p className="text-sm text-muted-foreground">
          Departments and their agent teams for this business.
        </p>
      </div>

      {!departments || departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h2 className="text-lg font-semibold">No departments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Departments are created automatically during business provisioning.
          </p>
        </div>
      ) : (
        <>
          <DepartmentsList departments={departments} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {departments.map((dept) => (
              <DepartmentSkillsPanel
                key={dept.id}
                businessId={id}
                departmentId={dept.id}
                departmentName={dept.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
