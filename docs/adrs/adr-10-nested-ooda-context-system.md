# ADR-10: Nested OODA Context System

- **Status:** Draft
- **Date:** 2026-02-22
- **RFC:** [RFC-09](../rfcs/rfc-09-nested-ooda-context-system.md)

## Context

RFC-09 established a model for agent context management built on nested OODA loops. The core insight: the agent's context request is an observable expression of its understanding. By requiring the agent to articulate what it thinks it needs before fetching, misalignment surfaces early—before work happens, not after.

The RFC left implementation details as open questions. This ADR makes concrete decisions for the first implementation.

## Decision

### Task-Type Commands

Extend the collaboration extension with task-type commands. Each command:

1. **Front-loads deterministic context** — information every instance of this task type needs
2. **Injects OODA framing** — establishes how the conversation will unfold
3. **Layers on existing preamble** — "apply best practices" still applies

Commands follow the pattern `/task-type <target>` (e.g., `/review-pr 24`).

### First Implementation: `/review-pr`

The `/review-pr <number>` command reviews a pull request.

#### What It Fetches (Deterministic)

Every PR review needs this. Fetch it immediately, no OODA loop required:

- PR metadata: title, body, state, author (via `gh pr view --json`)
- Diff content with file summary (via `gh pr diff`)
- Linked issues: titles and URLs only, not full bodies (via `closingIssuesReferences` field)

**Linked issue detection:** Use GitHub's native `closingIssuesReferences` API field. This captures issues linked with closing keywords (Fixes, Closes, Resolves). Bare `#123` mentions in the body are not auto-fetched—if they matter, the agent can request them during the Orient loop.

**Large diff handling:** Diffs are truncated at 50KB to preserve context budget. When truncated:
- Always include file change summary first (files changed, insertions, deletions)
- Truncate diff content with notice: `[Diff truncated at 50KB. Use 'read <path>' for specific files.]`
- Agent can fetch specific files as needed during Orient loop

#### What It Injects

```markdown
## Task: Review PR #<number>

### Context

**Title:** <pr title>
**Author:** <author>
**State:** <state>

**Body:**
<pr body>

**Linked Issues:**
- #<issue>: <title> (<url>)

**Files Changed:**
<file summary: N files changed, X insertions, Y deletions>
<list of changed file paths>

**Diff:**
<diff content, truncated at 50KB if large>

### Tools That Help

- `gh pr view <number>` — metadata, body, status
- `gh issue view <number>` — full issue details if needed
- `read <path>` — examine specific files beyond the diff
- `gh pr diff <number>` — re-fetch diff if needed

### Definition of Done

A good review follows this structure:

1. **Verdict**: Lead with the outcome
2. **Understanding**: Show we get the point of this PR — the author should see we understood before we critique
3. **What we like**: Call out what works well
4. **Questions**: Things we're curious about or want clarified
5. **Nits**: Minor suggestions, take-or-leave

### How This Goes (OODA)

**Orient (context alignment)**
If you need more context beyond what's provided, propose what you think you need. I'll confirm, challenge, or narrow. Iterate until aligned, then fetch.

**Decide (action alignment)**
When ready, call the `github` tool with your `pr review` command. A confirmation modal will show the review—press Enter to execute, or Escape to discuss. If you escape, I'll tell you what's on my mind, you revise, and we iterate until aligned.

Both loops can re-open if new information changes things.
```

#### Implementation Location

Add to `extensions/collaboration.ts`. The command:

1. Parses PR number from args
2. Fetches PR data via `gh pr view --json title,body,state,author,closingIssuesReferences`
3. Fetches diff via `gh pr diff`, truncating if over 50KB
4. Fetches linked issue titles via `gh issue view --json title,url` (if any linked)
5. Injects the template as a **user message** (not system prompt)
6. Hands off to agent

**Injection mechanism:** The task context is injected as the first user message in the conversation, not added to the system prompt. This matches the mental model: the preamble (system prompt) is persistent behavioral guidance ("apply best practices"), while the task (user message) is what's being asked right now. The agent reads the injected message as the task arriving.

**Error handling:** If `gh` commands fail (PR doesn't exist, network error, auth issue), the command fails with a clear error message. No partial context is injected—either the full deterministic context is available, or the command reports the failure and exits.

**Posting the review:** The agent calls the `github` tool with the `gh pr review` command. The tool shows a confirmation modal with the parsed review details. The user presses Enter to execute or Escape to discuss. If Escape, the agent receives feedback that the user wants to discuss, revises based on input, and tries again. This modal-based iteration *is* the Decide loop.

### Pattern for Future Commands

Additional task-type commands (e.g., `/fix-issue`, `/implement-feature`) follow the same pattern:

1. Identify deterministic context for the task type
2. Define the DoD
3. Use the same OODA framing
4. Add the command to the collaboration extension

These additions are PRs, not ADRs—the architectural decision is established here.

### What's Deferred

- **Project-specific configuration**: No `.pi/context/` or repo-level overrides yet. Start with universal behavior, add project specifics when needed.
- **Learning mechanism**: No automatic capture of approval/pushback patterns. Start with manual observation.
- **AST-aware tooling**: No code-understanding tools beyond grep/read. Add when we feel the pain.

## Consequences

### Enables

- Agent gets right context for task without manual concept loading
- Misalignment surfaces at context-request time, not after work is done
- OODA structure is explicit in the conversation
- Pattern extends naturally to other task types
- System can evolve (loops collapse) without changing tooling

### Constrains

- Only PR review initially—other task types require additional commands
- No project-specific customization yet
- Agent must articulate context needs rather than freely exploring

### Supersedes

This ADR, along with RFC-09, supersedes the approach explored in:

- Issue #82: Reframe /concept as a concepts loader
- Issue #113: Rethink concept loading
- Issue #115: Rethink the need for a concept loader

The question "how does the agent get the right context?" is answered through task-driven OODA loops.
