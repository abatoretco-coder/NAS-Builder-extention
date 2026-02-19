# NAAS Toolkit Setup Guide (Extension + naasctl)

For endpoint-level Proxmox API coding and roadmap reference, see `docs/PROXMOX-API-CODING-REFERENCE.md`.

This guide gives copy/paste instructions to install, configure, and use:

- VS Code extension: **NAAS Toolkit**
- Companion CLI: **naasctl**

NAAS Toolkit is standalone and works in any VS Code window, including **empty windows** (no folder open).

---

## 1) Prerequisites

## 1.1 Supported platform versions

- OS: Windows 10/11, macOS 13+, Linux (modern distro)
- Node.js: 20+
- pnpm: 9+
- VS Code: 1.90+

Check versions:

### Windows (PowerShell)

```powershell
node -v
pnpm -v
code --version
```

### macOS/Linux (bash/zsh)

```bash
node -v
pnpm -v
code --version
```

Expected output:
- Node version starts with `v20` or newer.
- `pnpm` command resolves.
- VS Code version is 1.90+.

## 1.2 Proxmox token requirements (minimum guidance)

Use API token auth when possible.

Recommended setup:
- Create a dedicated service account per environment (for example `naas-preprod`, `naas-prod`).
- Create one API token per account.
- Grant only required permissions for scan + lifecycle actions.

Minimum capabilities for MVP actions:
- Read/list nodes, QEMU VMs, LXC CTs and configs.
- Start/stop/reboot VM/CT.
- Create QEMU snapshots before risky actions.

If permissions are too narrow, scans may be partial and actions may fail with `401/403`.

## 1.2.1 Proxmox IAM management from desired spec (new)

`naasctl` can now manage Proxmox access administration directly from YAML:

- users (`proxmoxUsers`)
- API tokens (`proxmoxTokens`)
- custom roles (`proxmoxRoles`)
- ACL bindings (`proxmoxAcls`)

Example:

```yaml
proxmoxUsers:
  - userId: naas@pve
    comment: NAAS service account
    enabled: true

proxmoxTokens:
  - userId: naas@pve
    tokenId: naasctl
    privilegeSeparation: false

proxmoxRoles:
  - roleId: NAASAdmin
    privs:
      - VM.Allocate
      - VM.Config.CPU
      - VM.Config.Memory
      - VM.PowerMgmt

proxmoxAcls:
  - path: /
    roleId: NAASAdmin
    userId: naas@pve
    propagate: true
```

For deletions, set `ensure: absent` on any IAM entry.

## 1.2.2 Generic Datacenter CRUD from desired spec (AWS-style)

For advanced administration across Datacenter menus, use `proxmoxDatacenterCrud`.
Each entry maps directly to a Proxmox API path and method:

- `create` -> HTTP POST
- `read` -> HTTP GET
- `update` -> HTTP PUT
- `delete` -> HTTP DELETE

Example:

```yaml
proxmoxDatacenterCrud:
  - method: create
    path: /access/groups
    payload:
      groupid: naas-group
      comment: Managed by NAAS

  - method: read
    path: /access/users

  - method: update
    path: /cluster/options
    payload:
      keyboard: fr

  - method: delete
    path: /access/groups/naas-group
    payload:
      confirm: I_UNDERSTAND
```

This gives full Datacenter automation flexibility without waiting for a dedicated schema per menu.

Safety note:
- High-risk generic CRUD write operations require `payload.confirm: I_UNDERSTAND`.

## 1.2.4 Typed Datacenter governance (Phase 2)

For common governance menus, prefer typed spec blocks over raw generic CRUD:

- `proxmoxClusterOptions`
- `proxmoxPools`
- `proxmoxBackupJobs`
- `proxmoxReplicationJobs`
- `proxmoxDatacenterFirewallOptions`

Example:

