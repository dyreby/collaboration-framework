/**
 * GitHub command execution with agent identity.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isAllowed } from "./allow-list.ts";

export interface GhCommandContext {
  pi: ExtensionAPI;
  configDir: string;
  configError: string | null;
}

export interface CommandResult {
  content: Array<{ type: "text"; text: string }>;
  details?: { exitCode: number };
  isError?: boolean;
}

/**
 * Check if a command contains any gh invocations.
 */
export function containsGhCommand(command: string): boolean {
  // Match `gh ` at start or after shell operators/subshell markers
  return /(?:^|[;&|()]|\$\()\s*gh\s/.test(command);
}

/**
 * Extract all gh commands from a compound shell statement.
 * Returns the full gh command including arguments for each invocation.
 */
export function extractGhCommands(command: string): string[] {
  const commands: string[] = [];

  // Split on shell operators, preserving quoted strings
  // This handles: cmd1 && gh pr create && cmd2
  //               cmd1; gh issue list; cmd2
  //               cmd1 || gh pr view
  //               (gh pr list)
  //               $(gh pr view 123)
  const pattern = /(?:^|[;&|()]|\$\()\s*(gh\s+[^;&|()$]+)/g;
  let match;

  while ((match = pattern.exec(command)) !== null) {
    const ghCmd = match[1].trim();
    if (ghCmd) {
      commands.push(ghCmd);
    }
  }

  return commands;
}

/**
 * Validate all gh commands in a compound statement.
 * Returns validation result - if any command fails, returns that failure.
 */
export function validateGhCommands(
  command: string
): { allowed: true } | { allowed: false; reason: string } {
  const ghCommands = extractGhCommands(command);

  if (ghCommands.length === 0) {
    // No gh commands found - shouldn't happen if caller checks containsGhCommand first
    return { allowed: true };
  }

  for (const ghCmd of ghCommands) {
    const validation = isAllowed(ghCmd);
    if (!validation.allowed) {
      return validation;
    }
  }

  return { allowed: true };
}

/**
 * Execute a command containing gh invocations with agent identity.
 * Validates all gh commands before execution.
 */
export async function executeGhCommand(
  command: string,
  ctx: GhCommandContext,
  signal?: AbortSignal
): Promise<CommandResult> {
  const { pi, configDir, configError } = ctx;

  if (configError) {
    return {
      content: [{ type: "text", text: `gh-agent configuration error: ${configError}` }],
      isError: true,
    };
  }

  const validation = validateGhCommands(command);
  if (!validation.allowed) {
    return {
      content: [{ type: "text", text: `gh-agent: ${validation.reason}` }],
      isError: true,
    };
  }

  const result = await pi.exec("env", [`GH_CONFIG_DIR=${configDir}`, "bash", "-c", command], {
    signal,
  });

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    content: [{ type: "text", text: output || "(no output)" }],
    details: { exitCode: result.code },
    isError: result.code !== 0,
  };
}
