# Grafana API Coverage Audit (Post-Implementation)

Last updated: 2026-02-20

## Executive summary

Grafana coverage is now implemented in three layers:
- Universal control plane (`grafanaCrud` / `grafana.request`) for broad HTTP API reach.
- Typed write lifecycle for folders, dashboards, alerting, datasources, teams, service accounts.
- Typed read/check/query/list lifecycle for core verification flows.

## Status legend

- ✅ Implemented typed action(s)
- 🟨 Implemented through universal fallback (`grafanaCrud` / `grafana.request`)
- ⛔ Blocked by safety policy

## Endpoint-by-endpoint matrix

### Folders & Dashboards

- `POST /api/folders` → ✅ `grafana.folder.upsert`
- `DELETE /api/folders/:uid` → ✅ `grafana.folder.delete`
- `GET /api/folders` / `GET /api/folders/:uid` → ✅ `grafana.folder.read`
- `POST /api/dashboards/db` → ✅ `grafana.dashboard.upsert`
- `DELETE /api/dashboards/uid/:uid` → ✅ `grafana.dashboard.delete`
- `GET /api/dashboards/uid/:uid` → ✅ `grafana.dashboard.read`

### Alerting provisioning

- `PUT /api/v1/provisioning/folder/:folderUid/rule-groups/:group` → ✅ `grafana.alert-rule-group.upsert`
- `DELETE /api/v1/provisioning/folder/:folderUid/rule-groups/:group` → ✅ `grafana.alert-rule-group.delete`
- `GET /api/v1/provisioning/folder/:folderUid/rule-groups/:group` → ✅ `grafana.alert-rule-group.read`
- `POST /api/v1/provisioning/contact-points` → ✅ `grafana.contact-point.upsert`
- `DELETE /api/v1/provisioning/contact-points/:uid` → ✅ `grafana.contact-point.delete`
- `GET /api/v1/provisioning/contact-points` (+ by uid) → ✅ `grafana.contact-point.read`
- `PUT /api/v1/provisioning/policies` → ✅ `grafana.notification-policy.replace` (confirm required)
- `GET /api/v1/provisioning/policies` → ✅ `grafana.notification-policy.read`

### Datasources

- `POST /api/datasources` → ✅ `grafana.datasource.upsert`
- `DELETE /api/datasources/uid/:uid` → ✅ `grafana.datasource.delete`
- `GET /api/datasources/uid/:uid/health` → ✅ `grafana.datasource.health-check`
- `POST /api/ds/query` → ✅ `grafana.datasource.query`
- Other datasource endpoints (`/resources/*`, `/name/*`) → 🟨 universal fallback

### Teams

- `POST /api/teams` → ✅ `grafana.team.upsert`
- `DELETE /api/teams/:id` → ✅ `grafana.team.delete`
- `PUT|POST /api/teams/:id/members` → ✅ `grafana.team-membership.sync`
- Additional team APIs (`/search`, member delete by userId, etc.) → 🟨 universal fallback

### Service accounts

- `POST /api/serviceaccounts` → ✅ `grafana.service-account.upsert`
- `DELETE /api/serviceaccounts/:id` → ✅ `grafana.service-account.delete`
- `POST /api/serviceaccounts/:id/tokens` → ✅ `grafana.service-account-token.create`
- `DELETE /api/serviceaccounts/:id/tokens/:tokenId` → ✅ `grafana.service-account-token.delete`
- `GET /api/serviceaccounts/:id/tokens` → ✅ `grafana.service-account-token.list`

### Universal / cross-domain

- Any allowlisted path under `/api` or `/apis` (including raw methods) → ✅ `grafana.request`
- Legacy CRUD aliases (`create/read/update/delete`) → ✅ mapped to HTTP methods
- `/admin/provisioning` and `/admin/settings` segments → ⛔ blocked

## Safety controls enforced

- Prefix allowlist: `/api`, `/apis`
- Deny segments: `/admin/provisioning`, `/admin/settings`
- High-risk write confirmation: `confirm: I_UNDERSTAND` (payload/body)
- Policy enforcement in both preflight and runtime provider execution

## Validation run

- `pnpm --filter @naas/shared build`
- `pnpm --filter @naas/cli build`
- `pnpm --filter @naas/cli test`

All commands pass after Wave 3 (`81` tests passing in CLI suite).