```yaml
proxmoxClusterOptions:
  options:
    keyboard: fr

proxmoxPools:
  - poolId: naas-pool
    users:
      - naas@pve

proxmoxBackupJobs:
  - id: backup-naas
    storage: pbs
    schedule: daily

proxmoxReplicationJobs:
  - id: rep-naas
    source: local-lvm:100
    target: remote-lvm:100
    schedule: '*/15'

proxmoxDatacenterFirewallOptions:
  options:
    enable: 1
```

## 1.2.3 Proxmox node CRUD (System/Network/Disks/Firewall...)

Node-level automation is available with `proxmoxNodeCrud`.
Each operation targets one node and a node-relative path:

- `create` -> POST `/nodes/{node}{path}`
- `read` -> GET `/nodes/{node}{path}`
- `update` -> PUT `/nodes/{node}{path}`
- `delete` -> DELETE `/nodes/{node}{path}`

Example:

```yaml
proxmoxNodeCrud:
  - method: read
    node: proxmox
    path: /network

  - method: update
    node: proxmox
    path: /dns
    payload:
      search: lan

  - method: create
    node: proxmox
    path: /firewall/rules
    payload:
      action: ACCEPT
      type: in
      iface: vmbr0

  - method: delete
    node: proxmox
    path: /firewall/rules/0
```

`scan` now also captures node admin sections in `nodeAdmin` (System/Network/Certificates/DNS/Hosts/Options/Time/Logs/Updates/Repositories/Firewall/Disks).

## 1.2.5 Typed Node system operations (Phase 3)

For frequent node admin operations, prefer typed blocks instead of generic node CRUD:

- `proxmoxNodeDns`
- `proxmoxNodeHosts`
- `proxmoxNodeOptions`
- `proxmoxNodeTime`
- `proxmoxNodeServices`
- `proxmoxNodeApt`
- `proxmoxNodeCertificates`

Example:

```yaml
proxmoxNodeDns:
  - node: proxmox
    options:
      search: lan

proxmoxNodeServices:
  - node: proxmox
    service: pveproxy
    action: restart

proxmoxNodeApt:
  - node: proxmox
    action: update

proxmoxNodeCertificates:
  - node: proxmox
    method: read
    path: /certificates/info
```

Note:
- `proxmoxNodeCertificates.path` must start with `/certificates` (preflight enforced).

## 1.2.6 Typed SDN + Datacenter Firewall operations (Wave 4)

For network governance, prefer typed SDN/firewall blocks over raw datacenter CRUD:

- `proxmoxSdnZones`
- `proxmoxSdnVnets`
- `proxmoxSdnSubnets`
- `proxmoxDatacenterFirewallAliases`
- `proxmoxDatacenterFirewallIpsets`
- `proxmoxDatacenterFirewallRules`

Example:

```yaml
proxmoxSdnZones:
  - zone: zone-a
    type: simple

proxmoxSdnVnets:
  - vnet: vnet100
    zone: zone-a
    tag: 100

proxmoxSdnSubnets:
  - vnet: vnet100
    subnet: 10.10.100.0/24
    gateway: 10.10.100.1

proxmoxDatacenterFirewallAliases:
  - name: lan-net
    cidr: 10.10.0.0/16

proxmoxDatacenterFirewallIpsets:
  - name: trusted

proxmoxDatacenterFirewallRules:
  - action: ACCEPT
    type: in
    source: +trusted
    pos: 0
```

Note:
- For `ensure: absent` on `proxmoxDatacenterFirewallRules`, provide `id`.

## 1.2.7 Typed VM/CT advanced lifecycle (Wave 5)

For day-2 VM/CT operations, use typed lifecycle blocks:

- `proxmoxVmMigrations` / `proxmoxCtMigrations`
- `proxmoxVmBackups` / `proxmoxCtBackups`
- `proxmoxVmRestores` / `proxmoxCtRestores`
- `proxmoxVmSnapshots` / `proxmoxCtSnapshots`
- `proxmoxVmGuestAgent`

Example:

```yaml
proxmoxVmMigrations:
  - node: proxmox
    vmid: 100
    target: proxmox2
    online: true

proxmoxVmBackups:
  - node: proxmox
    vmid: 100
    storage: pbs

proxmoxVmSnapshots:
  - node: proxmox
    vmid: 100
    name: daily

proxmoxVmGuestAgent:
  - node: proxmox
    vmid: 100
    command: ping
```

