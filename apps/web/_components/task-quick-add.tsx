"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quickAddTaskAction } from "@/_actions/task-actions";

const quickAddSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  department_id: z.string().uuid("Select a department"),
  priority: z.enum(["low", "medium", "high"]),
});

type QuickAddInput = z.infer<typeof quickAddSchema>;

interface Department {
  id: string;
  name: string;
}

interface TaskQuickAddProps {
  departments: Department[];
  businessId: string;
}

/**
 * Lightweight inline task creation form.
 * Single row: title input, department select, priority select, Add button.
 */
export function TaskQuickAdd({ departments, businessId }: TaskQuickAddProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<QuickAddInput>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      title: "",
      department_id: departments[0]?.id ?? "",
      priority: "medium",
    },
  });

  const selectedDepartment = watch("department_id");
  const selectedPriority = watch("priority");

  async function onSubmit(data: QuickAddInput) {
    const result = await quickAddTaskAction(
      businessId,
      data.title,
      data.department_id,
      data.priority,
    );

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Task created");
      reset();
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"
    >
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="Quick add task..."
          {...register("title")}
          className={errors.title ? "border-destructive" : ""}
        />
      </div>

      <Select
        value={selectedDepartment}
        onValueChange={(val) => {
          if (val) setValue("department_id", val);
        }}
      >
        <SelectTrigger className="w-[140px]">
          <span className="flex flex-1 text-left truncate">
            {departments.find((d) => d.id === selectedDepartment)?.name ?? "Department"}
          </span>
        </SelectTrigger>
        <SelectContent>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedPriority}
        onValueChange={(val) => {
          if (val) setValue("priority", val as "low" | "medium" | "high");
        }}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Plus className="mr-1.5 size-3.5" />
        )}
        Add
      </Button>
    </form>
  );
}
