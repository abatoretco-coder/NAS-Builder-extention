---
description: Describe when these instructions should be loaded
# applyTo: 'Describe when these instructions should be loaded' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

# Project Instruction Template

Use these instructions whenever generating code, answering questions, or reviewing changes in this repository.

## Project context

- This repository contains a monorepo-style setup with TypeScript-based tooling.
- Main areas:
	- CLI runtime and providers
	- VS Code extension UI/integration
	- Shared models/types
- The extension is standalone and must not require code changes in user projects.

## Core engineering principles

1. Prefer small, focused, production-safe changes.
2. Preserve existing behavior unless the task explicitly requires behavior changes.
3. Fix root causes, not superficial symptoms.
4. Keep strong typing and clear error handling.
5. Do not introduce secrets into source files, tests, docs, or logs.
6. Documentation-first for behavior changes: update relevant docs before or with code changes.

## Code style and structure

- Follow existing naming and folder conventions.
- Keep functions single-purpose and composable.
- Avoid one-letter identifiers except in narrow loop contexts.
- Prefer explicit interfaces/types for public contracts.
- Avoid broad refactors unless requested.

## Security and secrets

- Never hardcode credentials, tokens, passwords, or endpoints with secrets.
- For extension-side credentials, use VS Code SecretStorage patterns.
- For CLI-side credentials, prefer env vars and documented config references.
- Ensure docs and examples use placeholders, never real values.

## Proxmox generic CRUD safety

- Treat generic Proxmox CRUD as high-risk by default.
- Keep path-scoped allowlists/denylists for datacenter and node operations.
- Require explicit confirmation payload (`confirm: I_UNDERSTAND`) for high-risk write operations.
- Enforce the same policy in both runtime provider execution and preflight checks.

## Grafana universal API safety

- Treat Grafana API management as policy-controlled by default.
- Keep Grafana paths restricted to approved prefixes (`/api`, `/apis`) and enforce explicit deny segments where required.
- Require explicit confirmation payload (`confirm: I_UNDERSTAND`) for high-risk Grafana write operations.
- Enforce Grafana policy checks in both runtime provider execution and preflight checks.
- Keep universal fallback support (`grafanaCrud` / `grafana.request`) available even when adding typed wrappers.

## Error handling and resilience

- Surface actionable errors with clear remediation steps.
- Use retries only where appropriate (network/transient operations).
- Gracefully handle partial failures (for example, one provider unavailable).
- Preserve logs useful for debugging without leaking sensitive data.

## Testing and validation

- Add/update tests for non-trivial logic changes.
- Keep tests deterministic and isolated.
- Validate changed code paths first, then broader checks when possible.
- Do not fix unrelated failing tests unless explicitly requested.

## Documentation expectations

- Update README/setup docs when behavior, commands, or config changes.
- Provide copy/paste-safe examples.
- Include expected results/checkpoints for setup/usage docs.
- Keep guidance concise and operationally actionable.
- When adding new API families/endpoints, update the API snapshot/audit docs in `docs/`.

## Delivery mode expectations

- Prefer consolidated implementation waves over fragmented micro-slices when user asks for "all at once" delivery.
- Finish each wave with one explicit audit pass and build/test validation.
- Do not defer safety/doc updates to a later pass when implementation changes behavior.

## VS Code extension-specific guidance

- Maintain support for:
	- empty window (no folder open)
	- single-root and multi-root workspaces
	- per-workspace and global settings
- Keep UI and core logic separated.
- Prefer CLI orchestration from extension rather than duplicating provider logic.

## Pull request/review behavior

- Summarize what changed, why, and user impact.
- Call out risks, assumptions, and any follow-up tasks.
- Include validation performed (tests/build/lint), or explain why not run.

## Out of scope by default

- Do not add new dependencies without clear justification.
- Do not perform broad formatting-only rewrites.
- Do not change project architecture unless requested.