## 1.2.8 Typed storage/disks advanced lifecycle (Wave 6)

For storage content and advanced disk/node-disk workflows, use:

- `proxmoxStorageContent`
- `proxmoxStorageContentCopy`
- `proxmoxVmDiskMoves`
- `proxmoxVmDiskImports`
- `proxmoxVmDiskClones`
- `proxmoxNodeDiskInitialize`
- `proxmoxNodeLvmCreate`
- `proxmoxNodeLvmThinCreate`
- `proxmoxNodeZfsCreate`

Example:

```yaml
proxmoxStorageContent:
  - node: proxmox
    storage: local-lvm
    volume: vm-100-disk-0

proxmoxStorageContentCopy:
  - node: proxmox
    storage: local-lvm
    volume: vm-100-disk-0
    targetStorage: archive

proxmoxVmDiskMoves:
  - node: proxmox
    vmid: 100
    disk: scsi0
    targetStorage: fast-ssd
    deleteSource: true

proxmoxVmDiskImports:
  - node: proxmox
    vmid: 100
    source: /var/lib/vz/images/imports/vm100.qcow2
    storage: local-lvm
    format: qcow2

proxmoxVmDiskClones:
  - node: proxmox
    vmid: 100
    disk: scsi0
    targetStorage: fast-ssd
    targetVmid: 101
    targetDisk: scsi1
    format: qcow2

proxmoxNodeDiskInitialize:
  - node: proxmox
    disk: /dev/sdb

proxmoxNodeLvmCreate:
  - node: proxmox
    name: vg-data
    device: /dev/sdb

proxmoxNodeLvmThinCreate:
  - node: proxmox
    volumeGroup: vg-data
    name: thin-data

proxmoxNodeZfsCreate:
  - node: proxmox
    name: zpool-data
    devices:
      - /dev/sdc
    raidLevel: raid0
```

## 1.3 Docker access requirements

Supported access patterns:
- Local Docker socket (Linux/macOS): `unix:///var/run/docker.sock`
- Windows Docker Desktop / engine endpoint
- Remote host via `DOCKER_HOST` (TCP or SSH-style context)

Common requirement:
- The account running `naasctl` must have permission to list containers/images/networks/volumes and run `docker compose up -d` for managed compose paths.

## 1.4 Optional Grafana requirements

Optional but supported:
- Grafana API token with read access for dashboards/datasources and health/validation endpoint.
- For API management (`grafanaCrud`), token must also have write scopes for targeted resources.
- If Prometheus validation is configured in your desired spec, ensure datasource is available.

Recommended:
- Use service-account token auth.
- Define org scoping explicitly when needed (`orgId` -> `X-Grafana-Org-Id`).

If Grafana is not configured, validation is skipped gracefully.

### 1.4.1 Grafana API management (universal mode)

`naasctl` supports broad Grafana HTTP API automation via `grafanaCrud`.

Supported methods:
- legacy aliases: `create`, `read`, `update`, `delete`
- raw HTTP methods: `get`, `post`, `put`, `patch`, `delete`, `head`, `options`

Supported request fields per operation:
- `path`
- `payload` (legacy/simple request body or query)
- `query`
- `body`
- `headers`
- `orgId`
- `reason`

Example:

```yaml
grafanaCrud:
  - method: read
    path: /api/search
    payload:
      query: infra

  - method: patch
    path: /api/teams/1
    query:
      force: true
    body:
      name: sre-team
      confirm: I_UNDERSTAND
    headers:
      X-Custom-Trace: naas
    orgId: 2
```

Safety notes:
- Only `/api` and `/apis` path prefixes are allowed.
- Some admin segments are blocked by policy (`/admin/provisioning`, `/admin/settings`).
- High-risk write operations require explicit confirmation (`confirm: I_UNDERSTAND`).

