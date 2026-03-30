"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlackConnectPromptProps {
  businessId: string;
}

/**
 * Secondary CTA shown on the chat page when Slack is not connected.
 * Directs users to the integrations page where the primary Connect Slack card lives.
 * This is NOT the OAuth entry point -- that lives on the integrations page per user decision.
 */
export function SlackConnectPrompt({ businessId }: SlackConnectPromptProps) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex flex-col items-center max-w-md text-center space-y-4">
        {/* Icon */}
        <div className="flex size-16 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-950/40">
          <MessageSquare className="size-8 text-purple-600 dark:text-purple-400" />
        </div>

        {/* Heading */}
        <h2 className="text-lg font-semibold">Connect Slack to get started</h2>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          Link your Slack workspace from the Integrations page to route messages
          between your department agents and Slack channels.
        </p>

        {/* Primary action */}
        <Button
          size="sm"
          onClick={() =>
            router.push(`/businesses/${businessId}/integrations`)
          }
          className="mt-2"
        >
          Go to Integrations
          <ArrowRight className="ml-1.5 size-3.5" />
        </Button>

        {/* Secondary text */}
        <p className="text-xs text-muted-foreground/70 pt-2">
          You can connect Slack from the Integrations page
        </p>
      </div>
    </div>
  );
}
