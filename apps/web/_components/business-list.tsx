import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/_components/status-badge";

interface Business {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  status: string;
  created_at: string;
  business_users: { role: string }[];
}

/**
 * Renders a table of businesses with status badges.
 *
 * Each row links to the business overview page.
 * Clean, readable table per CLAUDE.md UI style.
 */
export function BusinessList({ businesses }: { businesses: Business[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((business) => (
            <TableRow key={business.id}>
              <TableCell>
                <Link
                  href={`/businesses/${business.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {business.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {business.industry ?? "--"}
              </TableCell>
              <TableCell>
                <StatusBadge status={business.status} />
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {business.business_users[0]?.role ?? "--"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(business.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
