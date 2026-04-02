"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptDiffViewer } from "@/_components/prompt-diff-viewer";
import { refinePromptAction } from "@/_actions/prompt-generator-actions";
import type { PromptSections } from "@fleet-factory/core";

interface RefinementMessage {
  role: "user" | "assistant";
  content: string;
}

interface PromptRefinementPanelProps {
  initialSections: PromptSections;
  onAccept: (updated: PromptSections) => void;
  onClose: () => void;
}

const SECTION_LABELS: Record<keyof PromptSections, string> = {
  identity: "Identity",
  instructions: "Instructions",
  tools: "Tools",
  constraints: "Constraints",
};

/**
 * Side-by-side refinement panel with chat and live preview.
 *
 * Left: chat-style refinement input with message history.
 * Right: live prompt preview with 4 collapsible sections and diff highlighting.
 */
export function PromptRefinementPanel({
  initialSections,
  onAccept,
  onClose,
}: PromptRefinementPanelProps) {
  const [sections, setSections] = useState<PromptSections>(initialSections);
  const [pendingSections, setPendingSections] = useState<PromptSections | null>(
    null,
  );
  const [previousSections, setPreviousSections] =
    useState<PromptSections>(initialSections);
  const [messages, setMessages] = useState<RefinementMessage[]>([]);
  const [input, setInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isRefining) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsRefining(true);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await refinePromptAction(
        sections,
        userMessage,
        conversationHistory,
      );

      if (result.error) {
        toast.error(result.error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${result.error}` },
        ]);
        return;
      }

      if (result.data) {
        setPreviousSections(sections);
        setPendingSections(result.data.updatedSections);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.data!.changeDescription },
        ]);
      }
    } catch {
      toast.error("Failed to refine prompt");
    } finally {
      setIsRefining(false);
    }
  }

  function handleAcceptDiff() {
    if (pendingSections) {
      setSections(pendingSections);
      setPendingSections(null);
    }
  }

  function handleRejectDiff() {
    setPendingSections(null);
  }

  function handleAcceptAll() {
    onAccept(sections);
  }

  const displaySections = pendingSections ?? sections;

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Prompt Refinement</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleAcceptAll}>
            Accept & Close
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Chat panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Refinement Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="h-64">
              <div className="space-y-2 pr-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Describe what you&apos;d like to change about the prompt...
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-sm ${
                      msg.role === "user"
                        ? "ml-4 bg-primary/10"
                        : "mr-4 bg-muted"
                    }`}
                  >
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">
                      {msg.role === "user" ? "You" : "Claude"}
                    </span>
                    {msg.content}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., Make the tone more casual..."
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={isRefining}
              />
              <Button
                onClick={handleSend}
                disabled={isRefining || !input.trim()}
                size="sm"
              >
                {isRefining ? "..." : "Send"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Live preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prompt Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="h-64">
              <div className="space-y-3 pr-4">
                {(
                  Object.keys(SECTION_LABELS) as Array<keyof PromptSections>
                ).map((key) => (
                  <div key={key}>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      {SECTION_LABELS[key]}
                    </p>
                    {pendingSections &&
                    pendingSections[key] !== previousSections[key] ? (
                      <PromptDiffViewer
                        oldText={previousSections[key]}
                        newText={pendingSections[key]}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-xs">
                        {displaySections[key]}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Accept/Reject diff buttons */}
            {pendingSections && (
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" onClick={handleAcceptDiff}>
                  Accept Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectDiff}
                >
                  Reject Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
