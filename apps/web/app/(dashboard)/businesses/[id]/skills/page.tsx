import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { SkillLibrary } from "@/_components/skill-library";
import type { Skill } from "@fleet-factory/core";

export const metadata = {
  title: "Skills | Fleet Factory",
};

/**
 * Standalone skill library page for a business.
 * Server Component that fetches all business skills and renders the library.
 */
export default async function SkillsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Verify business exists
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!business) {
    notFound();
  }

  // Fetch skills, agents, and departments in parallel
  const [skillsResult, agentsResult, departmentsResult] = await Promise.all([
    supabase
      .from("skills")
      .select("*")
      .eq("business_id", id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("agents")
      .select("id, name, departments(name)")
      .eq("business_id", id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("business_id", id)
      .order("name"),
  ]);

  const { data: skills, error } = skillsResult;

  if (error) {
    throw new Error(`Failed to load skills: ${error.message}`);
  }

  const agents = (agentsResult.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    department_name: (a.departments as unknown as { name: string } | null)?.name,
  }));

  const departments = (departmentsResult.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
        <p className="text-sm text-muted-foreground">
          Manage skills for {business.name}. Skills can be assigned to agents and departments.
        </p>
      </div>

      <SkillLibrary
        businessId={id}
        initialSkills={(skills ?? []) as unknown as Skill[]}
        agents={agents}
        departments={departments}
      />
    </div>
  );
}
