# Grafana API Management Plan (NAAS)

Last updated: 2026-02-19

## Current implementation status

Implemented baseline (CLI + shared):
- `DesiredSpec.grafanaCrud[]` with schema validation.
- Planner generation for `grafana.{create|read|update|delete}` actions.
- Planner generation for universal `grafana.request` actions (HTTP methods + query/body/headers/orgId).
- Executor dispatch through `GrafanaProvider.grafanaRequest(...)`.
- Grafana CRUD safety policy with:
  - allowlist prefixes (`/api`, `/apis`)
  - deny segments (`/admin/provisioning`, `/admin/settings`)
  - high-risk write confirmation requirement (`payload.confirm` or `body.confirm` = `I_UNDERSTAND`)
- Preflight policy enforcement for all `grafanaCrud` entries.
- Typed folder lifecycle:
  - `DesiredSpec.grafanaFolders[]`
  - actions `grafana.folder.upsert` / `grafana.folder.delete`
- Typed dashboard lifecycle:
  - `DesiredSpec.grafanaDashboards[]`
  - actions `grafana.dashboard.upsert` / `grafana.dashboard.delete`
- Typed alerting lifecycle:
  - `DesiredSpec.grafanaAlertRuleGroups[]`
  - `DesiredSpec.grafanaContactPoints[]`
  - `DesiredSpec.grafanaNotificationPolicies[]`
- Typed governance lifecycle:
  - `DesiredSpec.grafanaDatasources[]`
  - `DesiredSpec.grafanaTeams[]`
  - `DesiredSpec.grafanaTeamMemberships[]`
  - `DesiredSpec.grafanaServiceAccounts[]`
  - `DesiredSpec.grafanaServiceAccountTokens[]`

See also:
- `docs/API-DOCUMENTATION-SNAPSHOT.md`
- `docs/GRAFANA-API-COVERAGE-AUDIT.md`

Remaining phases below still apply for typed domain-specific management (folders, dashboards, alerting, datasources, teams, service accounts).

Note: Phase B is implemented and Phases C-E are now partially implemented via typed desired-spec + planner/preflight/executor/provider wiring on top of the universal API layer.

## New mandatory instructions (before any next Grafana phase)

1. Documentation first:
  - update this plan + setup docs before changing behavior.
  - record any new API sources in `docs/API-DOCUMENTATION-SNAPSHOT.md`.
2. Safety first:
  - do not bypass `grafanaCrudPolicy` in runtime or preflight.
  - keep explicit confirmation for high-risk write paths.
3. Universal layer first:
  - any new Grafana domain must remain executable through `grafanaCrud` / `grafana.request`.
  - typed wrappers are additive, never replacements of the universal fallback.
4. Secrets discipline:
  - no token/secret values in docs, tests, logs, plan outputs.
5. Batch delivery mode:
  - implement domains in consolidated waves (not micro-slices), then run one final audit.

## Universal API model (now authoritative)

`DesiredSpec.grafanaCrud[]` supports:
- methods: `create/read/update/delete` and raw HTTP `get/post/put/patch/delete/head/options`
- transport fields: `payload`, `query`, `body`, `headers`, `orgId`, `reason`

Planner mapping:
- simple legacy entries -> `grafana.{create|read|update|delete}`
- advanced/raw HTTP entries -> `grafana.request`

Execution mapping:
- all actions call `GrafanaProvider.grafanaRequest(...)`
- `orgId` is mapped to `X-Grafana-Org-Id`

## Scope

Goal: define an end-to-end implementation plan for Grafana resource management via API with the same safety model used for Proxmox typed wrappers.

Target domains:
- Dashboards and folders
- Alerting resources (rules, rule groups, contact points, policies, mute timings, templates)
- Data sources
- Teams and memberships
- Service accounts and tokens

Reference sources:
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/dashboard/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/folder/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/alerting_provisioning/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/data_source/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/team/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/serviceaccount/

---

## 1) API coverage model

## 1.1 Auth and tenancy

