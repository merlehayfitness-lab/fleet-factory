"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SkillDefinitionCardProps {
  skillDefinition: string | null;
  onSave: (updated: string) => void;
}

/**
 * SKILL.md display and edit card.
 *
 * Shows the generated skill definition in monospace format with
 * an edit toggle for inline editing.
 */
export function SkillDefinitionCard({
  skillDefinition,
  onSave,
}: SkillDefinitionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(skillDefinition ?? "");

  function handleEdit() {
    setEditValue(skillDefinition ?? "");
    setIsEditing(true);
  }

  function handleSave() {
    onSave(editValue);
    setIsEditing(false);
  }

  function handleCancel() {
    setEditValue(skillDefinition ?? "");
    setIsEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>SKILL.md</span>
          {!isEditing && skillDefinition && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              Edit
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-64 font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel} size="sm">
                Cancel
              </Button>
            </div>
          </div>
        ) : skillDefinition ? (
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">
            {skillDefinition}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            No SKILL.md generated yet. Use the Role Definition card above to
            generate one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
