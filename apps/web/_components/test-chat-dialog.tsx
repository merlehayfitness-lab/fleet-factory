"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { testChatAction } from "@/_actions/prompt-generator-actions";
import type { TestChatMessage } from "@agency-factory/core";

interface TestChatDialogProps {
  systemPrompt: string;
  modelProfile: Record<string, unknown>;
}

/**
 * Test chat dialog for validating draft system prompts.
 *
 * Opens an inline chat where the admin can have a back-and-forth
 * conversation with the agent using the current draft prompt.
 */
export function TestChatDialog({
  systemPrompt,
  modelProfile,
}: TestChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages: TestChatMessage[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsSending(true);

    try {
      const result = await testChatAction(
        systemPrompt,
        newMessages,
        modelProfile,
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.data! },
        ]);
      }
    } catch {
      toast.error("Failed to send test message");
    } finally {
      setIsSending(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setInput("");
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger>
        <span className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
          Test Prompt
        </span>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Test Chat</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs"
            >
              Clear Chat
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <ScrollArea className="h-80 rounded-lg border p-3">
            <div className="space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  Send a message to test the agent with the current prompt...
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-sm ${
                    msg.role === "user"
                      ? "ml-8 bg-primary/10"
                      : "mr-8 bg-muted"
                  }`}
                >
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    {msg.role === "user" ? "You" : "Agent"}
                  </span>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isSending && (
                <div className="mr-8 rounded-lg bg-muted p-3 text-sm">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Agent
                  </span>
                  <p className="animate-pulse text-muted-foreground">
                    Thinking...
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a test message..."
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={isSending}
            />
            <Button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