- Primary auth for cloud and modern setups: `Authorization: Bearer <service-account-token>`
- Optional org scoping: `X-Grafana-Org-Id`
- Permission model: endpoint-specific RBAC actions/scopes (`dashboards:*`, `folders:*`, `datasources:*`, `teams:*`, `serviceaccounts:*`)

Implementation policy:
- Default to service account token auth in NAAS provider.
- Require explicit org configuration for multi-org automation.
- Fail fast with actionable RBAC error messages for missing scope.

## 1.2 Dashboard and folder APIs

Dashboard APIs to support:
- New API structure:
  - `GET/POST/PUT/DELETE /apis/dashboard.grafana.app/v1beta1/namespaces/:namespace/dashboards...`
- Backward-compatible dashboard endpoints still commonly used:
  - `POST /api/dashboards/db`
  - `GET /api/dashboards/uid/:uid`
  - `DELETE /api/dashboards/uid/:uid`

Folder APIs to support:
- New API structure:
  - `GET/POST/PUT/DELETE /apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders...`
- Legacy but widely deployed endpoints:
  - `GET/POST/PUT/DELETE /api/folders...`
  - `POST /api/folders/:uid/move`

Plan choice:
- Read from both API families with feature detection.
- Write through a version-aware adapter to avoid breaking older deployments.

## 1.3 Alerting provisioning APIs

Grafana-managed alerting endpoints to support:
- Alert rules:
  - `/api/v1/provisioning/alert-rules*`
  - `/api/v1/provisioning/folder/:folderUid/rule-groups/:group*`
- Contact points:
  - `/api/v1/provisioning/contact-points*`
- Notification policies:
  - `/api/v1/provisioning/policies*`
- Templates:
  - `/api/v1/provisioning/templates*`
- Mute timings:
  - `/api/v1/provisioning/mute-timings*`

Important behavior:
- `export` formats are for file/terraform provisioning and are not valid write payloads for these endpoints.
- `PUT /api/v1/provisioning/policies` replaces policy tree content.
- Optional `X-Disable-Provenance: true` changes UI editability/provenance behavior.

## 1.4 Data source APIs

Endpoints to support:
- CRUD by UID/name:
  - `/api/datasources`
  - `/api/datasources/uid/:uid`
  - `/api/datasources/name/:name`
- Health and resources:
  - `/api/datasources/uid/:uid/health`
  - `/api/datasources/uid/:uid/resources/*`
- Query path:
  - `POST /api/ds/query`

Policy:
- Prefer UID endpoints over deprecated ID endpoints.
- Keep secrets in `secureJsonData`; never log secret payload fields.

## 1.5 Teams and service accounts

Teams:
- `GET /api/teams/search`
- `POST/PUT/DELETE /api/teams...`
- Membership operations:
  - `GET /api/teams/:id/members`
  - `POST /api/teams/:id/members`
  - `DELETE /api/teams/:id/members/:userId`
  - `PUT /api/teams/:id/members` (bulk)

Service accounts:
- `GET /api/serviceaccounts/search`
- `POST/PATCH/DELETE /api/serviceaccounts...`
- Token operations:
  - `GET /api/serviceaccounts/:id/tokens`
  - `POST /api/serviceaccounts/:id/tokens`
  - `DELETE /api/serviceaccounts/:id/tokens/:tokenId`

Security policy:
- Token creation endpoints return secrets once; redact immediately after capture.
- No token values in logs, state snapshots, test fixtures, or docs.

---

## 2) NAAS implementation roadmap

## Phase A — Foundation and safety

Deliverables:
- New `GrafanaApiClient` with retry, typed error mapping, org header support.
- Version/feature detector for new-vs-legacy dashboard/folder APIs.
- Redaction layer for all secret fields (`secureJsonData`, service account token keys).

Acceptance:
- Provider can authenticate, detect capabilities, and return normalized errors.

## Phase B — Dashboards + folders lifecycle

Deliverables:
- Shared typed spec + validation for:
  - `grafanaFolders`
  - `grafanaDashboards`
- Planner/executor actions:
  - create/update/delete/read
  - idempotent upsert by UID
