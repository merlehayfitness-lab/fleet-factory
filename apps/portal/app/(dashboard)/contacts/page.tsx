import { redirect } from "next/navigation";
import { createServerClient } from "@/_lib/supabase/server";
import { Users } from "lucide-react";

/**
 * CRM Contacts page.
 *
 * Displays a table of contacts scoped to the business owner's workspace.
 *
 * TODO: replace the stub data with a real `contacts` table query once
 * the CRM schema is added to packages/db.
 */
export default async function ContactsPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // TODO: query contacts table when CRM schema lands
  // const { data: contacts } = await supabase
  //   .from("contacts")
  //   .select("id, name, email, phone, status, created_at")
  //   .eq("business_id", businessId)
  //   .order("created_at", { ascending: false });

  const contacts: StubContact[] = []; // Stub -- no contacts table yet

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Your CRM contact list
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-md bg-primary/50 px-4 py-2 text-sm font-medium text-primary-foreground"
          title="Coming soon"
        >
          Add contact
        </button>
      </div>

      {/* Contacts table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Email
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Phone
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Added
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="size-8 opacity-40" />
                    <p className="text-sm font-medium">No contacts yet</p>
                    <p className="text-xs">
                      Contact management will be available soon.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Types and sub-components
// --------------------------------------------------------------------------

type StubContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

function ContactRow({ contact }: { contact: StubContact }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium">{contact.name}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {contact.email ?? "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {contact.phone ?? "—"}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
          {contact.status}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(contact.created_at).toLocaleDateString()}
      </td>
    </tr>
  );
}
