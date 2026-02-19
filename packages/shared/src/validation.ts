import { z } from 'zod';

// ============================================================================
// Base schemas
// ============================================================================

const ensureStateSchema = z.enum(['present', 'absent', 'running', 'stopped']).default('running');

// ============================================================================
// VM/Container provisioning schemas
// ============================================================================

const diskConfigSchema = z.object({
  interface: z.enum(['ide', 'sata', 'scsi', 'virtio']),
  index: z.number().int().min(0),
  storage: z.string().min(1),
  size: z.string().regex(/^\d+[TGKM]$/), // "50G", "1T", etc.
  format: z.enum(['raw', 'qcow2', 'vmdk']).optional(),
  cache: z.enum(['directsync', 'writethrough', 'writeback', 'unsafe', 'none']).optional(),
  discard: z.enum(['on', 'ignore']).optional(),
  ssd: z.boolean().optional(),
  iothread: z.boolean().optional()
});

const networkInterfaceConfigSchema = z.object({
  interface: z.literal('net'),
  index: z.number().int().min(0),
  model: z.enum(['virtio', 'e1000', 'rtl8139', 'vmxnet3']),
  bridge: z.string().min(1),
  vlan: z.number().int().min(1).max(4094).optional(),
  firewall: z.boolean().optional(),
  mac: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
  rate: z.number().positive().optional(),
  tag: z.number().int().min(1).max(4094).optional()
});

const ipConfigSchema = z.object({
  index: z.number().int().min(0),
  ip: z.string().min(1), // CIDR or "dhcp"
  gateway: z.string().optional(),
  ip6: z.string().optional(),
  gateway6: z.string().optional()
});

const cloudInitConfigSchema = z.object({
  user: z.string().optional(),
  password: z.string().optional(),
  sshKeys: z.array(z.string()).optional(),
  nameserver: z.string().optional(),
  searchdomain: z.string().optional(),
  upgrade: z.boolean().optional(),
  ciCustom: z.string().optional()
});

const bootConfigSchema = z.object({
  order: z.array(z.string()).optional(),
  bios: z.enum(['seabios', 'ovmf']).optional()
});

const cpuConfigSchema = z.object({
  cores: z.number().int().positive(),
  sockets: z.number().int().positive().optional(),
  type: z.string().optional(),
  limit: z.number().positive().optional(),
  units: z.number().int().positive().optional(),
  numa: z.boolean().optional()
});

const memoryConfigSchema = z.object({
  size: z.number().int().positive(),
  balloon: z.number().int().positive().optional(),
  shares: z.number().int().positive().optional()
});

const vmProvisionConfigSchema = z.object({
  name: z.string().min(1),
  vmid: z.number().int().positive(),
  node: z.string().min(1),
  ensure: ensureStateSchema.optional(),
  
  // Source
  template: z.union([z.number().int(), z.string()]).optional(),
  clone: z.object({
    source: z.number().int().positive(),
    full: z.boolean().optional(),
    pool: z.string().optional(),
    snapname: z.string().optional()
  }).optional(),
  
  // Compute
  cpu: cpuConfigSchema,
  memory: memoryConfigSchema,
  
  // Storage
  disks: z.array(diskConfigSchema),
  
  // Network
  networks: z.array(networkInterfaceConfigSchema),
  ipconfig: z.array(ipConfigSchema).optional(),
  
  // Cloud-init
  cloudInit: cloudInitConfigSchema.optional(),
  
  // Boot & BIOS
  boot: bootConfigSchema.optional(),
  
  // Options
  onboot: z.boolean().optional(),
  protection: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  ostype: z.string().optional(),
  agent: z.boolean().optional(),
  hotplug: z.string().optional()
});

