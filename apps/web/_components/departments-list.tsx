import {
  Crown,
  TrendingUp,
  Headphones,
  Settings,
  Boxes,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Department {
  id: string;
  name: string;
  type: string;
  description: string | null;
  created_at: string;
}

/** Maps department type to an icon component */
const DEPARTMENT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  owner: Crown,
  sales: TrendingUp,
  support: Headphones,
  operations: Settings,
  custom: Boxes,
};

/**
 * Renders a responsive grid of department cards.
 *
 * Each card shows the department name, type icon, and description.
 * No edit/delete for MVP -- departments are seeded by the provisioning system.
 */
export function DepartmentsList({
  departments,
}: {
  departments: Department[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {departments.map((dept) => {
        const Icon = DEPARTMENT_ICONS[dept.type] ?? Boxes;
        return (
          <Card key={dept.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-md bg-accent">
                  <Icon className="size-4 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle>{dept.name}</CardTitle>
                  <span className="text-xs capitalize text-muted-foreground">
                    {dept.type}
                  </span>
                </div>
              </div>
              {dept.description && (
                <CardDescription className="mt-2">
                  {dept.description}
                </CardDescription>
              )}
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
