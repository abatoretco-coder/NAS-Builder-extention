# API Documentation Snapshot (Proxmox + Grafana)

Last updated: 2026-02-19

## Scope

This file records the official API documentation references used by NAAS for Proxmox and Grafana.

## Proxmox VE

Primary references:
- https://pve.proxmox.com/wiki/Proxmox_VE_API
- https://pve.proxmox.com/pve-docs/api-viewer/index.html

Key notes:
- Base URL pattern is `https://<host>:8006/api2/json/...`.
- Proxmox API is formally described with JSON Schema and consumed by both REST and `pvesh`.
- API compatibility is expected within a major release; endpoint movement/removal can occur across major versions.

## Grafana

Primary references:
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/dashboard/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/folder/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/alerting_provisioning/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/data_source/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/team/
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/serviceaccount/

Specification references:
- OpenAPI v2: https://raw.githubusercontent.com/grafana/grafana/main/public/api-merged.json
- OpenAPI v3: https://raw.githubusercontent.com/grafana/grafana/main/public/openapi3.json

Key notes:
- HTTP API auth supports bearer token (service account token) and optional `X-Grafana-Org-Id` header.
- API families include dashboards, folders, alerting provisioning, datasources, teams, service accounts, and many additional domains.

## Download status

- Proxmox wiki and Grafana HTTP API references were fetched and reviewed in this implementation cycle.
- Some machine-readable pages (large JS/JSON blobs) may not render fully in simple extraction tools; canonical URLs above are still recorded for deterministic access.
