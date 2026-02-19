# Proxmox API Gap Audit & Full Implementation Plan (NAAS)

Last updated: 2026-02-19 (Wave 0 to Wave 8 read wrappers implemented)

## Scope

Goal: identify API coverage gaps between current NAAS Proxmox integration and a full AWS-like control plane expectation (CRUD + policy + operations across Datacenter and Node domains), then provide a complete implementation plan.

Reference sources:
- https://pve.proxmox.com/wiki/Proxmox_VE_API
- https://pve.proxmox.com/pve-docs/api-viewer/index.html
- https://pve.proxmox.com/pve-docs/pvesh.1.html

---

## 1) Current API coverage (already implemented)

### Auth/session
- `/access/ticket` (fallback username/password login)
- API token auth header support (`PVEAPIToken=...`)

### Compute lifecycle (QEMU/LXC)
- `/nodes/{node}/qemu`
- `/nodes/{node}/qemu/{vmid}/config`
- `/nodes/{node}/qemu/{vmid}/snapshot`
- `/nodes/{node}/qemu/{vmid}/status/{start|stop|reboot}`
- `/nodes/{node}/qemu/{vmid}/resize`
- `/nodes/{node}/qemu/{vmid}/clone`
- `/nodes/{node}/lxc`
- `/nodes/{node}/lxc/{vmid}/config`
- `/nodes/{node}/lxc/{vmid}/status/{start|stop|reboot}`

### Infra primitives
- `/nodes/{node}/network` (+ `/{iface}`)
- `/storage` (+ `/{storage}`)

### Access/IAM-like
- `/access/users` (+ `/{userid}`)
- `/access/users/{userid}/token/{tokenid}`
- `/access/acl`
- `/access/roles` (+ `/{roleid}`)

### Generic CRUD engines
- Datacenter generic CRUD (`proxmoxDatacenterCrud`) against arbitrary API paths
- Node generic CRUD (`proxmoxNodeCrud`) against `/nodes/{node}{path}`

### Read snapshots in scan
- Datacenter: version/cluster/ceph/options/storage/backup/replication/access subsets
- Node admin: system/network/certificates/dns/hosts/options/time/logs/updates/repos/firewall/disks

### Wave 7/8 operational reads and lifecycle
- HA groups/resources/rules lifecycle wrappers
- HA status read wrapper
- Ceph flag set/clear wrappers
- Ceph reads: overview, status, metadata, flags
- Node Ceph reads: version-dependent `/nodes/{node}/ceph*` with runtime capability detection
- Node Ceph write/maintenance actions: version-dependent `/nodes/{node}/ceph*` with explicit confirm guardrail
- Node firewall options/rules lifecycle wrappers
- Node custom/ACME certificate lifecycle wrappers
- SDN IPAM lifecycle wrappers
- Node tasks and cluster tasks read wrappers
- Node task log and node firewall log read wrappers

---

## 2) Missing API coverage (full gap audit)

Important: Proxmox API is large and versioned by major release. The list below is exhaustive by functional domain (family-level), with representative endpoint groups to implement explicitly (typed wrappers + planner policies), beyond current generic CRUD.

## 2.1 Access & Identity gaps

### Missing capabilities
- Group lifecycle semantics and membership management
- Realm management policies (LDAP/AD/OpenID details, sync jobs)
- TFA lifecycle (enroll/disable/recovery flows)
- Password rotation workflows (human user accounts)
- Token secret lifecycle management policy (issue/rotate/revoke schedules)
- Effective permission simulation/validation (who can do what before apply)

### Representative endpoint families
- `/access/groups*`
- `/access/domains*`
- `/access/tfa*`
- `/access/users/{userid}/token*` extended operations
- `/access/permissions*` style evaluation endpoints (where available by version)

### Why this matters
- Today: CRUD works.
- Missing: guardrails, lifecycle policy, and compliance workflows.

## 2.2 Datacenter governance gaps

### Missing capabilities
- Datacenter firewall full model (aliases, ipsets, rules/options)
- Datacenter notifications/metrics/reporting policies
- Full backup schedule lifecycle with retention policy validation and dry-run simulation
- Replication schedule conflict detection and topology planning
- Pool governance model (ownership, quota semantics, assignment policy)

### Representative endpoint families
- `/cluster/firewall*`
- `/cluster/backup*` advanced usage
- `/cluster/replication*` advanced usage
- `/pools*` full lifecycle
- `/cluster/options` policy profiles

## 2.3 Node system operations gaps

