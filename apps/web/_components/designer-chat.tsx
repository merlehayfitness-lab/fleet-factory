"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
  codeBlock?: string;
}

export function DesignerChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm the Designer Agent. Describe a UI component or page, and I'll generate Next.js + Tailwind + shadcn/ui code for you.\n\nExamples:\n- \"Create a pricing table with 3 tiers\"\n- \"Build a dashboard stat card with sparkline\"\n- \"Design a user settings page\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Stub response — will connect to Designer Agent on VPS in production
    setTimeout(() => {
      const response: Message = {
        role: "assistant",
        content: `Here's a component for "${input}":`,
        codeBlock: generateStubCode(input),
      };
      setMessages((prev) => [...prev, response]);
      setLoading(false);
    }, 1500);
  }

  return (
    <div className="flex flex-col" style={{ height: "60vh" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.codeBlock && (
                <pre className="mt-3 overflow-x-auto rounded bg-background p-3 text-xs font-mono">
                  <code>{msg.codeBlock}</code>
                </pre>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted p-3 text-sm animate-pulse">
              Generating...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe a component..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

function generateStubCode(prompt: string): string {
  const componentName = prompt
    .split(" ")
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")
    .replace(/[^a-zA-Z]/g, "");

  return `import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ${componentName || "GeneratedComponent"}() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>${prompt}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Generated component for: ${prompt}
        </p>
        <Button className="mt-4">
          Action
        </Button>
      </CardContent>
    </Card>
  );
}`;
}
