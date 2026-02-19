# Grafana API Coverage Audit (Post-Implementation)

Last updated: 2026-02-19

## Executive summary

Grafana is now managed through a universal request layer in NAAS:
- Desired spec: `grafanaCrud[]` supports legacy CRUD aliases and raw HTTP methods (`get/post/put/patch/delete/head/options`).
- Planner emits either legacy `grafana.{create|read|update|delete}` actions or universal `grafana.request`.
- Preflight enforces path/method safety and high-risk confirmation checks.
- Executor dispatches all Grafana actions through `GrafanaProvider.grafanaRequest(...)`.

This architecture enables one-pass support for the broad Grafana HTTP API surface without adding one wrapper per endpoint.

## Coverage matrix (family-level)

Status legend:
- ✅ Callable through universal API layer
- ⚠️ Restricted by safety policy (explicit confirmation needed on high-risk writes)
- ⛔ Blocked by policy

Core families from Grafana HTTP API TOC:
- Admin API: ✅ (within allowed `/api` paths), ⛔ blocked for `/admin/provisioning` and `/admin/settings`
- Alerting provisioning API: ✅, ⚠️ policy replacement flows require explicit confirmation
- Dashboard API: ✅
- Folder API: ✅, ⚠️ destructive/high-risk folder operations require explicit confirmation
- Folder/Dashboard search API: ✅
- Data source API: ✅
- Team API: ✅
- Service account API: ✅, ⚠️ high-risk writes require explicit confirmation
- Organization API: ✅ (with optional `orgId` mapped to `X-Grafana-Org-Id`)
- Preferences/Playlist/Snapshot/Short URL/Annotations/Library/etc.: ✅
- `/apis/*` resources (new API structure): ✅

## Implemented safety model

- Allowed prefixes: `/api`, `/apis`
- Explicit deny segments:
  - `/admin/provisioning`
  - `/admin/settings`
- High-risk write operations require `confirm: I_UNDERSTAND` in payload/body.
- Preflight rejects invalid/unsafe Grafana operations before apply.

## Verification performed

Implemented and validated in tests:
- Planner generation for legacy and universal Grafana actions.
- Preflight policy failures and confirmation handling.
- Executor dispatch for both legacy and `grafana.request` actions.

## Remaining gaps

- Domain-specific typed Grafana models (folders/dashboards/alerting/datasources/teams/service accounts) are still optional enhancements.
- Universal request coverage is complete at transport/control-plane level; typed semantic reconciliation can be added incrementally on top.
