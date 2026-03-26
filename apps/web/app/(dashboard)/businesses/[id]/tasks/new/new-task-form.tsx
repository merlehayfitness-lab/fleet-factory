"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createTaskSchema, type CreateTaskInput } from "@agency-factory/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTaskAction } from "@/_actions/task-actions";

interface NewTaskFormProps {
  businessId: string;
  departments: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
}

/**
 * Full task creation form with all fields.
 * Uses react-hook-form with Zod validation.
 */
export function NewTaskForm({
  businessId,
  departments,
  agents,
}: NewTaskFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      department_id: departments[0]?.id ?? "",
      priority: "medium",
    },
  });

  const selectedDepartment = watch("department_id");
  const selectedPriority = watch("priority");

  async function onSubmit(data: CreateTaskInput) {
    const result = await createTaskAction(businessId, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Task created");
    router.push(`/businesses/${businessId}/tasks`);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="What needs to be done?"
              {...register("title")}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details or context..."
              rows={4}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={selectedDepartment}
              onValueChange={(val) => {
                if (val) setValue("department_id", val);
              }}
            >
              <SelectTrigger>
                <span className="flex flex-1 text-left truncate">
                  {departments.find((d) => d.id === selectedDepartment)?.name ?? "Select department"}
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
            {errors.department_id && (
              <p className="text-xs text-destructive">
                {errors.department_id.message}
              </p>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={selectedPriority ?? "medium"}
              onValueChange={(val) => {
                if (val)
                  setValue("priority", val as "low" | "medium" | "high");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            )}
            Create Task
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