### Missing capabilities
- Service management (start/stop/restart daemons)
- Package operations (APT update/upgrade/apply) as controlled workflows
- Certificate issue/renew/deploy flows
- Host maintenance windows and reboot orchestration
- Node shell/diagnostics task wrappers (safe mode)

### Representative endpoint families
- `/nodes/{node}/services*`
- `/nodes/{node}/apt*` write operations
- `/nodes/{node}/certificates*` write operations
- `/nodes/{node}/status*` advanced task operations

## 2.4 Network & SDN gaps

### Missing capabilities
- SDN controllers/zones/vnets/subnets/ipam automation
- Firewall objects and zone policy composition
- Safe migration plans for bridge reconfiguration
- Drift detection for network policies vs runtime state

### Representative endpoint families
- `/cluster/sdn*`
- `/nodes/{node}/network*` advanced options and transaction safety
- `/nodes/{node}/firewall*` full object model

## 2.5 Storage/disks gaps

### Missing capabilities
- Storage content lifecycle (ISO/templates/snippets)
- Disk import/export/clone pipelines
- Snapshot policy/retention at storage + VM levels
- LVM/ZFS advanced operations safety checks

### Representative endpoint families
- `/storage*` extended ops
- `/nodes/{node}/disks*` write operations
- VM disk move/import endpoints (version-dependent)

## 2.6 QEMU virtualization gaps

### Missing capabilities
- Live migration and evacuation orchestration
- Full snapshot tree management and rollback policy
- Backup/restore orchestration with verification
- PCI passthrough, NUMA, advanced CPU model policy packs
- Console/session integrations and guest-agent operations

### Representative endpoint families
- `/nodes/{node}/qemu/{vmid}/migrate*`
- `/nodes/{node}/qemu/{vmid}/snapshot*` advanced
- `/nodes/{node}/qemu/{vmid}/backup*` / restore-related groups
- `/nodes/{node}/qemu/{vmid}/agent*`

## 2.7 LXC container gaps

### Missing capabilities
- CT migration and backup/restore workflows
- Template pipeline management and verification
- Advanced CT feature policy packs (nesting/fuse/mount options)

### Representative endpoint families
- `/nodes/{node}/lxc/{vmid}/migrate*`
- `/nodes/{node}/lxc/{vmid}/snapshot*`
- `/nodes/{node}/lxc/{vmid}/status*` extended ops

## 2.8 HA/DR gaps

### Missing capabilities
- HA groups/resources full lifecycle
- Node fencing policies
- Controlled failover runbooks

### Representative endpoint families
- `/cluster/ha*`

## 2.9 Ceph full lifecycle gaps

### Missing capabilities
- Cluster-level Ceph read/action surfaces beyond currently exposed endpoints in this implementation
- Node-scope Ceph lifecycle where available by installed Proxmox version

### Representative endpoint families
- `/cluster/ceph*`
- `/nodes/{node}/ceph*` (version dependent)

## 2.10 Observability/audit/control-plane gaps

### Missing capabilities
- Unified task tracking from UPID to final state
- Correlating API writes to audit trail entries
- SLO/error-budget dashboard for NAAS actions
- Preflight permission simulation per action

### Representative endpoint families
- `/cluster/tasks*`
- `/nodes/{node}/tasks*`
- `/access/log*` style audit views (version-dependent)

---

## 3) Full implementation plan (ALL domains)

## Wave 0 — Baseline hardening (1 sprint)

Status: Completed

Deliverables:
- Endpoint allowlist + denylist for dangerous generic CRUD paths
- Write confirmation policy for delete/update high-risk endpoints
- Unified error parser with Proxmox `errors`/`message` extraction everywhere
- Task/UPID collector in apply result artifacts

Implemented in code:
- `packages/cli/src/providers/proxmoxCrudPolicy.ts` with allowlist/denylist and high-risk confirmation checks
- Provider runtime enforcement for `proxmoxDatacenterCrud` and `proxmoxNodeCrud`
- Preflight policy validation for generic CRUD operations

Acceptance:
- No unsafe delete can run without explicit allowlist and preflight pass.

## Wave 1 — Access control completeness (1 sprint)

Status: Completed (core access domains)

Deliverables:
- Typed wrappers for groups, realms, TFA, user password lifecycle
- Diff-aware planner for access objects (no blind upsert)
- Policy checks: token expiry windows, realm constraints, ACL conflict detection

Implemented in code:
- Shared spec + validation support for `proxmoxGroups`, `proxmoxRealms`, `proxmoxTfa`
- Planner/executor wiring for group/realm/TFA actions
- Provider wrappers for `/access/groups`, `/access/domains`, `/access/tfa`
- Tests for planner, executor, and preflight covering these actions

