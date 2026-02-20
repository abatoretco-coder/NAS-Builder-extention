# Copilot Instructions

Apply these rules for all coding, review, and documentation tasks in this repository.

## Core expectations

- Keep changes small, focused, and production-safe.
- Preserve existing behavior unless behavior change is explicitly required.
- Fix root causes, not superficial symptoms.
- Keep strong typing and explicit error handling.
- Documentation-first for behavior changes: update docs before or with code.

## Security and secrets

- Never hardcode credentials, tokens, or secrets in code/tests/docs/logs.
- Use placeholders in all examples.
- Use VS Code SecretStorage for extension-side credentials.
- Prefer env vars and documented config references for CLI-side credentials.

## Proxmox policy

- Treat generic Proxmox CRUD as high-risk by default.
- Enforce path allowlists/denylists.
- Require `confirm: I_UNDERSTAND` for high-risk write operations.
- Enforce policy in both runtime execution and preflight validation.

## LAN management safety

- Never apply host/datacenter firewall DROP policies without explicit allow rules for the admin LAN management source.
- Keep admin management source in `safetyGuards.managementAccessCidrs` using CIDR format (example: `192.168.1.50/32`).
- Keep management ports `22` and `8006` explicitly allowed for each admin CIDR before restrictive rules.
- Use CIDR in firewall `source` fields; do not use `IP:port` format in `source`.

## Grafana policy

- Treat Grafana API management as policy-controlled by default.
- Restrict paths to approved prefixes (`/api`, `/apis`) with explicit deny segments as required.
- Require `confirm: I_UNDERSTAND` for high-risk Grafana write operations.
- Enforce policy in both runtime execution and preflight validation.
- Keep universal fallback support (`grafanaCrud` / `grafana.request`) when adding typed wrappers.

## Testing and validation

- Add/update tests for non-trivial logic changes.
- Keep tests deterministic and isolated.
- Validate narrow changed paths first, then broader checks.
- Do not fix unrelated failing tests unless explicitly requested.

## Documentation expectations

- Update README/setup docs when commands/config/behavior change.
- Keep examples copy/paste-safe and operational.
- Include expected outcomes/checkpoints where useful.
- Update API snapshot/audit docs in `docs/` when API surface changes.

## Delivery mode

- Prefer consolidated implementation waves when asked for all-at-once delivery.
- Finish each wave with one explicit audit pass and build/test validation.
- Do not defer safety/doc updates after behavior changes.

## Scope guardrails

- Do not add dependencies without clear justification.
- Do not perform broad formatting-only rewrites.
- Do not change architecture unless explicitly requested.