### 1.4.2 Grafana typed folders and dashboards

For common dashboard lifecycle, prefer typed blocks over raw `grafanaCrud`:

- `grafanaFolders`
- `grafanaDashboards`

Example:

```yaml
grafanaFolders:
  - uid: ops
    title: Ops

  - uid: legacy
    title: Legacy
    ensure: absent

grafanaDashboards:
  - uid: ops-overview
    title: Ops Overview
    folderUid: ops
    overwrite: true
    dashboard:
      title: Ops Overview
      tags:
        - naas

  - uid: old-dashboard
    ensure: absent
```

Preflight rules:
- `grafanaFolders` with `ensure: absent` must provide `uid`.
- folder UID/title duplicates are rejected.
- dashboard UID duplicates are rejected.

### 1.4.3 Grafana typed alerting, datasources, teams and service accounts

Additional typed blocks supported:

- `grafanaAlertRuleGroups`
- `grafanaContactPoints`
- `grafanaNotificationPolicies`
- `grafanaDatasources`
- `grafanaTeams`
- `grafanaTeamMemberships`
- `grafanaServiceAccounts`
- `grafanaServiceAccountTokens`

Example:

```yaml
grafanaAlertRuleGroups:
  - folderUid: ops
    group: infra-alerts
    intervalSeconds: 60
    rules:
      - title: CPU High

grafanaContactPoints:
  - uid: cp-email
    name: email-main
    type: email
    settings:
      addresses: sre@example.com

grafanaNotificationPolicies:
  - policyTree:
      receiver: email-main
    confirm: I_UNDERSTAND

grafanaDatasources:
  - uid: ds-prom
    name: Prometheus
    type: prometheus
    url: http://prometheus:9090

grafanaTeams:
  - name: sre

grafanaTeamMemberships:
  - teamId: 12
    userIds: [101, 102]
    mode: replace
    confirm: I_UNDERSTAND

grafanaServiceAccounts:
  - name: naas-sa
    role: Editor

grafanaServiceAccountTokens:
  - serviceAccountId: 33
    name: naas-token
    secondsToLive: 3600
```

Safety notes:
- Notification policy replacement requires `confirm: I_UNDERSTAND`.
- Team membership `mode: replace` requires `confirm: I_UNDERSTAND`.
- Typed delete operations require their target identifiers (`uid`, `id`, `tokenId`) in desired spec.

---

## 2) Installation

## 2.1 Install extension from VSIX (local build)

1. Build extension package:

### Windows (PowerShell)

```powershell
pnpm install
pnpm --filter naas-toolkit build
pnpm --filter naas-toolkit package
```

### macOS/Linux

```bash
pnpm install
pnpm --filter naas-toolkit build
pnpm --filter naas-toolkit package
```

2. In VS Code:
- Open Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`)
- Click `...` (top-right)
- Select **Install from VSIX...**
- Choose generated `.vsix` under `packages/vscode-extension`

Expected output:
- Extension appears as installed.
- `NAAS` icon appears in Activity Bar.

## 2.2 Install extension from Marketplace (if published)

1. Open Extensions panel.
2. Search for **NAAS Toolkit**.
3. Click **Install**.

Expected output:
- Same UI experience as VSIX install.

## 2.3 Install/use CLI (`naasctl`)

NAAS Toolkit supports:

- **Option A (preferred)**: bundled CLI shipped inside extension package.
- **Option B**: external `naasctl` available on `PATH`.
- **Option C**: explicit CLI path via setting `naas.cliPath`.

Set explicit path if needed:

- VS Code Settings → search `naas.cliPath`
- Example values:
  - Windows: `C:\\tools\\naasctl\\naasctl.exe`
  - macOS/Linux: `/usr/local/bin/naasctl`

Expected output:
- Commands such as `NAAS: Scan Infrastructure` run without `CLI not found` errors.

---

## 3) First-time configuration (profiles like AWS)

## 3.1 Create global profiles file

Location:
- Default: `~/.naas/profiles.yaml`
- Customizable by setting `naas.profilesPath`

Example:

```yaml
defaultProfile: preprod
profiles:
  - name: preprod
    proxmox:
      endpoint: https://proxmox-preprod.local:8006
      authRef: proxmox-preprod
    docker:
      host: unix:///var/run/docker.sock
    grafana:
      endpoint: https://grafana-preprod.local
      authRef: grafana-preprod
    stateDir: ~/.naas/state/preprod

  - name: prod
    proxmox:
      endpoint: https://proxmox-prod.local:8006
      authRef: proxmox-prod
    docker:
      host: tcp://10.0.0.12:2375
    grafana:
      endpoint: https://grafana-prod.local
      authRef: grafana-prod
    stateDir: ~/.naas/state/prod