Acceptance:
- Full CRUD for users/tokens/groups/roles/ACL/realms with deterministic plans.

## Wave 2 — Datacenter governance completeness (1 sprint)

Status: Completed (core governance wrappers)

Deliverables:
- Typed wrappers for backup, replication, pools, cluster options, datacenter firewall
- Drift model and plan generation for governance entities
- Safe rollback where possible

Implemented in code:
- Shared spec + validation fields:
   - `proxmoxClusterOptions`
   - `proxmoxPools`
   - `proxmoxBackupJobs`
   - `proxmoxReplicationJobs`
   - `proxmoxDatacenterFirewallOptions`
- Provider wrappers for:
   - `/cluster/options`
   - `/pools`
   - `/cluster/backup`
   - `/cluster/replication`
   - `/cluster/firewall/options`
- Planner/executor wiring and tests for these governance actions

Acceptance:
- Governance resources represented in desired spec with diff-based apply.

## Wave 3 — Node system completeness (1 sprint)

Status: Completed (core node wrappers)

Deliverables:
- Typed wrappers for node DNS/hosts/options/time/services/apt/certificates
- Node operation playbooks (maintenance mode, reboot sequencing)
- Idempotent planner for node config domains

Implemented in code:
- Shared spec + validation fields:
   - `proxmoxNodeDns`
   - `proxmoxNodeHosts`
   - `proxmoxNodeOptions`
   - `proxmoxNodeTime`
   - `proxmoxNodeServices`
   - `proxmoxNodeApt`
   - `proxmoxNodeCertificates`
- Provider wrappers for:
   - `/nodes/{node}/dns`
   - `/nodes/{node}/hosts`
   - `/nodes/{node}/config`
   - `/nodes/{node}/time`
   - `/nodes/{node}/services/{service}/{action}`
   - `/nodes/{node}/apt/{update|upgrade}`
   - `/nodes/{node}/certificates*` (path-scoped typed requests)
- Planner/executor wiring and tests for these node actions

Acceptance:
- Node admin menus manageable from desired spec without generic-only payloads.

## API-doc verification snapshot (official Proxmox)

Verified against official API viewer assets (`/pve-docs/api-viewer/index.html` + `apidoc.js`) and `pvesh(1)`:

- Phase 2 endpoint families found in docs:
   - `/cluster/options`
   - `/cluster/backup`
   - `/cluster/replication`
   - `/cluster/firewall/options`
   - `/pools`
- Phase 3 endpoint families found in docs:
   - `/nodes/{node}/dns`
   - `/nodes/{node}/hosts`
   - `/nodes/{node}/config`
   - `/nodes/{node}/time`
   - `/nodes/{node}/services`
   - `/nodes/{node}/apt`
   - `/nodes/{node}/certificates`
- Wave 4 endpoint families found in docs:
   - `/cluster/sdn/zones`
   - `/cluster/sdn/vnets`
   - `/cluster/sdn/vnets/{vnet}/subnets`
   - `/cluster/firewall/aliases`
   - `/cluster/firewall/ipset`
   - `/cluster/firewall/rules`
- Wave 5 endpoint families found in docs:
   - `/nodes/{node}/qemu/{vmid}/migrate`
   - `/nodes/{node}/lxc/{vmid}/migrate`
   - `/nodes/{node}/vzdump`
   - `/nodes/{node}/qemu/{vmid}/snapshot`
   - `/nodes/{node}/lxc/{vmid}/snapshot`
   - `/nodes/{node}/qemu/{vmid}/agent`
   - `/nodes/{node}/qemu`
   - `/nodes/{node}/lxc`
- Wave 6 endpoint families found in docs:
   - `/nodes/{node}/storage/{storage}/content/{volume}`
   - `/nodes/{node}/qemu/{vmid}/move_disk`
   - `/nodes/{node}/qemu/{vmid}/importdisk`
   - `/nodes/{node}/disks/initgpt`
   - `/nodes/{node}/disks/lvm`
   - `/nodes/{node}/disks/lvmthin`
   - `/nodes/{node}/disks/zfs`
