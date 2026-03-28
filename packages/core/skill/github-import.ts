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
 * - https://github.com/{owner}/{repo} (repo root — treated as directory at root of default branch)
 *
 * Returns null for invalid or unrecognized URLs.
 */
export function parseGitHubUrl(url: string): GitHubUrlInfo | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;

    // Remove leading/trailing slashes and split
    const parts = parsed.pathname.replace(/^\/|\/$/g, "").split("/");

    if (parts.length < 2 || !parts[0] || !parts[1]) return null;

    const [owner, repo, typeSegment, branch, ...pathParts] = parts;

    // Repo root URL: github.com/{owner}/{repo}
    if (parts.length === 2) {
      return {
        owner,
        repo,
        path: "",
        branch: "main",
        type: "directory",
      };
    }

    if (!branch) return null;

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

// ---------------------------------------------------------------------------
// Git Trees API (recursive directory scanning)
// ---------------------------------------------------------------------------

/** Git Trees API response item. */
interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

/** Git Trees API response. */
interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/**
 * Fetch the full repository tree using the Git Trees API with ?recursive=1.
 * Falls back to "master" branch if the primary branch returns 404.
 */
async function fetchTreeApi(
  info: GitHubUrlInfo,
): Promise<{ items: GitHubTreeItem[]; branch: string }> {
  const branches = [info.branch, ...(info.branch !== "master" ? ["master"] : [])];

  for (const branch of branches) {
    const apiUrl = `https://api.github.com/repos/${info.owner}/${info.repo}/git/trees/${branch}?recursive=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (response.status === 404 && branch !== branches[branches.length - 1]) {
        continue;
      }

      if (!response.ok) {
        if (response.status === 403) {
          const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
          if (rateLimitRemaining === "0") {
            throw new Error("GitHub API rate limit exceeded. Try again later.");
          }
        }
        throw new Error(`Failed to fetch repository tree: HTTP ${response.status}`);
      }

      const data = (await response.json()) as GitHubTreeResponse;
      return { items: data.tree, branch };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Failed to fetch repository tree: HTTP 404");
}

/**
 * Fetch all .md files from a public GitHub directory, recursing into subdirectories.
 * Uses the Git Trees API with ?recursive=1 to discover .md files at all levels.
 */
export async function fetchGitHubDirectory(
  info: GitHubUrlInfo,
): Promise<GitHubImportResult[]> {
  const { items, branch } = await fetchTreeApi(info);

  // Filter to .md blob files within the target path
  const pathPrefix = info.path ? info.path + "/" : "";
  const mdFiles = items.filter(
    (item) =>
      item.type === "blob" &&
      item.path.toLowerCase().endsWith(".md") &&
      (pathPrefix === "" || item.path.startsWith(pathPrefix)),
  );

  if (mdFiles.length === 0) {
    return [];
  }

  // Fetch each .md file's raw content
  const results = await Promise.all(
    mdFiles.map((file) =>
      fetchGitHubFile({
        owner: info.owner,
        repo: info.repo,
        path: file.path,
        branch,
        type: "file",
      }),
    ),
  );

  return results;
}