const containerProvisionConfigSchema = z.object({
  name: z.string().min(1),
  vmid: z.number().int().positive(),
  node: z.string().min(1),
  ensure: ensureStateSchema.optional(),
  
  // Source
  ostemplate: z.string().min(1),
  
  // Compute
  cpu: z.object({
    cores: z.number().int().positive(),
    limit: z.number().positive().optional(),
    units: z.number().int().positive().optional()
  }).optional(),
  memory: z.object({
    size: z.number().int().positive(),
    swap: z.number().int().optional()
  }).optional(),
  
  // Storage
  rootfs: z.object({
    storage: z.string().min(1),
    size: z.string().regex(/^\d+[TGKM]$/)
  }),
  mountpoints: z.array(z.object({
    index: z.number().int().min(0),
    storage: z.string().min(1),
    size: z.string().regex(/^\d+[TGKM]$/).optional(),
    mp: z.string().min(1),
    acl: z.boolean().optional(),
    backup: z.boolean().optional(),
    quota: z.boolean().optional(),
    replicate: z.boolean().optional(),
    shared: z.boolean().optional()
  })).optional(),
  
  // Network
  networks: z.array(z.object({
    index: z.number().int().min(0),
    bridge: z.string().min(1),
    ip: z.string().optional(),
    gateway: z.string().optional(),
    ip6: z.string().optional(),
    gateway6: z.string().optional(),
    firewall: z.boolean().optional(),
    hwaddr: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
    tag: z.number().int().min(1).max(4094).optional(),
    rate: z.number().positive().optional()
  })),
  
  // Options
  onboot: z.boolean().optional(),
  protection: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  hostname: z.string().optional(),
  unprivileged: z.boolean().optional(),
  features: z.object({
    nesting: z.boolean().optional(),
    fuse: z.boolean().optional(),
    keyctl: z.boolean().optional(),
    mount: z.string().optional()
  }).optional()
});

const networkConfigSchema = z.object({
  name: z.string().min(1),
  node: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.enum(['bridge', 'bond', 'vlan']),
  
  // Bridge
  bridge_ports: z.string().optional(),
  bridge_vlan_aware: z.boolean().optional(),
  
  // VLAN
  vlan_id: z.number().int().min(1).max(4094).optional(),
  vlan_raw_device: z.string().optional(),
  
  // Bond
  bond_mode: z.enum(['balance-rr', 'active-backup', '802.3ad', 'balance-tlb', 'balance-alb']).optional(),
  slaves: z.array(z.string()).optional(),
  
  // IP
  cidr: z.string().optional(),
  gateway: z.string().optional(),
  
  // Options
  autostart: z.boolean().optional(),
  comments: z.string().optional()
});

const storageConfigSchema = z.object({
  name: z.string().min(1),
  node: z.string().optional(),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.enum(['dir', 'nfs', 'cifs', 'lvm', 'lvmthin', 'zfspool', 'btrfs']),
  
  // Common
  content: z.array(z.string()).optional(),
  
  // Directory
  path: z.string().optional(),
  
  // NFS
  server: z.string().optional(),
  export: z.string().optional(),
  
  // CIFS
  share: z.string().optional(),
  username: z.string().optional(),
  domain: z.string().optional(),
  
  // LVM
  vgname: z.string().optional(),
  
  // ZFS
  pool: z.string().optional(),
  blocksize: z.string().optional(),
  sparse: z.boolean().optional(),
  
  // Options
  maxfiles: z.number().int().optional(),
  prune_backups: z.string().optional(),
  shared: z.boolean().optional(),
  disable: z.boolean().optional(),
  nodes: z.array(z.string()).optional()
});

const proxmoxUserConfigSchema = z.object({
  userId: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  comment: z.string().optional(),
  enabled: z.boolean().optional(),
  expire: z.number().int().optional(),
  groups: z.array(z.string()).optional(),
  password: z.string().optional(),
  keys: z.string().optional()
});

const proxmoxTokenConfigSchema = z.object({
  userId: z.string().min(1),
  tokenId: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  comment: z.string().optional(),
  expire: z.number().int().optional(),
  enabled: z.boolean().optional(),
  privilegeSeparation: z.boolean().optional()
});

const proxmoxAclConfigSchema = z
  .object({
    path: z.string().min(1),
    roleId: z.string().min(1),
    userId: z.string().optional(),
    groupId: z.string().optional(),
    tokenId: z.string().optional(),
    propagate: z.boolean().optional(),
    ensure: z.enum(['present', 'absent']).optional()
  })
  .refine((value) => Boolean(value.userId || value.groupId || value.tokenId), {
    message: 'proxmoxAcl entry requires one of userId, groupId or tokenId'
  });

const proxmoxRoleConfigSchema = z.object({
  roleId: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  privs: z.array(z.string().min(1)).default([])
});

const proxmoxGroupConfigSchema = z.object({
  groupId: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  comment: z.string().optional(),
  users: z.array(z.string().min(1)).optional()
});

