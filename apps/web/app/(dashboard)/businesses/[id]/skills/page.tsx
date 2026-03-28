import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { SkillLibrary } from "@/_components/skill-library";
import type { Skill } from "@agency-factory/core";

export const metadata = {
  title: "Skills | Agency Factory",
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

  // Fetch all non-deleted skills for this business
  const { data: skills, error } = await supabase
    .from("skills")
    .select("*")
    .eq("business_id", id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load skills: ${error.message}`);
  }

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
      />
    </div>
  );
}
