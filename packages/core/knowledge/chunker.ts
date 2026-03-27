import type { TextChunk } from "./knowledge-types";

interface ChunkOptions {
  /** Target chunk size in characters (~4 chars per token). Default: 2000 */
  chunkSize?: number;
  /** Overlap between chunks in characters. Default: 200 */
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 200;

/** Separators in priority order for recursive splitting */
const SEPARATORS = ["\n\n", "\n", ". ", " "];

/**
 * Estimate token count from character length (~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text on a separator, keeping the separator attached to the left segment.
 */
function splitOnSeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = i < parts.length - 1 ? parts[i] + separator : parts[i];
    if (part) {
      result.push(part);
    }
  }

  return result;
}

/**
 * Recursively split text into segments that are at most maxSize characters.
 * Tries separators in priority order.
 */
function recursiveSplit(
  text: string,
  maxSize: number,
  separatorIndex: number
): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  // If we've exhausted all separators, hard-split at maxSize
  if (separatorIndex >= SEPARATORS.length) {
    const result: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      result.push(text.slice(i, i + maxSize));
    }
    return result;
  }

  const separator = SEPARATORS[separatorIndex];
  const parts = splitOnSeparator(text, separator);

  // If splitting didn't help (single segment), try next separator
  if (parts.length <= 1) {
    return recursiveSplit(text, maxSize, separatorIndex + 1);
  }

  // Merge small segments together until they approach maxSize
  const merged: string[] = [];
  let current = "";

  for (const part of parts) {
    if (current.length + part.length <= maxSize) {
      current += part;
    } else {
      if (current) {
        merged.push(current);
      }
      // If this single part exceeds maxSize, recursively split it
      if (part.length > maxSize) {
        const subParts = recursiveSplit(part, maxSize, separatorIndex + 1);
        merged.push(...subParts);
      } else {
        current = part;
        continue;
      }
      current = "";
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * Split text into chunks using recursive character splitting.
 *
 * - Default chunk size: ~2000 characters (~512 tokens)
 * - Default overlap: ~200 characters (~50 tokens)
 * - Splits on paragraph breaks, line breaks, sentences, then spaces
 * - Each chunk includes overlap from the previous chunk's end
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  if (!text || !text.trim()) {
    return [];
  }

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  // If text is shorter than chunk size, return single chunk
  if (text.length <= chunkSize) {
    return [
      {
        content: text,
        index: 0,
        tokenCount: estimateTokens(text),
      },
    ];
  }

  // Recursively split into segments
  const segments = recursiveSplit(text, chunkSize, 0);

  // Add overlap between chunks
  const chunks: TextChunk[] = [];

  for (let i = 0; i < segments.length; i++) {
    let content = segments[i];

    // Add overlap from previous segment's end
    if (i > 0 && overlap > 0) {
      const prevSegment = segments[i - 1];
      const overlapText = prevSegment.slice(-overlap);
      content = overlapText + content;
    }

    chunks.push({
      content: content.trim(),
      index: i,
      tokenCount: estimateTokens(content),
    });
  }

  return chunks.filter((c) => c.content.length > 0);
}
