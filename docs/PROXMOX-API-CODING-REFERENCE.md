# Proxmox API Coding Reference (NAAS)

Last updated: 2026-02-19

See full gap audit + implementation roadmap: `docs/PROXMOX-API-GAP-AUDIT-AND-PLAN.md`.

## Official sources

- Proxmox VE API overview: https://pve.proxmox.com/wiki/Proxmox_VE_API
- API viewer root: https://pve.proxmox.com/pve-docs/api-viewer/index.html
- `pvesh` manual (maps directly to API): https://pve.proxmox.com/pve-docs/pvesh.1.html

## Core API conventions (from official docs)

- Base URL: `https://<host>:8006/api2/json`
- Auth:
  - Ticket + CSRF header for write operations (POST/PUT/DELETE)
  - API token header: `Authorization: PVEAPIToken=<USER@REALM!TOKENID>=<SECRET>`
- API tokens do not require CSRF for POST/PUT/DELETE
- Data format: JSON (`data` envelope)
- Stability: compatible within same major version; check after major upgrades

## How to discover/verify endpoints quickly

On a Proxmox node as root:

```bash
pvesh ls /
pvesh ls /nodes
pvesh ls /nodes/<node>
pvesh usage /nodes/<node>/network --command get -v
pvesh usage /cluster/options --command set -v
```

Use this to confirm exact parameters for your running Proxmox version before coding endpoint-specific payloads.

## NAAS current API coverage

### Implemented now

- Compute VM/LXC lifecycle + create/update/delete
- Network/storage create/update/delete
- Datacenter generic CRUD (`proxmoxDatacenterCrud`)
- Node generic CRUD (`proxmoxNodeCrud`)
- IAM-style access management:
  - Users
  - API tokens
  - ACL bindings
  - Roles
  - Groups
  - Realms
  - TFA
- Datacenter typed governance (Wave 2):
  - Cluster options
  - Pools
  - Backup jobs
  - Replication jobs
  - Datacenter firewall options
- Node typed operations (Wave 3):
  - DNS, hosts, node options, time
  - Services actions
  - APT actions
  - Certificate scoped requests
- Network/Firewall typed operations (Wave 4):
  - SDN zones, vnets, subnets
  - Datacenter firewall aliases, ipsets, rules
- VM/CT advanced lifecycle typed operations (Wave 5):
  - VM/CT migration
  - VM/CT backup + restore
  - VM/CT snapshot policy actions
  - VM guest-agent commands
- Storage/disks advanced typed operations (Wave 6):
  - Storage content deletion lifecycle
  - Storage content copy/export lifecycle
  - VM disk move/import operations
  - VM disk clone operations (cross-VM target)
  - Node disk initialize + LVM/LVM-thin/ZFS create actions
- Planner enrichment:
  - Capacity-aware hints are appended to plan reasons for move/import/clone/copy actions when latest scanned target storage usage is elevated
  - For long-running Wave 5/6 node operations, provider waits on UPID task status and streams `queued`/`running`/`exitstatus` progress into executor logs
- Generic CRUD safety guardrails:
  - Path allowlist/denylist for datacenter/node scopes
  - High-risk write confirmation payload (`confirm: I_UNDERSTAND`)
- Scan snapshots now include:
  - `datacenter`
  - `nodeAdmin`

### Key files in this repo

- Provider implementation: `packages/cli/src/providers/proxmox.ts`
- Planner mapping: `packages/cli/src/planner/planner.ts`
- Executor dispatch: `packages/cli/src/planner/executor.ts`
- Spec types/schema: `packages/shared/src/types.ts`, `packages/shared/src/validation.ts`

## Datacenter menu mapping (coding targets)

