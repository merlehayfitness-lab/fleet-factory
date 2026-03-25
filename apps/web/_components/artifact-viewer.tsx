"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface ArtifactViewerProps {
  title: string;
  content: string;
  filename: string;
}

/**
 * Code block viewer for generated deployment artifacts.
 * Displays content in a monospace pre block with a download button.
 */
export function ArtifactViewer({ title, content, filename }: ArtifactViewerProps) {
  function handleDownload() {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription className="text-xs">{filename}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1.5 size-3.5" />
          Download
        </Button>
      </CardHeader>
      <CardContent>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">
          {content}
        </pre>
      </CardContent>
    </Card>
  );
}