- Remaining-domain endpoint families found in docs (latest `api-viewer/apidoc.js` verification):
   - HA/DR:
      - `/cluster/ha`
      - `/cluster/ha/groups`
      - `/cluster/ha/resources`
      - `/cluster/ha/rules`
      - `/cluster/ha/status`
   - Ceph:
      - `/cluster/ceph`
      - `/cluster/ceph/status`
      - `/cluster/ceph/flags`
      - `/cluster/ceph/flags/{flag}`
      - `/cluster/ceph/metadata`
   - Node firewall (node-scope):
      - `/nodes/{node}/firewall`
      - `/nodes/{node}/firewall/options`
      - `/nodes/{node}/firewall/rules`
      - `/nodes/{node}/firewall/log`
   - Task tracking:
      - `/nodes/{node}/tasks`
      - `/nodes/{node}/tasks/{upid}`
      - `/nodes/{node}/tasks/{upid}/status`
      - `/nodes/{node}/tasks/{upid}/log`
      - `/cluster/tasks`
   - Certificates lifecycle:
      - `/nodes/{node}/certificates`
      - `/nodes/{node}/certificates/info`
      - `/nodes/{node}/certificates/custom`
      - `/nodes/{node}/certificates/acme`
      - `/nodes/{node}/certificates/acme/certificate`
   - SDN IPAM:
      - `/cluster/sdn/ipams`
      - `/cluster/sdn/ipams/{ipam}`
      - `/cluster/sdn/ipams/{ipam}/status`

Remaining documented gaps after current Wave 8 increment:
- Wave 7/8 domains partially covered:
   - HA/DR core typed lifecycle now wired for groups/resources/rules (`/cluster/ha/groups`, `/cluster/ha/resources`, `/cluster/ha/rules`)
   - HA status typed read now wired (`/cluster/ha/status`)
   - Ceph typed lifecycle now wired for flags (`/cluster/ceph/flags`)
   - Ceph typed reads now wired for overview/status/metadata/flags (`/cluster/ceph`, `/cluster/ceph/status`, `/cluster/ceph/metadata`, `/cluster/ceph/flags`)
- Wave 7 domains now additionally typed/wired:
   - Node firewall options/rules (`/nodes/{node}/firewall/options`, `/nodes/{node}/firewall/rules`)
   - Certificates custom/ACME lifecycle (`/nodes/{node}/certificates/custom`, `/nodes/{node}/certificates/acme/certificate`)
   - SDN IPAM lifecycle (`/cluster/sdn/ipams*`)
- Wave 8 read wrappers now wired:
   - Node tasks read/status (`/nodes/{node}/tasks*`)
   - Cluster tasks read (`/cluster/tasks`)
   - Node task logs read (`/nodes/{node}/tasks/{upid}/log`)
   - Node firewall logs read (`/nodes/{node}/firewall/log`)
- Remaining major gaps after this implementation step:
   - HA policy/control surfaces beyond status (`/cluster/ha*`)
   - Ceph node-scope advanced operation cataloging per Proxmox version (`/nodes/{node}/ceph*`)
   - Higher-level node maintenance playbooks and orchestrated workflows (beyond typed log/read wrappers)

## Wave 4 — Network/Firewall/SDN completeness (1–2 sprints)

Status: Completed (core SDN + datacenter firewall wrappers)

Deliverables:
- Typed SDN model (zones/vnets/subnets/ipam)
- Firewall model (aliases/ipsets/rules/options) with ordering semantics
- Change-impact preflight (bridge edits, route impact)

Implemented in code:
- Shared spec + validation fields:
   - `proxmoxSdnZones`
   - `proxmoxSdnVnets`
   - `proxmoxSdnSubnets`
   - `proxmoxDatacenterFirewallAliases`
   - `proxmoxDatacenterFirewallIpsets`
   - `proxmoxDatacenterFirewallRules`
- Provider wrappers for:
   - `/cluster/sdn/zones*`
   - `/cluster/sdn/vnets*`
   - `/cluster/sdn/vnets/{vnet}/subnets*`
   - `/cluster/firewall/aliases*`
   - `/cluster/firewall/ipset*`
   - `/cluster/firewall/rules*`
- Planner/executor wiring and tests for these SDN/firewall resources
- Preflight checks for duplicate SDN/firewall declarations and safe delete constraints

Acceptance:
- End-to-end diff/apply for SDN + firewall with impact warnings.

## Wave 5 — VM/CT advanced lifecycle (2 sprints)

Status: Completed (core advanced VM/CT lifecycle wrappers)

Deliverables:
- Migration, backup/restore, snapshot policy, guest-agent typed actions
- Advanced hardware profile packs (PCI/NUMA/CPU policy)
- Task-progress streaming in CLI + extension

