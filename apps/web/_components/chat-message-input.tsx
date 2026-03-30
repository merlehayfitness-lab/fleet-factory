"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatMessageInputProps {
  onSendMessage: (
    content: string,
    fileMetadata?: { name: string; size: number; type: string },
  ) => void;
  disabled: boolean;
  disabledReason?: string;
  isSending: boolean;
  channelName?: string;
}

/**
 * Message input area with textarea, file upload, and send button.
 *
 * Features:
 * - Auto-resize textarea
 * - Shift+Enter for newline, Enter to send
 * - File upload via paperclip button (stores metadata only for MVP)
 * - Disabled state for frozen agents with explanation text
 * - Send button shows spinner when sending
 * - Slack channel name in placeholder when connected
 */
export function ChatMessageInput({
  onSendMessage,
  disabled,
  disabledReason,
  isSending,
  channelName,
}: ChatMessageInputProps) {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSending) return;

    const fileMetadata = selectedFile
      ? {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
        }
      : undefined;

    onSendMessage(trimmed, fileMetadata);
    setContent("");
    setSelectedFile(null);
  }, [content, disabled, isSending, onSendMessage, selectedFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [],
  );

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div className="border-t bg-background p-3">
      {/* Frozen agent banner */}
      {disabled && disabledReason && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 mb-2 text-xs text-destructive">
          <Lock className="size-3.5 shrink-0" />
          {disabledReason}
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 mb-2 text-xs text-muted-foreground">
          <Paperclip className="size-3 shrink-0" />
          <span className="truncate flex-1">{selectedFile.name}</span>
          <span className="shrink-0">
            {(selectedFile.size / 1024).toFixed(1)}KB
          </span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="shrink-0 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* File upload button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 size-9 p-0"
        >
          <Paperclip className="size-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Textarea */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? disabledReason ?? "Chat is unavailable"
              : channelName
                ? `Message #${channelName}`
                : "Type a message... (Shift+Enter for newline)"
          }
          disabled={disabled}
          className={cn(
            "min-h-10 max-h-32 resize-none text-sm",
            disabled && "opacity-60",
          )}
          rows={1}
        />

        {/* Send button */}
        <Button
          type="button"
          size="sm"
          disabled={disabled || isSending || !content.trim()}
          onClick={handleSend}
          className="shrink-0 size-9 p-0"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
