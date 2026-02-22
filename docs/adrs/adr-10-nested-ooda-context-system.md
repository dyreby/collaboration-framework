# ADR-10: Nested OODA Context System

- **Status:** Accepted
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

- PR metadata: title, body, state, author
- Full diff content
- Linked issues: titles and URLs only (not full bodies)

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

**Diff:**
<diff content>

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
When ready, propose your review and the command to post it. I'll confirm, challenge, or refine. Iterate until aligned, then execute.

Both loops can re-open if new information changes things.
```

#### Implementation Location

Add to `extensions/collaboration.ts`. The command:

1. Parses PR number from args
2. Fetches PR data via `gh pr view` and `gh pr diff`
3. Fetches linked issue titles via `gh issue view` (if any linked)
4. Injects the above template into a new message context
5. Hands off to agent

The preamble injection (`before_agent_start`) remains unchanged—task injection layers on top.

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