Implemented in code:
- Shared spec + validation fields:
   - `proxmoxVmMigrations`
   - `proxmoxCtMigrations`
   - `proxmoxVmBackups`
   - `proxmoxCtBackups`
   - `proxmoxVmRestores`
   - `proxmoxCtRestores`
   - `proxmoxVmSnapshots`
   - `proxmoxCtSnapshots`
   - `proxmoxVmGuestAgent`
- Provider wrappers for:
   - `/nodes/{node}/qemu/{vmid}/migrate`
   - `/nodes/{node}/lxc/{vmid}/migrate`
   - `/nodes/{node}/vzdump`
   - `/nodes/{node}/qemu` (restore path)
   - `/nodes/{node}/lxc` (restore path)
   - `/nodes/{node}/qemu/{vmid}/snapshot*`
   - `/nodes/{node}/lxc/{vmid}/snapshot*`
   - `/nodes/{node}/qemu/{vmid}/agent/{command}`
- Planner/executor wiring and tests for these advanced lifecycle resources
- Preflight checks for migration consistency and snapshot duplicate detection

Acceptance:
- Operational parity for day-2 VM/CT management workflows.

## Wave 6 — Storage & disks advanced lifecycle (1 sprint)

Status: Completed (core storage/disks advanced wrappers)

Deliverables:
- Storage content lifecycle, disk move/import/clone pipelines
- ZFS/LVM advanced operation wrappers + safety checks
- Capacity-aware planning hints

Implemented in code:
- Shared spec + validation fields:
   - `proxmoxStorageContent`
   - `proxmoxStorageContentCopy`
   - `proxmoxVmDiskMoves`
   - `proxmoxVmDiskImports`
   - `proxmoxVmDiskClones`
   - `proxmoxNodeDiskInitialize`
   - `proxmoxNodeLvmCreate`
   - `proxmoxNodeLvmThinCreate`
   - `proxmoxNodeZfsCreate`
- Provider wrappers for:
   - `/nodes/{node}/storage/{storage}/content/{volume}`
   - `/nodes/{node}/qemu/{vmid}/move_disk`
   - `/nodes/{node}/qemu/{vmid}/importdisk`
   - `/nodes/{node}/disks/initgpt`
   - `/nodes/{node}/disks/lvm`
   - `/nodes/{node}/disks/lvmthin`
   - `/nodes/{node}/disks/zfs`
- Planner/executor wiring and tests for Wave 6 actions
- Preflight checks for duplicate storage-content declarations and unknown-node storage/disk operations
- Capacity-aware planning hints on storage-target actions (move/import/clone/copy) when latest scan shows elevated usage
- UPID/task progress streaming (queued/running/exitstatus) for long-running Wave 5/6 node operations

Acceptance:
- Storage operations become first-class typed plans.

## Wave 7 — HA/DR + Ceph full lifecycle (2 sprints)

Status: Completed for currently verified cluster endpoint families (`/cluster/ha*`, `/cluster/ceph*`)

Deliverables:
- HA resources/groups/fencing orchestration
- Ceph role/pool/health/remediation wrappers
- DR runbooks with canary and staged apply

Acceptance:
- HA and Ceph can be managed safely with audited plans.

## Wave 8 — Platform UX/control plane (ongoing)

Status: In progress (read/control-plane wrappers shipped, UX orchestration still ongoing)

Deliverables:
- Extension forms for each domain (access, datacenter, node, SDN/firewall, VM/CT)
- Generated desired-spec snippets from scanned state
- Audit dashboard and compliance checks

Acceptance:
- AWS-like operator UX from VS Code without hand-editing payloads.

---

## 4) Engineering standards for each wave

For every new endpoint family:
1. Add typed contract in shared types + validation schema.
2. Add provider wrapper method (no direct raw payload in planner).
3. Add diff-aware planner entries and action ordering.
4. Add executor mapping + rollback strategy.
5. Add tests:
   - planner generation
   - executor dispatch
   - payload serialization
6. Update docs and sample desired spec.

---

## 5) Immediate next actions (recommended)

1. Add CLI command `naasctl api-discover --profile <name>` to export available paths via API/pvesh-compatible map for the running Proxmox version.
2. Generate endpoint compatibility matrix per cluster version and keep it in `state/` snapshots.
3. Add typed wrappers for version-dependent node Ceph families when detected (`/nodes/{node}/ceph*`).
4. Implement operator runbooks for maintenance workflows (drain/reboot/cert rotation/rollback) with staged apply.

---

## 6) Notes on “ALL APIs” reality

Proxmox API surface evolves by major version; exact endpoint sets can differ. This plan is complete by capability domain and designed to converge safely to full coverage using typed wrappers + controlled generic CRUD fallback.
