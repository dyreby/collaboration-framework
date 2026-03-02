/**
 * Workspace tool for context-switching between repos.
 *
 * Opens a new tmux window in the target repo directory with status bar context,
 * then starts pi directly as the window's shell command for a clean handoff.
 * Use this to transition from discovery (cross-repo queries) to focused work.
 *
 * When a workspace for the same repo is already open, creates a git worktree
 * so each session gets its own directory and branch, with no cross-session
 * interference.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

/** Base path for repo checkouts */
const REPOS_BASE = join(homedir(), "repos");

/**
 * Find a repo's local path.
 * Looks in ~/repos/{owner}/{repo}
 */
function findRepoPath(owner: string, repo: string): string | null {
  const path = join(REPOS_BASE, owner, repo);
  return existsSync(path) ? path : null;
}

/**
 * Build tmux window name from repo and optional context.
 */
function buildWindowName(owner: string, repo: string, context?: string): string {
  const base = `${owner}/${repo}`;
  return context ? `${base} ${context}` : base;
}

/**
 * Sanitize a context string into a valid worktree identifier.
 * Strips '#', lowercases, replaces non-alphanumeric runs with '-',
 * and trims any leading/trailing dashes.
 */
function sanitizeIdentifier(context: string): string {
  return context
    .replace(/#/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Check whether any tmux window name begins with `{owner}/{repo}`.
 * Returns true when a parallel workspace for the same repo is already open.
 */
async function hasActiveWorkspace(
  pi: ExtensionAPI,
  owner: string,
  repo: string,
): Promise<boolean> {
  const result = await pi.exec("tmux", ["list-windows", "-a", "-F", "#{window_name}"]);
  if (result.code !== 0) return false;
  const prefix = `${owner}/${repo}`;
  return result.stdout.split("\n").some((line) => line.startsWith(prefix));
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "workspace",
    label: "Workspace",
    description:
      "Open a new tmux window for working on a specific repo. " +
      "Use this to switch context from discovery to focused work on a repo. " +
      'Use "provider/model" format for the model parameter (e.g., "anthropic/claude-opus-4") ' +
      "to avoid ambiguity when the same model name exists across providers. " +
      "Valid models: anthropic/claude-sonnet-4-6, anthropic/claude-opus-4-6. " +
      "Model and thinking level must be agreed with the user before calling — " +
      "suggest if asked, but never assume. The user confirms.",
    parameters: Type.Object({
      repo: Type.String({
        description:
          'Repository in "owner/repo" format (e.g., "dyreby/collaboration-framework")',
      }),
      model: Type.String({
        description:
          'Model to use in "provider/model" format (e.g., "anthropic/claude-opus-4", "anthropic/claude-sonnet-4"). ' +
          "The provider prefix avoids ambiguity when the same model name exists across providers. " +
          "Must be explicitly provided by the user.",
      }),
      thinking: Type.String({
        description:
          "Thinking level: off, minimal, low, medium, high, xhigh. Must be explicitly provided by the user.",
      }),
      context: Type.Optional(
        Type.String({
          description:
            'Optional context to show in window name (e.g., "#165" for a PR, "fix-bug" for a branch)',
        }),
      ),
      prompt: Type.Optional(
        Type.String({
          description:
            "Optional prompt to start pi with in the new window. Use this to inject context about what to work on.",
        }),
      ),
      orient: Type.Optional(
        Type.Boolean({
          description:
            "If true, require the agent to orient and check in before starting work. " +
            "Use for open-ended or under-specified tasks where alignment on interpretation matters before tools run.",
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal) {
      const { repo, model, thinking, context, prompt, orient } = params as {
        repo: string;
        model: string;
        thinking: string;
        context?: string;
        prompt?: string;
        orient?: boolean;
      };

      // Parse owner/repo
      const parts = repo.split("/");
      if (parts.length !== 2) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid repo format: "${repo}". Expected "owner/repo".`,
            },
          ],
          isError: true,
        };
      }
      const [owner, repoName] = parts;

      // Find local path
      const repoPath = findRepoPath(owner, repoName);
      if (!repoPath) {
        return {
          content: [
            {
              type: "text",
              text: `Repo not found locally: ${repo}\nExpected at: ${join(REPOS_BASE, owner, repoName)}\n\nClone it first, or check the path.`,
            },
          ],
          isError: true,
        };
      }

      // Check if we're in tmux
      if (!process.env.TMUX) {
        return {
          content: [
            {
              type: "text",
              text: `Not running in tmux. The workspace tool requires tmux to open new windows.`,
            },
          ],
          isError: true,
        };
      }

      // Detect whether a parallel workspace for this repo is already open.
      // If so, isolate this session in a git worktree so each session gets
      // its own directory and branch.
      let workPath = repoPath;
      let worktreeNote = "";

      const needsWorktree = await hasActiveWorkspace(pi, owner, repoName);

      if (needsWorktree) {
        // Derive a stable, filesystem-safe identifier from context.
        const rawId = context ? sanitizeIdentifier(context) : "";
        const identifier = rawId || `ws-${Date.now().toString(36)}`;

        const worktreePath = join(REPOS_BASE, owner, `${repoName}-${identifier}`);
        const branchName = `workspace/${identifier}`;

        // Fetch the latest main so the worktree starts from a clean base.
        const fetchResult = await pi.exec("git", [
          "-C",
          repoPath,
          "fetch",
          "origin",
          "main",
        ]);
        if (fetchResult.code !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to fetch origin/main: ${fetchResult.stderr}`,
              },
            ],
            isError: true,
          };
        }

        // Create the worktree on a fresh branch from origin/main.
        const worktreeResult = await pi.exec("git", [
          "-C",
          repoPath,
          "worktree",
          "add",
          worktreePath,
          "-b",
          branchName,
          "origin/main",
        ]);
        if (worktreeResult.code !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create worktree: ${worktreeResult.stderr}`,
              },
            ],
            isError: true,
          };
        }

        workPath = worktreePath;

        // Tell the spawned agent where it is and where the main repo lives.
        worktreeNote =
          `\n\n---\n` +
          `Note: This session is in a git worktree at \`${worktreePath}\` ` +
          `(branch \`${branchName}\`). The main repo is at \`${repoPath}\`. ` +
          `Do all branch operations here — do not switch branches in the main repo.`;
      }

      // Build window name
      const windowName = buildWindowName(owner, repoName, context);

      // Build pi invocation. Single-quote the model and thinking values;
      // escape any embedded single quotes.
      const escapedModel = model.replace(/'/g, "'\\''");
      const escapedThinking = thinking.replace(/'/g, "'\\''");
      const modelArgs = `--model '${escapedModel}' --thinking '${escapedThinking}'`;

      // Build env var prefix:
      // - PI_LOAD_ALL_CONCEPTS: signals collaboration extension to load all concepts
      // - PI_WORKSPACE_ORIENT: signals collaboration extension to require orient check-in
      const envVars = ["PI_LOAD_ALL_CONCEPTS=1"];
      if (orient) envVars.push("PI_WORKSPACE_ORIENT=1");
      const envPrefix = envVars.join(" ");

      // Build the full pi command. When there is a prompt or a worktree note,
      // write the content to a temp file and reference it via @file syntax —
      // this avoids shell escaping issues and tmux length limits.
      let piCommand: string;

      const promptContent = (prompt ?? "") + worktreeNote;
      if (promptContent.trim()) {
        const promptDir = join(tmpdir(), "pi-workspace");
        await mkdir(promptDir, { recursive: true });
        const promptFile = join(promptDir, `${randomUUID()}.md`);
        await writeFile(promptFile, promptContent, "utf8");
        piCommand = `${envPrefix} pi ${modelArgs} @${promptFile}`;
      } else {
        piCommand = `${envPrefix} pi ${modelArgs}`;
      }

      // Open a new tmux window and pass pi as the shell command directly.
      // This eliminates the send-keys race condition (shell not yet ready
      // when keys are sent) and ensures the window closes cleanly when pi exits.
      const result = await pi.exec("tmux", [
        "new-window",
        "-n",
        windowName,
        "-c",
        workPath,
        piCommand,
      ]);

      if (result.code !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to open tmux window: ${result.stderr}`,
            },
          ],
          isError: true,
        };
      }

      const worktreeMsg = needsWorktree
        ? `\nWorktree: ${workPath}`
        : "";

      return {
        content: [
          {
            type: "text",
            text:
              `Opened workspace: ${windowName}\n` +
              `Path: ${workPath}${worktreeMsg}\n` +
              `Started pi with ${model} (thinking: ${thinking}).\n\n` +
              `Switch to that tmux window to continue.`,
          },
        ],
      };
    },
  });
}