| Datacenter menu | Typical API path(s) | NAAS status |
|---|---|---|
| Summary | `/version`, `/cluster/status` | Read integrated |
| Cluster | `/cluster/*` | Generic CRUD ready |
| Ceph | `/cluster/ceph/*` | Generic CRUD ready |
| Options | `/cluster/options` | Generic CRUD ready |
| Storage | `/storage`, `/storage/<id>` | Specific + generic |
| Backup | `/cluster/backup` | Generic CRUD ready |
| Replication | `/cluster/replication` | Generic CRUD ready |
| Permissions / Users | `/access/users` | Specific + generic |
| Permissions / API Tokens | `/access/users/<userid>/token` | Specific + generic |
| Permissions / Groups | `/access/groups` | Generic CRUD ready |
| Permissions / Pools | `/pools` | Generic CRUD ready |
| Permissions / Roles | `/access/roles` | Specific + generic |
| Permissions / Realms | `/access/domains` | Generic CRUD ready |
| Permissions / ACL | `/access/acl` | Specific + generic |
| Two Factor | `/access/tfa` | Generic CRUD ready |

### Datacenter typed wrappers (Wave 2)

| Domain | Desired spec field | API family |
|---|---|---|
| Cluster options | `proxmoxClusterOptions` | `/cluster/options` |
| Pools | `proxmoxPools` | `/pools*` |
| Backup jobs | `proxmoxBackupJobs` | `/cluster/backup*` |
| Replication jobs | `proxmoxReplicationJobs` | `/cluster/replication*` |
| Datacenter firewall options | `proxmoxDatacenterFirewallOptions` | `/cluster/firewall/options` |

### SDN + firewall typed wrappers (Wave 4)

| Domain | Desired spec field | API family |
|---|---|---|
| SDN zones | `proxmoxSdnZones` | `/cluster/sdn/zones*` |
| SDN vnets | `proxmoxSdnVnets` | `/cluster/sdn/vnets*` |
| SDN subnets | `proxmoxSdnSubnets` | `/cluster/sdn/vnets/{vnet}/subnets*` |
| DC firewall aliases | `proxmoxDatacenterFirewallAliases` | `/cluster/firewall/aliases*` |
| DC firewall ipsets | `proxmoxDatacenterFirewallIpsets` | `/cluster/firewall/ipset*` |
| DC firewall rules | `proxmoxDatacenterFirewallRules` | `/cluster/firewall/rules*` |

### Access typed wrappers (Wave 1)

| Domain | Desired spec field | API family |
|---|---|---|
| Groups | `proxmoxGroups` | `/access/groups*` |
| Realms | `proxmoxRealms` | `/access/domains*` |
| TFA | `proxmoxTfa` | `/access/tfa*` |

## Node menu mapping (coding targets)

| Node menu | Typical API path(s) | NAAS status |
|---|---|---|
| System / Summary | `/nodes/<node>/status` | Read integrated |
| Network | `/nodes/<node>/network` | Specific + generic |
| Certificates | `/nodes/<node>/certificates/*` | Generic CRUD ready |
| DNS | `/nodes/<node>/dns` | Generic CRUD ready |
| Hosts | `/nodes/<node>/hosts` | Generic CRUD ready |
| Options | `/nodes/<node>/config` | Generic CRUD ready |
| Time | `/nodes/<node>/time` | Generic CRUD ready |
| System Log | `/nodes/<node>/syslog` | Read integrated |
| Updates | `/nodes/<node>/apt/*` | Generic CRUD ready |
| Repositories | `/nodes/<node>/apt/repositories` | Generic CRUD ready |
| Firewall | `/nodes/<node>/firewall/*` | Generic CRUD ready |
| Disks / List | `/nodes/<node>/disks/list` | Read integrated |
| Disks / LVM | `/nodes/<node>/disks/lvm` | Read integrated |
| Disks / LVM-Thin | `/nodes/<node>/disks/lvmthin` | Read integrated |
| Disks / Directory | `/nodes/<node>/disks/directory` | Read integrated |
| Disks / ZFS | `/nodes/<node>/disks/zfs` | Read integrated |

### Node typed wrappers (Wave 3)

| Domain | Desired spec field | API family |
|---|---|---|
| DNS | `proxmoxNodeDns` | `/nodes/{node}/dns` |
| Hosts | `proxmoxNodeHosts` | `/nodes/{node}/hosts` |
| Node options | `proxmoxNodeOptions` | `/nodes/{node}/config` |
| Time | `proxmoxNodeTime` | `/nodes/{node}/time` |
| Services | `proxmoxNodeServices` | `/nodes/{node}/services/{service}/{action}` |
| APT | `proxmoxNodeApt` | `/nodes/{node}/apt/{update|upgrade}` |
| Certificates | `proxmoxNodeCertificates` | `/nodes/{node}/certificates*` |