const proxmoxRealmConfigSchema = z.object({
  realm: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.string().optional(),
  comment: z.string().optional(),
  default: z.boolean().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxTfaConfigSchema = z.object({
  userId: z.string().min(1),
  id: z.string().optional(),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  value: z.string().optional(),
  enabled: z.boolean().optional()
});

const proxmoxClusterOptionsConfigSchema = z.object({
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxPoolConfigSchema = z.object({
  poolId: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  comment: z.string().optional(),
  users: z.array(z.string().min(1)).optional(),
  groups: z.array(z.string().min(1)).optional()
});

const proxmoxBackupJobConfigSchema = z.object({
  id: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  storage: z.string().optional(),
  node: z.string().optional(),
  mode: z.string().optional(),
  comment: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxReplicationJobConfigSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  rate: z.number().int().optional(),
  comment: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxDatacenterFirewallOptionsConfigSchema = z.object({
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeDnsConfigSchema = z.object({
  node: z.string().min(1),
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeHostsConfigSchema = z.object({
  node: z.string().min(1),
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeOptionsConfigSchema = z.object({
  node: z.string().min(1),
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeTimeConfigSchema = z.object({
  node: z.string().min(1),
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeServiceActionConfigSchema = z.object({
  node: z.string().min(1),
  service: z.string().min(1),
  action: z.enum(['start', 'stop', 'restart', 'reload']),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxNodeAptActionConfigSchema = z.object({
  node: z.string().min(1),
  action: z.enum(['update', 'upgrade']),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxNodeCertificateRequestConfigSchema = z.object({
  node: z.string().min(1),
  method: z.enum(['create', 'read', 'update', 'delete']),
  path: z.string().min(1),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxNodeFirewallOptionsConfigSchema = z.object({
  node: z.string().min(1),
  options: z.record(z.union([z.string(), z.number(), z.boolean()]))
});

const proxmoxNodeFirewallRuleConfigSchema = z.object({
  node: z.string().min(1),
  id: z.string().optional(),
  ensure: z.enum(['present', 'absent']).optional(),
  action: z.string().min(1),
  type: z.string().optional(),
  iface: z.string().optional(),
  source: z.string().optional(),
  dest: z.string().optional(),
  proto: z.string().optional(),
  sport: z.string().optional(),
  dport: z.string().optional(),
  enable: z.boolean().optional(),
  comment: z.string().optional(),
  pos: z.number().int().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxNodeCertificateCustomConfigSchema = z.object({
  node: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxNodeCertificateAcmeConfigSchema = z.object({
  node: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxSdnZoneConfigSchema = z.object({
  zone: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxSdnVnetConfigSchema = z.object({
  vnet: z.string().min(1),
  zone: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  alias: z.string().optional(),
  tag: z.number().int().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxSdnSubnetConfigSchema = z.object({
  vnet: z.string().min(1),
  subnet: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  gateway: z.string().optional(),
  snat: z.boolean().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxSdnIpamConfigSchema = z.object({
  ipam: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxDatacenterFirewallAliasConfigSchema = z.object({
  name: z.string().min(1),
  cidr: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  comment: z.string().optional()
});

const proxmoxDatacenterFirewallIpsetConfigSchema = z.object({
  name: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  comment: z.string().optional()
});

const proxmoxDatacenterFirewallRuleConfigSchema = z.object({
  id: z.string().optional(),
  ensure: z.enum(['present', 'absent']).optional(),
  action: z.string().min(1),
  type: z.string().optional(),
  iface: z.string().optional(),
  source: z.string().optional(),
  dest: z.string().optional(),
  proto: z.string().optional(),
  sport: z.string().optional(),
  dport: z.string().optional(),
  enable: z.boolean().optional(),
  comment: z.string().optional(),
  pos: z.number().int().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxVmMigrationConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  target: z.string().min(1),
  online: z.boolean().optional(),
  withLocalDisks: z.boolean().optional()
});

const proxmoxCtMigrationConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  target: z.string().min(1),
  restart: z.boolean().optional()
});

const proxmoxVmBackupConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  storage: z.string().optional(),
  mode: z.string().optional(),
  compress: z.string().optional(),
  remove: z.boolean().optional(),
  mailNotification: z.string().optional()
});

const proxmoxCtBackupConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  storage: z.string().optional(),
  mode: z.string().optional(),
  compress: z.string().optional(),
  remove: z.boolean().optional(),
  mailNotification: z.string().optional()
});

const proxmoxVmRestoreConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  archive: z.string().min(1),
  storage: z.string().optional(),
  force: z.boolean().optional()
});

const proxmoxCtRestoreConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  archive: z.string().min(1),
  storage: z.string().optional(),
  force: z.boolean().optional()
});

const proxmoxVmSnapshotPolicyConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  name: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  description: z.string().optional(),
  vmstate: z.boolean().optional()
});

const proxmoxCtSnapshotPolicyConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  name: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  description: z.string().optional()
});

const proxmoxVmGuestAgentConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  command: z.string().min(1),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxStorageContentConfigSchema = z.object({
  node: z.string().min(1),
  storage: z.string().min(1),
  volume: z.string().min(1)
});

const proxmoxVmDiskMoveConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  disk: z.string().min(1),
  targetStorage: z.string().min(1),
  deleteSource: z.boolean().optional()
});

const proxmoxVmDiskImportConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  source: z.string().min(1),
  storage: z.string().min(1),
  format: z.string().optional()
});

const proxmoxVmDiskCloneConfigSchema = z.object({
  node: z.string().min(1),
  vmid: z.number().int().positive(),
  disk: z.string().min(1),
  targetStorage: z.string().min(1),
  targetVmid: z.number().int().positive(),
  targetDisk: z.string().min(1).optional(),
  format: z.string().optional()
});

const proxmoxStorageContentCopyConfigSchema = z.object({
  node: z.string().min(1),
  storage: z.string().min(1),
  volume: z.string().min(1),
  targetStorage: z.string().min(1)
});

const proxmoxNodeDiskInitializeConfigSchema = z.object({
  node: z.string().min(1),
  disk: z.string().min(1)
});

const proxmoxNodeLvmCreateConfigSchema = z.object({
  node: z.string().min(1),
  name: z.string().min(1),
  device: z.string().min(1)
});

const proxmoxNodeLvmThinCreateConfigSchema = z.object({
  node: z.string().min(1),
  volumeGroup: z.string().min(1),
  name: z.string().min(1)
});

const proxmoxNodeZfsCreateConfigSchema = z.object({
  node: z.string().min(1),
  name: z.string().min(1),
  devices: z.array(z.string().min(1)).min(1),
  raidLevel: z.string().optional(),
  ashift: z.number().int().positive().optional()
});

const proxmoxHaGroupConfigSchema = z.object({
  group: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  nodes: z.array(z.string().min(1)).optional(),
  nofailback: z.boolean().optional(),
  restricted: z.boolean().optional(),
  comment: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxHaResourceConfigSchema = z.object({
  sid: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  state: z.string().optional(),
  group: z.string().optional(),
  maxRestart: z.number().int().nonnegative().optional(),
  maxRelocate: z.number().int().nonnegative().optional(),
  comment: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxHaRuleConfigSchema = z.object({
  rule: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional(),
  type: z.string().optional(),
  resources: z.array(z.string().min(1)).optional(),
  comment: z.string().optional(),
  options: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const proxmoxCephFlagConfigSchema = z.object({
  flag: z.string().min(1),
  ensure: z.enum(['present', 'absent']).optional()
});

const proxmoxHaStatusQueryConfigSchema = z.object({
  section: z.enum(['status']).optional()
});

const proxmoxCephReadQueryConfigSchema = z.object({
  section: z.enum(['overview', 'status', 'metadata', 'flags'])
});

const proxmoxNodeCephReadQueryConfigSchema = z.object({
  node: z.string().min(1),
  section: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()
});

const proxmoxNodeCephActionConfigSchema = z.object({
  node: z.string().min(1),
  method: z.enum(['create', 'update', 'delete']),
  section: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  confirm: z.literal('I_UNDERSTAND').optional()
});

const proxmoxNodeTaskQueryConfigSchema = z.object({
  node: z.string().min(1),
  upid: z.string().optional(),
  limit: z.number().int().positive().optional(),
  source: z.string().optional(),
  running: z.boolean().optional(),
  since: z.number().int().nonnegative().optional()
});

const proxmoxClusterTaskQueryConfigSchema = z.object({
  limit: z.number().int().positive().optional(),
  source: z.string().optional(),
  running: z.boolean().optional(),
  since: z.number().int().nonnegative().optional()
});

const proxmoxNodeTaskLogQueryConfigSchema = z.object({
  node: z.string().min(1),
  upid: z.string().min(1),
  start: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional()
});

const proxmoxNodeFirewallLogQueryConfigSchema = z.object({
  node: z.string().min(1),
  limit: z.number().int().positive().optional(),
  since: z.number().int().nonnegative().optional()
});

const proxmoxDatacenterCrudSchema = z.object({
  method: z.enum(['create', 'read', 'update', 'delete']),
  path: z.string().min(1),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  reason: z.string().optional()
});

const proxmoxNodeCrudSchema = z.object({
  method: z.enum(['create', 'read', 'update', 'delete']),
  node: z.string().min(1),
  path: z.string().min(1),
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  reason: z.string().optional()
});

const grafanaCrudSchema = z.object({
  method: z.enum(['create', 'read', 'update', 'delete', 'get', 'post', 'put', 'patch', 'head', 'options']),
  path: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  query: z.record(z.unknown()).optional(),
  body: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
  orgId: z.number().int().positive().optional(),
  reason: z.string().optional()
});

// ============================================================================
// Main desired spec schema
// ============================================================================

export const desiredSpecSchema = z.object({
  // Existing state management
  vms: z
    .array(
      z.object({
        vmid: z.number().int().positive(),
        desiredPower: z.enum(['running', 'stopped']),
        snapshotBeforeRisky: z.boolean().optional(),
        risky: z.boolean().optional()
      })
    )
    .default([]),
  composeProjects: z
    .array(
      z.object({
        path: z.string().min(1),
        ensure: z.literal('running')
      })
    )
    .default([]),
  grafanaCrud: z.array(grafanaCrudSchema).optional(),
  validation: z
    .object({
      enabled: z.boolean().optional(),
      prometheusDatasourceName: z.string().optional(),
      checks: z
        .array(
          z.object({
            expr: z.string().min(1),
            max: z.number().optional(),
            min: z.number().optional()
          })
        )
        .optional()
    })
    .optional(),
  
  // New: Provisioning
  vmProvision: z.array(vmProvisionConfigSchema).optional(),
  containerProvision: z.array(containerProvisionConfigSchema).optional(),
  networks: z.array(networkConfigSchema).optional(),
  storage: z.array(storageConfigSchema).optional(),
  
  // New: Deletion
  deleteVms: z.array(z.number().int().positive()).optional(),
  deleteContainers: z.array(z.number().int().positive()).optional(),
  proxmoxUsers: z.array(proxmoxUserConfigSchema).optional(),
  proxmoxTokens: z.array(proxmoxTokenConfigSchema).optional(),
  proxmoxAcls: z.array(proxmoxAclConfigSchema).optional(),
  proxmoxRoles: z.array(proxmoxRoleConfigSchema).optional(),
  proxmoxGroups: z.array(proxmoxGroupConfigSchema).optional(),
  proxmoxRealms: z.array(proxmoxRealmConfigSchema).optional(),
  proxmoxTfa: z.array(proxmoxTfaConfigSchema).optional(),
  proxmoxClusterOptions: proxmoxClusterOptionsConfigSchema.optional(),
  proxmoxPools: z.array(proxmoxPoolConfigSchema).optional(),
  proxmoxBackupJobs: z.array(proxmoxBackupJobConfigSchema).optional(),
  proxmoxReplicationJobs: z.array(proxmoxReplicationJobConfigSchema).optional(),
  proxmoxDatacenterFirewallOptions: proxmoxDatacenterFirewallOptionsConfigSchema.optional(),
  proxmoxNodeDns: z.array(proxmoxNodeDnsConfigSchema).optional(),
  proxmoxNodeHosts: z.array(proxmoxNodeHostsConfigSchema).optional(),
  proxmoxNodeOptions: z.array(proxmoxNodeOptionsConfigSchema).optional(),
  proxmoxNodeTime: z.array(proxmoxNodeTimeConfigSchema).optional(),
  proxmoxNodeServices: z.array(proxmoxNodeServiceActionConfigSchema).optional(),
  proxmoxNodeApt: z.array(proxmoxNodeAptActionConfigSchema).optional(),
  proxmoxNodeCertificates: z.array(proxmoxNodeCertificateRequestConfigSchema).optional(),
  proxmoxNodeFirewallOptions: z.array(proxmoxNodeFirewallOptionsConfigSchema).optional(),
  proxmoxNodeFirewallRules: z.array(proxmoxNodeFirewallRuleConfigSchema).optional(),
  proxmoxNodeCertificateCustom: z.array(proxmoxNodeCertificateCustomConfigSchema).optional(),
  proxmoxNodeCertificateAcme: z.array(proxmoxNodeCertificateAcmeConfigSchema).optional(),
  proxmoxSdnZones: z.array(proxmoxSdnZoneConfigSchema).optional(),
  proxmoxSdnVnets: z.array(proxmoxSdnVnetConfigSchema).optional(),
  proxmoxSdnSubnets: z.array(proxmoxSdnSubnetConfigSchema).optional(),
  proxmoxSdnIpams: z.array(proxmoxSdnIpamConfigSchema).optional(),
  proxmoxDatacenterFirewallAliases: z.array(proxmoxDatacenterFirewallAliasConfigSchema).optional(),
  proxmoxDatacenterFirewallIpsets: z.array(proxmoxDatacenterFirewallIpsetConfigSchema).optional(),
  proxmoxDatacenterFirewallRules: z.array(proxmoxDatacenterFirewallRuleConfigSchema).optional(),
  proxmoxVmMigrations: z.array(proxmoxVmMigrationConfigSchema).optional(),
  proxmoxCtMigrations: z.array(proxmoxCtMigrationConfigSchema).optional(),
  proxmoxVmBackups: z.array(proxmoxVmBackupConfigSchema).optional(),
  proxmoxCtBackups: z.array(proxmoxCtBackupConfigSchema).optional(),
  proxmoxVmRestores: z.array(proxmoxVmRestoreConfigSchema).optional(),
  proxmoxCtRestores: z.array(proxmoxCtRestoreConfigSchema).optional(),
  proxmoxVmSnapshots: z.array(proxmoxVmSnapshotPolicyConfigSchema).optional(),
  proxmoxCtSnapshots: z.array(proxmoxCtSnapshotPolicyConfigSchema).optional(),
  proxmoxVmGuestAgent: z.array(proxmoxVmGuestAgentConfigSchema).optional(),
  proxmoxStorageContent: z.array(proxmoxStorageContentConfigSchema).optional(),
  proxmoxStorageContentCopy: z.array(proxmoxStorageContentCopyConfigSchema).optional(),
  proxmoxVmDiskMoves: z.array(proxmoxVmDiskMoveConfigSchema).optional(),
  proxmoxVmDiskImports: z.array(proxmoxVmDiskImportConfigSchema).optional(),
  proxmoxVmDiskClones: z.array(proxmoxVmDiskCloneConfigSchema).optional(),
  proxmoxNodeDiskInitialize: z.array(proxmoxNodeDiskInitializeConfigSchema).optional(),
  proxmoxNodeLvmCreate: z.array(proxmoxNodeLvmCreateConfigSchema).optional(),
  proxmoxNodeLvmThinCreate: z.array(proxmoxNodeLvmThinCreateConfigSchema).optional(),
  proxmoxNodeZfsCreate: z.array(proxmoxNodeZfsCreateConfigSchema).optional(),
  proxmoxHaGroups: z.array(proxmoxHaGroupConfigSchema).optional(),
  proxmoxHaResources: z.array(proxmoxHaResourceConfigSchema).optional(),
  proxmoxHaRules: z.array(proxmoxHaRuleConfigSchema).optional(),
  proxmoxCephFlags: z.array(proxmoxCephFlagConfigSchema).optional(),
  proxmoxHaStatus: z.array(proxmoxHaStatusQueryConfigSchema).optional(),
  proxmoxCephRead: z.array(proxmoxCephReadQueryConfigSchema).optional(),
  proxmoxNodeCephRead: z.array(proxmoxNodeCephReadQueryConfigSchema).optional(),
  proxmoxNodeCephActions: z.array(proxmoxNodeCephActionConfigSchema).optional(),
  proxmoxNodeTasks: z.array(proxmoxNodeTaskQueryConfigSchema).optional(),
  proxmoxClusterTasks: z.array(proxmoxClusterTaskQueryConfigSchema).optional(),
  proxmoxNodeTaskLogs: z.array(proxmoxNodeTaskLogQueryConfigSchema).optional(),
  proxmoxNodeFirewallLogs: z.array(proxmoxNodeFirewallLogQueryConfigSchema).optional(),
  proxmoxDatacenterCrud: z.array(proxmoxDatacenterCrudSchema).optional(),
  proxmoxNodeCrud: z.array(proxmoxNodeCrudSchema).optional()
});

export type DesiredSpecInput = z.infer<typeof desiredSpecSchema>;