```

Expected output:
- `NAAS: Select Profile` lists your profiles.

## 3.2 Add credentials securely

1. Run Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Execute:

```text
NAAS: Add/Update Credentials
```

3. Enter relevant credentials for the active profile:
- Proxmox token ID + secret (preferred)
- or Proxmox username/password (fallback)
- Grafana token (optional)

Secrets are stored in VS Code **SecretStorage** only.

Expected output:
- Notification confirming credentials were updated.

## 3.3 State and log locations

Default state path per profile:
- `~/.naas/state/<profile>`

Change state path:
- Set `stateDir` in the profile entry.

Logs:
- Open with command:

```text
NAAS: Open Logs
```

Expected output:
- OS file browser opens extension log directory.

---

## 4) Workspace overrides

You can override global profile behavior per workspace.

## 4.1 Override via `.vscode/naas.yaml`

Create file in project:

```yaml
activeProfile: preprod
profileOverrides:
  preprod:
    docker:
      host: tcp://127.0.0.1:2375
```

Use case:
- Keep global profile endpoints, but adjust one workspace to use local Docker endpoint.

## 4.2 Override via `.vscode/settings.json`

Example:

```json
{
  "naas.activeProfile": "prod",
  "naas.profileOverrides": {
    "prod": {
      "docker": {
        "host": "tcp://10.10.0.20:2375"
      }
    }
  }
}
```

## 4.3 Multi-root behavior

Resolution rule:
1. If `naas.workspaceFolder` is set, extension uses that folder by name.
2. Otherwise, extension uses the first folder in the multi-root workspace.
3. If no folder is open, extension uses **global profile only**.

Expected output:
- Status bar profile and command results reflect selected folder context.

---

## 5) Usage walkthrough (UI + CLI)

## 5.1 Select profile

UI path:
- Command Palette → `NAAS: Select Profile`

Checkpoint:
- Status bar updates to `NAAS <profile>`.

## 5.2 Scan infrastructure

UI path:
- Command Palette → `NAAS: Scan Infrastructure`

Checkpoint:
- NAAS Activity Bar tree populates:
  - Profiles
  - Proxmox: Nodes → VMs → CTs
  - Docker: Hosts → Compose Projects → Containers
  - Observability: Dashboards

## 5.3 Generate a plan

UI path:
- Command Palette → `NAAS: Show Plan`

Checkpoint:
- Plan opens in Webview table with action list.

CLI equivalent:

```bash
naasctl plan --profile preprod --json
```

## 5.4 Apply plan (dry-run vs real apply)

UI apply:
- Command Palette → `NAAS: Apply Plan`
- Confirm modal dialog.

CLI dry-run:

```bash
naasctl apply --profile preprod --dry-run --json
```

CLI apply without prompt:

```bash
naasctl apply --profile preprod --yes --json
```

CLI validation:

```bash
naasctl validate --profile preprod --json
```

Checkpoint:
- Success/failure notification appears.
- Logs available via `NAAS: Open Logs`.

## 5.5 Validate (Grafana/Prometheus)

UI path:
- Command Palette → `NAAS: Validate (Grafana/Prometheus)`

Checkpoint:
- If Grafana configured: validation runs and returns status.
- If not configured: validation is skipped with informative message.

## 5.6 View logs and troubleshoot from UI

UI path:
- Command Palette → `NAAS: Open Logs`

Checkpoint:
- Log directory opens in OS explorer/finder.

---

## 6) Desired spec format (MVP)

Minimal `desired.yaml` example:

```yaml
vms:
  - vmid: 101
    desiredPower: running
  - vmid: 102
    desiredPower: stopped
    risky: true