- Preflight checks:
  - duplicate UID/title collisions
  - folder parent loops and unsafe deletes warnings

Acceptance:
- Deterministic plan/apply for dashboard/folder CRUD on mixed Grafana versions.

## Phase C — Alerting provisioning lifecycle

Deliverables:
- Shared typed spec + validation for:
  - `grafanaAlertRuleGroups`
  - `grafanaAlertRules`
  - `grafanaContactPoints`
  - `grafanaNotificationPolicies`
  - `grafanaNotificationTemplates`
  - `grafanaMuteTimings`
- Safety constraints:
  - explicit `confirm: I_UNDERSTAND` for policy tree replacement
  - optional provenance mode (`managed` vs `ui-editable`)
- Read/export actions separated from write payload flows.

Acceptance:
- Full Grafana-managed alert lifecycle with policy replacement safeguards.

## Phase D — Data sources lifecycle

Deliverables:
- Shared typed spec + validation for:
  - `grafanaDatasources`
  - `grafanaDatasourceChecks`
- Actions:
  - create/update/delete/read by UID
  - health checks and optional smoke query
- Secret handling:
  - write-only secure fields
  - drift checks that ignore encrypted value round-trip limitations

Acceptance:
- Safe datasource CRUD and health validation without secret leakage.

## Phase E — Teams + service accounts

Deliverables:
- Shared typed spec + validation for:
  - `grafanaTeams`
  - `grafanaTeamMemberships`
  - `grafanaServiceAccounts`
  - `grafanaServiceAccountTokens`
- Actions:
  - team lifecycle + bulk member reconciliation
  - service account lifecycle + token issue/revoke
- Guardrails:
  - token creation only in apply mode, never in plan output body
  - optional TTL policy for issued tokens

Acceptance:
- Team and service-account governance integrated with NAAS audit model.

## Phase F — VS Code UX parity

Deliverables:
- Extension forms and snippets for all Grafana domains above.
- Resource previews and dry-run diff visualization.
- Per-action RBAC readiness hints before apply.

Acceptance:
- AWS-toolkit-like guided workflows for Grafana management from extension UI.

---

## 3) Data model proposal (shared package)

Suggested desired-spec fields:
- `grafanaFolders`
- `grafanaDashboards`
- `grafanaAlertRuleGroups`
- `grafanaAlertRules`
- `grafanaContactPoints`
- `grafanaNotificationPolicies`
- `grafanaNotificationTemplates`
- `grafanaMuteTimings`
- `grafanaDatasources`
- `grafanaTeams`
- `grafanaTeamMemberships`
- `grafanaServiceAccounts`
- `grafanaServiceAccountTokens`

Suggested action families:
- `grafana.folder.{create|update|delete|read}`
- `grafana.dashboard.{create|update|delete|read}`
- `grafana.alerting.{rule-group|rule|contact-point|policy|template|mute-timing}.{upsert|delete|read|export}`
- `grafana.datasource.{create|update|delete|read|health-check|query}`
- `grafana.team.{create|update|delete|read|members.sync}`
- `grafana.service-account.{create|update|delete|read|token.create|token.delete|token.list}`

---

## 4) Safety and compliance requirements

- No secrets in logs/state/docs/tests.
- Destructive actions require explicit confirmation fields for high-impact resources:
  - folder delete (because it cascades dashboards and alerts)
  - notification policy tree replacement
  - bulk team membership overwrite
- Preflight must detect and fail on ambiguous identity selectors (name vs uid mismatch).
- Add audit entries with action kind, target identifier, and outcome (without secret payloads).

---

## 5) Validation strategy

For each domain:
1. Unit tests for planner generation and ordering.
2. Executor tests for provider method dispatch and output handling.
3. Serialization tests for request payload shape.
4. Negative tests for RBAC/404/version mismatch conflicts.

Rollout sequencing recommendation:
1. Phase A + B
2. Phase C
3. Phase D
4. Phase E + F

This order delivers immediate dashboard/folder value first, then alerting, then datasource/team/service-account governance.