### VM/CT advanced typed wrappers (Wave 5)

| Domain | Desired spec field | API family |
|---|---|---|
| VM migrations | `proxmoxVmMigrations` | `/nodes/{node}/qemu/{vmid}/migrate` |
| CT migrations | `proxmoxCtMigrations` | `/nodes/{node}/lxc/{vmid}/migrate` |
| VM backups | `proxmoxVmBackups` | `/nodes/{node}/vzdump` |
| CT backups | `proxmoxCtBackups` | `/nodes/{node}/vzdump` |
| VM restores | `proxmoxVmRestores` | `/nodes/{node}/qemu` |
| CT restores | `proxmoxCtRestores` | `/nodes/{node}/lxc` |
| VM snapshots | `proxmoxVmSnapshots` | `/nodes/{node}/qemu/{vmid}/snapshot*` |
| CT snapshots | `proxmoxCtSnapshots` | `/nodes/{node}/lxc/{vmid}/snapshot*` |
| VM guest-agent | `proxmoxVmGuestAgent` | `/nodes/{node}/qemu/{vmid}/agent/{command}` |

### Storage/disks advanced typed wrappers (Wave 6)

| Domain | Desired spec field | API family |
|---|---|---|
| Storage content delete | `proxmoxStorageContent` | `/nodes/{node}/storage/{storage}/content/{volume}` |
| Storage content copy/export | `proxmoxStorageContentCopy` | `/nodes/{node}/storage/{storage}/content/{volume}` |
| VM disk move | `proxmoxVmDiskMoves` | `/nodes/{node}/qemu/{vmid}/move_disk` |
| VM disk import | `proxmoxVmDiskImports` | `/nodes/{node}/qemu/{vmid}/importdisk` |
| VM disk clone | `proxmoxVmDiskClones` | `/nodes/{node}/qemu/{vmid}/move_disk` (with `target-vmid`) |
| Node disk initialize | `proxmoxNodeDiskInitialize` | `/nodes/{node}/disks/initgpt` |
| Node LVM create | `proxmoxNodeLvmCreate` | `/nodes/{node}/disks/lvm` |
| Node LVM-thin create | `proxmoxNodeLvmThinCreate` | `/nodes/{node}/disks/lvmthin` |
| Node ZFS create | `proxmoxNodeZfsCreate` | `/nodes/{node}/disks/zfs` |

### HA/Ceph typed wrappers (Wave 7 increment)

| Domain | Desired spec field | API family |
|---|---|---|
| HA group lifecycle | `proxmoxHaGroups` | `/cluster/ha/groups` |
| HA resource lifecycle | `proxmoxHaResources` | `/cluster/ha/resources` |
| HA rule lifecycle | `proxmoxHaRules` | `/cluster/ha/rules` |
| Ceph flag set/clear | `proxmoxCephFlags` | `/cluster/ceph/flags/{flag}` |

### Node firewall/certs + SDN IPAM typed wrappers (Wave 7 completion)

| Domain | Desired spec field | API family |
|---|---|---|
| Node firewall options | `proxmoxNodeFirewallOptions` | `/nodes/{node}/firewall/options` |
| Node firewall rules | `proxmoxNodeFirewallRules` | `/nodes/{node}/firewall/rules` |
| Node custom cert lifecycle | `proxmoxNodeCertificateCustom` | `/nodes/{node}/certificates/custom` |
| Node ACME cert lifecycle | `proxmoxNodeCertificateAcme` | `/nodes/{node}/certificates/acme/certificate` |
| SDN IPAM lifecycle | `proxmoxSdnIpams` | `/cluster/sdn/ipams` |

### Task read wrappers (Wave 8)

| Domain | Desired spec field | API family |
|---|---|---|
| Node task list/status | `proxmoxNodeTasks` | `/nodes/{node}/tasks*` |
| Cluster tasks list | `proxmoxClusterTasks` | `/cluster/tasks` |
| Node task log read | `proxmoxNodeTaskLogs` | `/nodes/{node}/tasks/{upid}/log` |
| Node firewall log read | `proxmoxNodeFirewallLogs` | `/nodes/{node}/firewall/log` |