composeProjects:
  - path: ./stacks/media
    ensure: running

validation:
  enabled: true
```

What fields mean:
- `vms[].desiredPower`: target power state (`running` or `stopped`)
- `vms[].risky: true`: treat action as risky; create snapshot before stop/reboot when supported
- `composeProjects[]`: ensure compose stacks are running (`docker compose up -d`)
- `validation.enabled`: run post-apply validation

How plan diff is computed (high-level):
1. Read current discovered state (`scan`).
2. Compare with desired spec.
3. Generate ordered actions:
   - Proxmox start/stop/reboot
   - Snapshot before risky operation
   - Docker compose redeploy
   - Optional validation

---

## 7) Troubleshooting & FAQ

## 7.1 Proxmox `401/403` token errors

Common causes:
- Wrong token ID/secret pair.
- Token bound to wrong user realm.
- Missing permission on node/VM/CT paths.

Actions:
- Re-run `NAAS: Add/Update Credentials`.
- Verify token in Proxmox UI.
- Test API manually (curl/Postman) with same token.

## 7.2 TLS / self-signed certificates

Symptoms:
- TLS handshake/certificate validation failures.

Safe options:
- Prefer valid internal CA certs.
- Use explicit trust configuration at infrastructure/OS level.
- Avoid disabling TLS verification globally.

## 7.3 Docker permission issues

Linux socket permissions:
- Ensure user can access `/var/run/docker.sock`.

Windows + WSL context:
- Verify active Docker context and engine endpoint.
- Ensure `DOCKER_HOST`/profile docker host points to reachable daemon.

## 7.4 CLI not found / wrong path

Actions:
1. Set `naas.cliPath` explicitly.
2. Confirm executable permissions.
3. Verify in terminal:

### Windows

```powershell
Get-Command naasctl
```

### macOS/Linux

```bash
which naasctl
```

## 7.5 Slow scan / timeout / cancellation

Actions:
- Increase `naas.cliTimeoutMs` in settings.
- Use command cancellation from progress notification when needed.
- Check logs for slow provider calls.

## 7.6 Where logs are and verbose mode

Open logs:

```text
NAAS: Open Logs
```

Verbose mode:
- `naasctl` supports `--verbose` on all commands.
- Combine with `--json` when you need machine-readable output plus detailed terminal diagnostics.

---

## 8) Security notes

- Never put secrets in YAML/config files.
- Store credentials only with `NAAS: Add/Update Credentials` (SecretStorage).
- Apply least privilege permissions for Proxmox/Grafana tokens.
- Use separate service accounts/tokens per profile (`preprod`, `prod`).
- Protect local files:
  - `~/.naas/profiles.yaml` should not contain secrets.
  - `~/.naas/state/*` may contain infrastructure metadata; restrict file permissions.
  - Extension logs may include operational details; handle as sensitive ops data.

---

## 9) Developer guide (brief)

## 9.1 Run extension in Extension Development Host

```powershell
pnpm install
pnpm --filter naas-toolkit build
```

Then open `packages/vscode-extension` in VS Code and press `F5`.

Expected output:
- New Extension Development Host window opens with NAAS Toolkit active.

## 9.2 Build/package VSIX

```powershell
pnpm --filter naas-toolkit package
```

Expected output:
- `.vsix` file generated under `packages/vscode-extension`.

## 9.3 Run CLI locally

```powershell
pnpm --filter @naas/cli build
pnpm --filter @naas/cli exec naasctl scan --profile preprod --json
pnpm --filter @naas/cli exec naasctl plan --profile preprod --json
pnpm --filter @naas/cli exec naasctl apply --profile preprod --dry-run --yes --json
pnpm --filter @naas/cli exec naasctl validate --profile preprod --json
```

If your standalone `naasctl` uses profile mode, equivalent commands are:

```bash
naasctl scan --profile preprod --json
naasctl plan --profile preprod --json
naasctl apply --profile preprod --dry-run --yes --json
naasctl validate --profile preprod --json
```

## 9.4 Run tests

```powershell
pnpm test
pnpm --filter naas-toolkit test
pnpm --filter @naas/cli test
```

Expected output:
- Test runner exits with code `0`.

---

## 10) Go-live checklist (VS Code + Proxmox NAS)

This section summarizes what is already implemented and what you still need to do to make the tool operational in your NAS environment.

### 10.1 What is already implemented

- CLI build/test pipeline is stable (`@naas/cli`, `@naas/shared`, `naas-toolkit` builds pass).
- Planner supports:
  - VM/CT create/update/delete
  - VM disk attach/resize
  - Network/storage create/update/delete actions
  - pre-flight checks before `plan` and `apply`
- Executor supports:
  - execution of infra + compute actions
  - dry-run mode
  - compensating rollback for create/start/attach paths when a later action fails

### 10.2 What YOU need to do now (required)

1. **Prepare Proxmox rights** for the service account/token used by NAAS:
   - VM lifecycle + config permissions
   - network management permissions
   - storage management permissions
2. **Create/verify profile file** (`~/.naas/profiles.yaml`) with correct endpoints and `stateDir`.
3. **Store credentials** via `NAAS: Add/Update Credentials` (do not put secrets in YAML).
4. **Run first full cycle** from a real workspace:

```powershell
pnpm --filter @naas/cli exec naasctl scan --profile preprod --json
pnpm --filter @naas/cli exec naasctl plan --profile preprod --json
pnpm --filter @naas/cli exec naasctl apply --profile preprod --dry-run --yes --json
pnpm --filter @naas/cli exec naasctl apply --profile preprod --yes --json
pnpm --filter @naas/cli exec naasctl validate --profile preprod --json
```

5. **Validate state files** under your `stateDir`:
   - `current.json`
   - `plan.json`
   - `result.json`
   - `apply-*.log.json`
  - `audit.jsonl`

### 10.3 Recommended NAS-focused desired spec (minimum)

Use a `desired.yaml` that includes all relevant layers:

- `networks`: bridge/vlan definitions used by VM/CT NICs
- `storage`: pools/datastores used by disks/rootfs
- `vmProvision` and/or `containerProvision`
- `vms` for explicit target power state
- optional `validation.enabled`

This ensures pre-flight and planner can detect ordering and drift correctly.

Ready-to-use template in this repo:

- `specs/nas.desired.yaml`

What you must replace in that file before first apply:

- `pve-node-1` with your real Proxmox node name
- `eno1` with your real network interface name
- VLAN tag values (`tag: 10`) with your LAN/VLAN design
- storage path (`/mnt/pve/nas-dir`) with an existing/desired Proxmox path
- SSH key placeholder (`REPLACE_WITH_YOUR_PUBLIC_KEY`)
- compose path (`./stacks/nas-observability`) if you use Docker stacks

How to activate this NAS spec for `preprod`:

1. Edit `configs/preprod.yaml`.
2. Set:

```yaml
desiredSpecPath: specs/nas.desired.yaml
```

3. Run:

```powershell
pnpm --filter @naas/cli exec naasctl scan --profile preprod --json
pnpm --filter @naas/cli exec naasctl plan --profile preprod --json
pnpm --filter @naas/cli exec naasctl apply --profile preprod --dry-run --yes --json
```

4. If plan looks good, run real apply:

```powershell
pnpm --filter @naas/cli exec naasctl apply --profile preprod --yes --json
```

### 10.4 How to collect required values in Proxmox (step-by-step)

Use this checklist to gather exactly the parameters needed for `specs/nas.desired.yaml`.

#### A) Find the Proxmox node name (`node`)

In Proxmox Web UI:

1. Open the left tree (Datacenter).
2. The top-level server entries are your nodes (for example `pve`, `pve1`, `node-a`).
3. Copy the exact node name (case-sensitive).

You will use it in:
- `networks[].node`
- `vmProvision[].node`
- `containerProvision[].node`

#### B) Find network bridge + physical interface (+ VLAN if any)

In Proxmox Web UI:

1. Click your node.
2. Open **System > Network**.
3. Identify:
  - existing bridge (often `vmbr0`)
  - physical NIC used by the bridge (for example `eno1`, `enp3s0`)
  - whether VLAN is used (column/flags around VLAN aware/tagging).

What to copy:
- bridge name (`vmbr0`, `vmbr1`, ...)
- physical interface (`eno1`, `enpXsY`, ...)
- VLAN tag if required (for example `10`, `20`, `100`), otherwise leave empty.

You will use it in:
- `networks[].name` (bridge)
- `networks[].bridge_ports` (physical interface)
- `vmProvision[].networks[].bridge`
- `vmProvision[].networks[].tag` (optional)
- `containerProvision[].networks[].bridge`
- `containerProvision[].networks[].tag` (optional)

#### C) Find storage/datastore name (`storage`)

In Proxmox Web UI:

1. Open **Datacenter > Storage**.
2. Note candidate storages (`local-lvm`, `local`, `zfs-pool`, `nas-dir`, ...).
3. Click one storage and check **Content** includes what you need:
  - for VM disks: `Disk image`
  - for CT rootfs: `Container`

What to copy:
- storage name (exactly as shown in Proxmox).

You will use it in:
- `storage[].name`
- `vmProvision[].disks[].storage`
- `containerProvision[].rootfs.storage`

#### D) Find free VMIDs (`vmid`)

In Proxmox Web UI:

1. In Datacenter search/filter VM/CT IDs currently used.
2. Pick two unused IDs (one for VM, one for CT), for example `510` and `610`.
3. Keep a gap strategy (for example 500-599 VM infra, 600-699 CT infra).

Alternative in shell (node):

```bash
pvesh get /cluster/nextid
```

Run twice (or reserve ranges manually) to avoid collisions.

#### E) (Optional) SSH public key for cloud-init

If you want key-based SSH access in `vmProvision.cloudInit.sshKeys`:

Windows PowerShell (if needed):

```powershell
Get-Content $env:USERPROFILE\.ssh\id_rsa.pub
```

Copy the full single-line key and replace `REPLACE_WITH_YOUR_PUBLIC_KEY`.

#### F) Permission checks before first apply

Your Proxmox token/user should have permissions for:

- VM lifecycle + VM config changes
- LXC lifecycle + config changes
- network management on target node
- storage management (if creating/updating storage)

If first `plan`/`apply` fails with `401/403`, fix ACL/role first, then retry.

#### G) Send values back in this exact format

Copy/fill and send:

```text
node: <your-node-name>
bridge: <vmbrX>
iface: <eno1-or-other>
vlan: <empty-or-number>
storage: <storage-name>
vmid_vm: <number>
vmid_ct: <number>
```

Then NAAS spec can be finalized for your exact environment.

### 10.5 Current known limits (so you can plan)

- Rollback is **best-effort**, not transactional across Proxmox tasks.
- Rollback is strongest for create/start/attach flows; update rollback is partial.
- VS Code UI commands are operational, but advanced infra editing remains primarily CLI-driven.
- If Proxmox API latency is high, increase `naas.cliTimeoutMs`.

---

## Appendix: quick file templates

## A. `.vscode/naas.yaml`

```yaml
activeProfile: preprod
profileOverrides:
  preprod:
    docker:
      host: tcp://127.0.0.1:2375
```

## B. `.vscode/settings.json`

```json
{
  "naas.activeProfile": "preprod",
  "naas.workspaceFolder": "infra-lab",
  "naas.cliTimeoutMs": 180000,
  "naas.profileOverrides": {
    "preprod": {
      "docker": {
        "host": "tcp://127.0.0.1:2375"
      }
    }
  }
}
```
