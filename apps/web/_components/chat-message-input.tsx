"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface FileMetadataItem {
  name: string;
  size: number;
  type: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5;

interface ChatMessageInputProps {
  onSendMessage: (
    content: string,
    files?: File[],
  ) => void;
  disabled: boolean;
  disabledReason?: string;
  isSending: boolean;
  channelName?: string;
}

/**
 * Message input area with textarea, multi-file upload, and send button.
 */
export function ChatMessageInput({
  onSendMessage,
  disabled,
  disabledReason,
  isSending,
  channelName,
}: ChatMessageInputProps) {
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSending) return;

    onSendMessage(trimmed, selectedFiles.length > 0 ? selectedFiles : undefined);
    setContent("");
    setSelectedFiles([]);
    setFileError(null);
  }, [content, disabled, isSending, onSendMessage, selectedFiles]);

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
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setFileError(null);
      const incoming = Array.from(files);

      // Check total file count
      const totalCount = selectedFiles.length + incoming.length;
      if (totalCount > MAX_FILES) {
        setFileError(`Maximum ${MAX_FILES} files allowed`);
        e.target.value = "";
        return;
      }

      // Check individual file sizes
      const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        const names = oversized.map((f) => f.name).join(", ");
        setFileError(`Files exceed 10MB limit: ${names}`);
        e.target.value = "";
        return;
      }

      setSelectedFiles((prev) => [...prev, ...incoming]);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [selectedFiles.length],
  );

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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

      {/* File validation error */}
      {fileError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 mb-2 text-xs text-destructive">
          {fileError}
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="ml-auto shrink-0 rounded-full p-0.5 hover:bg-destructive/20"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {/* File previews */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <Paperclip className="size-3 shrink-0" />
              <span className="truncate max-w-[180px]">{file.name}</span>
              <span className="shrink-0">
                {(file.size / 1024).toFixed(1)}KB
              </span>
              <button
                type="button"
                onClick={() => handleRemoveFile(i)}
                className="shrink-0 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
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
          multiple
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
