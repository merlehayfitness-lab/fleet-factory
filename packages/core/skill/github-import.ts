/**
 * GitHub URL parsing and public repository content fetching.
 *
 * Supports:
 * - Single file import from blob URLs
 * - Directory import (all .md files) from tree URLs
 * - Public repos only (no auth token for MVP)
 */

import type { GitHubUrlInfo, GitHubImportResult } from "./skill-types";

const FETCH_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub URL into structured info.
 *
 * Supported formats:
 * - https://github.com/{owner}/{repo}/blob/{branch}/{path} (file)
 * - https://github.com/{owner}/{repo}/tree/{branch}/{path} (directory)
 *
 * Returns null for invalid or unrecognized URLs.
 */
export function parseGitHubUrl(url: string): GitHubUrlInfo | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;

    // Remove leading slash and split
    const parts = parsed.pathname.replace(/^\//, "").split("/");

    // Minimum: owner/repo/blob-or-tree/branch/path
    if (parts.length < 5) return null;

    const [owner, repo, typeSegment, branch, ...pathParts] = parts;

    if (!owner || !repo || !branch) return null;

    if (typeSegment === "blob") {
      return {
        owner,
        repo,
        path: pathParts.join("/"),
        branch,
        type: "file",
      };
    }

    if (typeSegment === "tree") {
      return {
        owner,
        repo,
        path: pathParts.join("/"),
        branch,
        type: "directory",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch raw file content from a public GitHub repository.
 * Uses raw.githubusercontent.com for direct content access.
 */
export async function fetchGitHubFile(
  info: GitHubUrlInfo,
): Promise<GitHubImportResult> {
  const rawUrl = `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${info.branch}/${info.path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rawUrl, { signal: controller.signal });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
        if (rateLimitRemaining === "0") {
          throw new Error("GitHub API rate limit exceeded. Try again later.");
        }
      }
      throw new Error(`Failed to fetch file: HTTP ${response.status}`);
    }

    const content = await response.text();

    // Extract name from filename (strip .md extension)
    const filename = info.path.split("/").pop() ?? "untitled";
    const name = filename.replace(/\.md$/i, "");

    const sourceUrl = `https://github.com/${info.owner}/${info.repo}/blob/${info.branch}/${info.path}`;

    return { name, content, source_url: sourceUrl };
  } finally {
    clearTimeout(timeout);
  }
}

/** GitHub API contents response item. */
interface GitHubContentsItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  download_url: string | null;
}

/**
 * Fetch all .md files from a public GitHub directory.
 * Uses the GitHub API to list contents, then fetches each .md file.
 */
export async function fetchGitHubDirectory(
  info: GitHubUrlInfo,
): Promise<GitHubImportResult[]> {
  const apiUrl = `https://api.github.com/repos/${info.owner}/${info.repo}/contents/${info.path}?ref=${info.branch}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let items: GitHubContentsItem[];

  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!response.ok) {
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
        if (rateLimitRemaining === "0") {
          throw new Error("GitHub API rate limit exceeded. Try again later.");
        }
      }
      throw new Error(`Failed to list directory: HTTP ${response.status}`);
    }

    items = (await response.json()) as GitHubContentsItem[];
  } finally {
    clearTimeout(timeout);
  }

  // Filter to .md files only
  const mdFiles = items.filter(
    (item) => item.type === "file" && item.name.toLowerCase().endsWith(".md"),
  );

  if (mdFiles.length === 0) {
    return [];
  }

  // Fetch each .md file
  const results = await Promise.all(
    mdFiles.map((file) =>
      fetchGitHubFile({
        owner: info.owner,
        repo: info.repo,
        path: file.path,
        branch: info.branch,
        type: "file",
      }),
    ),
  );

  return results;
}