### HA/Ceph read wrappers (Wave 8 increment)

| Domain | Desired spec field | API family |
|---|---|---|
| HA status read | `proxmoxHaStatus` | `/cluster/ha/status` |
| Ceph read surfaces | `proxmoxCephRead` | `/cluster/ceph`, `/cluster/ceph/status`, `/cluster/ceph/metadata`, `/cluster/ceph/flags` |
| Node Ceph read surfaces | `proxmoxNodeCephRead` | `/nodes/{node}/ceph*` (version-dependent) |

### Node Ceph maintenance wrappers (Wave 9 increment)

| Domain | Desired spec field | API family |
|---|---|---|
| Node Ceph write/maintenance | `proxmoxNodeCephActions` | `/nodes/{node}/ceph*` (version-dependent) |

Safety policy:
- Every `proxmoxNodeCephActions` write operation requires `confirm: I_UNDERSTAND`.
- Runtime endpoint capability detection is performed before request execution.

## Verified pending endpoint families (official API docs)

Latest verification against `api-viewer/apidoc.js` confirms the following families exist and remain high-priority gaps for additional typed wrappers:

- HA/DR: advanced policy and control surfaces beyond current lifecycle/status wrappers
- Ceph: node-scope write/maintenance surfaces beyond current read wrappers
- Node firewall: advanced semantics beyond current options/rules/log wrappers
- Tasks: orchestration/playbooks beyond current task read/log wrappers
- Certificates lifecycle: additional ACME/account workflows beyond typed cert upsert/delete
- SDN IPAM: status/metrics surfaces beyond lifecycle CRUD

## Desired spec patterns to use now

### Datacenter generic CRUD

```yaml
proxmoxDatacenterCrud:
  - method: read
    path: /access/users
  - method: update
    path: /cluster/options
    payload:
      keyboard: fr
  - method: delete
    path: /access/users/legacy@pve
    payload:
      confirm: I_UNDERSTAND
```

### Node generic CRUD

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
```

### Access typed spec examples

```yaml
proxmoxGroups:
  - groupId: naas-group
    users:
      - naas@pve

proxmoxRealms:
  - realm: naas-realm
    type: openid
    options:
      issuer-url: https://issuer.example

proxmoxTfa:
  - userId: naas@pve
    type: totp
    value: BASE32SECRET
```

### Datacenter governance typed spec examples

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

### SDN + datacenter firewall typed spec examples

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

### Node system typed spec examples

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

### VM/CT advanced lifecycle typed spec examples

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

## API-doc delta verification (official)

Verified from official API viewer assets (`index.html` + `apidoc.js`) and `pvesh(1)`:

- Phase 2 families present: `/cluster/options`, `/cluster/backup`, `/cluster/replication`, `/cluster/firewall/options`, `/pools`
- Phase 3 families present: `/nodes/{node}/dns`, `/nodes/{node}/hosts`, `/nodes/{node}/config`, `/nodes/{node}/time`, `/nodes/{node}/services`, `/nodes/{node}/apt`, `/nodes/{node}/certificates`
- Wave 4 families present: `/cluster/sdn/zones`, `/cluster/sdn/vnets`, `/cluster/sdn/vnets/{vnet}/subnets`, `/cluster/firewall/aliases`, `/cluster/firewall/ipset`, `/cluster/firewall/rules`
- Wave 5 families present: `/nodes/{node}/qemu/{vmid}/migrate`, `/nodes/{node}/lxc/{vmid}/migrate`, `/nodes/{node}/vzdump`, `/nodes/{node}/qemu/{vmid}/snapshot`, `/nodes/{node}/lxc/{vmid}/snapshot`, `/nodes/{node}/qemu/{vmid}/agent`, `/nodes/{node}/qemu`, `/nodes/{node}/lxc`

## Next coding priorities (recommended)
1. Add typed node firewall/repositories lifecycle (node scope)
2. Add node maintenance/reboot playbooks with sequencing guards
3. Add SDN IPAM deeper object model + drift-aware reconciliation
4. Add extension UI forms for Phase 2/3/4/5 typed resources
