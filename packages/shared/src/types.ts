export type EnvironmentName = string;

export type PowerState = 'running' | 'stopped' | 'unknown';

export interface ProxmoxNode {
  id: string;
  name: string;
  status: string;
  cpuUsage: number;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
}

export interface ProxmoxVm {
  id: string;
  vmid: number;
  node: string;
  name: string;
  status: PowerState;
  cpuCores?: number;
  memoryMb?: number;
  disks: string[];
  tags: string[];
  bridges: string[];
}

export interface ProxmoxCt {
  id: string;
  vmid: number;
  node: string;
  name: string;
  status: PowerState;
  cpuCores?: number;
  memoryMb?: number;
  rootFs?: string;
  tags: string[];
  bridges: string[];
}

export interface ProxmoxNetworkState {
  node: string;
  name: string;
  type: string;
  config: Record<string, string | number | boolean | undefined>;
}

export interface ProxmoxStorageState {
  name: string;
  type: string;
  config: Record<string, string | number | boolean | undefined>;
}

export interface ProxmoxDatacenterState {
  summary?: Record<string, unknown>;
  cluster?: Record<string, unknown>[];
  ceph?: Record<string, unknown>[];
  options?: Record<string, unknown>;
  storage?: Record<string, unknown>[];
  backupJobs?: Record<string, unknown>[];
  replication?: Record<string, unknown>[];
  permissions?: {
    users?: Record<string, unknown>[];
    apiTokens?: Record<string, unknown>[];
    groups?: Record<string, unknown>[];
    pools?: Record<string, unknown>[];
    roles?: Record<string, unknown>[];
    realms?: Record<string, unknown>[];
    acl?: Record<string, unknown>[];
    tfa?: Record<string, unknown>[];
  };
}

export interface ProxmoxNodeAdminState {
  summary?: Record<string, unknown>;
  network?: Record<string, unknown>[];
  certificates?: Record<string, unknown>[];
  dns?: Record<string, unknown>;
  hosts?: Record<string, unknown>[];
  options?: Record<string, unknown>;
  time?: Record<string, unknown>;
  logs?: Record<string, unknown>[];
  updates?: Record<string, unknown>[];
  repositories?: Record<string, unknown>[];
  firewall?: Record<string, unknown>[];
  disks?: {
    list?: Record<string, unknown>[];
    lvm?: Record<string, unknown>[];
    lvmThin?: Record<string, unknown>[];
    directory?: Record<string, unknown>[];
    zfs?: Record<string, unknown>[];
  };
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  composeProject?: string;
}

export interface DockerComposeProject {
  name: string;
  path?: string;
  containerIds: string[];
}

export interface DockerHostState {
  host: string;
  containers: DockerContainer[];
  images: string[];
  networks: string[];
  volumes: string[];
  composeProjects: DockerComposeProject[];
}

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url?: string;
}

export interface GrafanaDatasource {
  id: number;
  name: string;
  type: string;
  isDefault?: boolean;
}

export type GrafanaCrudMethod =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'head'
  | 'options';

export type GrafanaRequestData = Record<string, unknown>;

export interface GrafanaCrudConfig {
  method: GrafanaCrudMethod;
  path: string;
  payload?: GrafanaRequestData;
  query?: GrafanaRequestData;
  body?: GrafanaRequestData;
  headers?: Record<string, string>;
  orgId?: number;
  reason?: string;
}

export interface GrafanaFolderConfig {
  uid?: string;
  title: string;
  ensure?: 'present' | 'absent';
  parentUid?: string;
}

export interface GrafanaDashboardConfig {
  uid: string;
  ensure?: 'present' | 'absent';
  title?: string;
  folderUid?: string;
  overwrite?: boolean;
  message?: string;
  dashboard?: Record<string, unknown>;
}

export interface UnifiedState {
  generatedAt: string;
  env: EnvironmentName;
  compute: {
    nodes: ProxmoxNode[];
    vms: ProxmoxVm[];
    cts: ProxmoxCt[];
    networks?: ProxmoxNetworkState[];
    storage?: ProxmoxStorageState[];
  };
  apps: {
    dockerHosts: DockerHostState[];
  };
  observability: {
    grafanaDashboards: GrafanaDashboard[];
    grafanaDatasources: GrafanaDatasource[];
  };
  datacenter?: ProxmoxDatacenterState;
  nodeAdmin?: Record<string, ProxmoxNodeAdminState>;
  warnings: string[];
}

export interface DesiredVmState {
  vmid: number;
  desiredPower: Exclude<PowerState, 'unknown'>;
  snapshotBeforeRisky?: boolean;
  risky?: boolean;
}

export interface DesiredComposeProject {
  path: string;
  ensure: 'running';
}

export interface ProxmoxUserConfig {
  userId: string; // e.g. naas@pve
  ensure?: 'present' | 'absent';
  email?: string;
  firstName?: string;
  lastName?: string;
  comment?: string;
  enabled?: boolean;
  expire?: number;
  groups?: string[];
  password?: string;
  keys?: string;
}

export interface ProxmoxTokenConfig {
  userId: string; // e.g. naas@pve
  tokenId: string; // e.g. naasctl
  ensure?: 'present' | 'absent';
  comment?: string;
  expire?: number;
  enabled?: boolean;
  privilegeSeparation?: boolean;
}

export interface ProxmoxAclConfig {
  path: string; // e.g. /
  roleId: string; // e.g. Administrator
  userId?: string;
  groupId?: string;
  tokenId?: string; // e.g. user@realm!token
  propagate?: boolean;
  ensure?: 'present' | 'absent';
}

export interface ProxmoxRoleConfig {
  roleId: string;
  ensure?: 'present' | 'absent';
  privs: string[]; // e.g. ["VM.Allocate", "Datastore.Audit"]
}

export interface ProxmoxGroupConfig {
  groupId: string;
  ensure?: 'present' | 'absent';
  comment?: string;
  users?: string[];
}

export interface ProxmoxRealmConfig {
  realm: string;
  ensure?: 'present' | 'absent';
  type?: string;
  comment?: string;
  default?: boolean;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxTfaConfig {
  userId: string;
  id?: string;
  ensure?: 'present' | 'absent';
  type?: string;
  description?: string;
  value?: string;
  enabled?: boolean;
}

export interface ProxmoxClusterOptionsConfig {
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxPoolConfig {
  poolId: string;
  ensure?: 'present' | 'absent';
  comment?: string;
  users?: string[];
  groups?: string[];
}

export interface ProxmoxBackupJobConfig {
  id: string;
  ensure?: 'present' | 'absent';
  enabled?: boolean;
  schedule?: string;
  storage?: string;
  node?: string;
  mode?: string;
  comment?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxReplicationJobConfig {
  id: string;
  source: string;
  target: string;
  ensure?: 'present' | 'absent';
  enabled?: boolean;
  schedule?: string;
  rate?: number;
  comment?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxDatacenterFirewallOptionsConfig {
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeDnsConfig {
  node: string;
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeHostsConfig {
  node: string;
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeOptionsConfig {
  node: string;
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeTimeConfig {
  node: string;
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeServiceActionConfig {
  node: string;
  service: string;
  action: 'start' | 'stop' | 'restart' | 'reload';
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeAptActionConfig {
  node: string;
  action: 'update' | 'upgrade';
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeCertificateRequestConfig {
  node: string;
  method: 'create' | 'read' | 'update' | 'delete';
  path: string;
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeFirewallOptionsConfig {
  node: string;
  options: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeFirewallRuleConfig {
  node: string;
  id?: string;
  ensure?: 'present' | 'absent';
  action: string;
  type?: string;
  iface?: string;
  source?: string;
  dest?: string;
  proto?: string;
  sport?: string;
  dport?: string;
  enable?: boolean;
  comment?: string;
  pos?: number;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeCertificateCustomConfig {
  node: string;
  ensure?: 'present' | 'absent';
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxNodeCertificateAcmeConfig {
  node: string;
  ensure?: 'present' | 'absent';
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxSdnZoneConfig {
  zone: string;
  ensure?: 'present' | 'absent';
  type?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxSdnVnetConfig {
  vnet: string;
  zone: string;
  ensure?: 'present' | 'absent';
  alias?: string;
  tag?: number;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxSdnSubnetConfig {
  vnet: string;
  subnet: string;
  ensure?: 'present' | 'absent';
  gateway?: string;
  snat?: boolean;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxSdnIpamConfig {
  ipam: string;
  ensure?: 'present' | 'absent';
  type?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxDatacenterFirewallAliasConfig {
  name: string;
  cidr: string;
  ensure?: 'present' | 'absent';
  comment?: string;
}

export interface ProxmoxDatacenterFirewallIpsetConfig {
  name: string;
  ensure?: 'present' | 'absent';
  comment?: string;
}

export interface ProxmoxDatacenterFirewallRuleConfig {
  id?: string;
  ensure?: 'present' | 'absent';
  action: string;
  type?: string;
  iface?: string;
  source?: string;
  dest?: string;
  proto?: string;
  sport?: string;
  dport?: string;
  enable?: boolean;
  comment?: string;
  pos?: number;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxVmMigrationConfig {
  node: string;
  vmid: number;
  target: string;
  online?: boolean;
  withLocalDisks?: boolean;
}

export interface ProxmoxCtMigrationConfig {
  node: string;
  vmid: number;
  target: string;
  restart?: boolean;
}

export interface ProxmoxVmBackupConfig {
  node: string;
  vmid: number;
  storage?: string;
  mode?: string;
  compress?: string;
  remove?: boolean;
  mailNotification?: string;
}

export interface ProxmoxCtBackupConfig {
  node: string;
  vmid: number;
  storage?: string;
  mode?: string;
  compress?: string;
  remove?: boolean;
  mailNotification?: string;
}

export interface ProxmoxVmRestoreConfig {
  node: string;
  vmid: number;
  archive: string;
  storage?: string;
  force?: boolean;
}

export interface ProxmoxCtRestoreConfig {
  node: string;
  vmid: number;
  archive: string;
  storage?: string;
  force?: boolean;
}

export interface ProxmoxVmSnapshotPolicyConfig {
  node: string;
  vmid: number;
  name: string;
  ensure?: 'present' | 'absent';
  description?: string;
  vmstate?: boolean;
}

export interface ProxmoxCtSnapshotPolicyConfig {
  node: string;
  vmid: number;
  name: string;
  ensure?: 'present' | 'absent';
  description?: string;
}

export interface ProxmoxVmGuestAgentConfig {
  node: string;
  vmid: number;
  command: string;
  payload?: Record<string, string | number | boolean>;
}

export interface ProxmoxStorageContentConfig {
  node: string;
  storage: string;
  volume: string;
}

export interface ProxmoxVmDiskMoveConfig {
  node: string;
  vmid: number;
  disk: string;
  targetStorage: string;
  deleteSource?: boolean;
}

export interface ProxmoxVmDiskImportConfig {
  node: string;
  vmid: number;
  source: string;
  storage: string;
  format?: string;
}

export interface ProxmoxVmDiskCloneConfig {
  node: string;
  vmid: number;
  disk: string;
  targetStorage: string;
  targetVmid: number;
  targetDisk?: string;
  format?: string;
}

export interface ProxmoxStorageContentCopyConfig {
  node: string;
  storage: string;
  volume: string;
  targetStorage: string;
}

export interface ProxmoxNodeDiskInitializeConfig {
  node: string;
  disk: string;
}

export interface ProxmoxNodeLvmCreateConfig {
  node: string;
  name: string;
  device: string;
}

export interface ProxmoxNodeLvmThinCreateConfig {
  node: string;
  volumeGroup: string;
  name: string;
}

export interface ProxmoxNodeZfsCreateConfig {
  node: string;
  name: string;
  devices: string[];
  raidLevel?: string;
  ashift?: number;
}

export interface ProxmoxHaGroupConfig {
  group: string;
  ensure?: 'present' | 'absent';
  nodes?: string[];
  nofailback?: boolean;
  restricted?: boolean;
  comment?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxHaResourceConfig {
  sid: string;
  ensure?: 'present' | 'absent';
  state?: string;
  group?: string;
  maxRestart?: number;
  maxRelocate?: number;
  comment?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxHaRuleConfig {
  rule: string;
  ensure?: 'present' | 'absent';
  type?: string;
  resources?: string[];
  comment?: string;
  options?: Record<string, string | number | boolean>;
}

export interface ProxmoxCephFlagConfig {
  flag: string;
  ensure?: 'present' | 'absent';
}

export interface ProxmoxHaStatusQueryConfig {
  section?: 'status';
}

export interface ProxmoxCephReadQueryConfig {
  section: 'overview' | 'status' | 'metadata' | 'flags';
}

export interface ProxmoxNodeCephReadQueryConfig {
  node: string;
  section?: string;
}

export interface ProxmoxNodeCephActionConfig {
  node: string;
  method: 'create' | 'update' | 'delete';
  section?: string;
  payload?: Record<string, string | number | boolean>;
  confirm?: 'I_UNDERSTAND';
}

export interface ProxmoxNodeTaskQueryConfig {
  node: string;
  upid?: string;
  limit?: number;
  source?: string;
  running?: boolean;
  since?: number;
}

export interface ProxmoxClusterTaskQueryConfig {
  limit?: number;
  source?: string;
  running?: boolean;
  since?: number;
}

export interface ProxmoxNodeTaskLogQueryConfig {
  node: string;
  upid: string;
  start?: number;
  limit?: number;
}

export interface ProxmoxNodeFirewallLogQueryConfig {
  node: string;
  limit?: number;
  since?: number;
}

export interface ProxmoxDatacenterCrudConfig {
  method: 'create' | 'read' | 'update' | 'delete';
  path: string; // API2 path after /api2/json, e.g. /access/users
  payload?: Record<string, string | number | boolean>;
  reason?: string;
}

export interface ProxmoxNodeCrudConfig {
  method: 'create' | 'read' | 'update' | 'delete';
  node: string;
  path: string; // node-relative API path, e.g. /network or /dns
  payload?: Record<string, string | number | boolean>;
  reason?: string;
}

export interface DesiredSpec {
  vms: DesiredVmState[];
  composeProjects: DesiredComposeProject[];
  grafanaCrud?: GrafanaCrudConfig[];
  grafanaFolders?: GrafanaFolderConfig[];
  grafanaDashboards?: GrafanaDashboardConfig[];
  validation?: {
    enabled?: boolean;
    prometheusDatasourceName?: string;
    checks?: Array<{
      expr: string;
      max?: number;
      min?: number;
    }>;
  };
  // New: Provisioning capabilities
  vmProvision?: VmProvisionConfig[];
  containerProvision?: ContainerProvisionConfig[];
  networks?: NetworkConfig[];
  storage?: StorageConfig[];
  // Deletion
  deleteVms?: number[];
  deleteContainers?: number[];
  proxmoxUsers?: ProxmoxUserConfig[];
  proxmoxTokens?: ProxmoxTokenConfig[];
  proxmoxAcls?: ProxmoxAclConfig[];
  proxmoxRoles?: ProxmoxRoleConfig[];
  proxmoxGroups?: ProxmoxGroupConfig[];
  proxmoxRealms?: ProxmoxRealmConfig[];
  proxmoxTfa?: ProxmoxTfaConfig[];
  proxmoxClusterOptions?: ProxmoxClusterOptionsConfig;
  proxmoxPools?: ProxmoxPoolConfig[];
  proxmoxBackupJobs?: ProxmoxBackupJobConfig[];
  proxmoxReplicationJobs?: ProxmoxReplicationJobConfig[];
  proxmoxDatacenterFirewallOptions?: ProxmoxDatacenterFirewallOptionsConfig;
  proxmoxNodeDns?: ProxmoxNodeDnsConfig[];
  proxmoxNodeHosts?: ProxmoxNodeHostsConfig[];
  proxmoxNodeOptions?: ProxmoxNodeOptionsConfig[];
  proxmoxNodeTime?: ProxmoxNodeTimeConfig[];
  proxmoxNodeServices?: ProxmoxNodeServiceActionConfig[];
  proxmoxNodeApt?: ProxmoxNodeAptActionConfig[];
  proxmoxNodeCertificates?: ProxmoxNodeCertificateRequestConfig[];
  proxmoxNodeFirewallOptions?: ProxmoxNodeFirewallOptionsConfig[];
  proxmoxNodeFirewallRules?: ProxmoxNodeFirewallRuleConfig[];
  proxmoxNodeCertificateCustom?: ProxmoxNodeCertificateCustomConfig[];
  proxmoxNodeCertificateAcme?: ProxmoxNodeCertificateAcmeConfig[];
  proxmoxSdnZones?: ProxmoxSdnZoneConfig[];
  proxmoxSdnVnets?: ProxmoxSdnVnetConfig[];
  proxmoxSdnSubnets?: ProxmoxSdnSubnetConfig[];
  proxmoxSdnIpams?: ProxmoxSdnIpamConfig[];
  proxmoxDatacenterFirewallAliases?: ProxmoxDatacenterFirewallAliasConfig[];
  proxmoxDatacenterFirewallIpsets?: ProxmoxDatacenterFirewallIpsetConfig[];
  proxmoxDatacenterFirewallRules?: ProxmoxDatacenterFirewallRuleConfig[];
  proxmoxVmMigrations?: ProxmoxVmMigrationConfig[];
  proxmoxCtMigrations?: ProxmoxCtMigrationConfig[];
  proxmoxVmBackups?: ProxmoxVmBackupConfig[];
  proxmoxCtBackups?: ProxmoxCtBackupConfig[];
  proxmoxVmRestores?: ProxmoxVmRestoreConfig[];
  proxmoxCtRestores?: ProxmoxCtRestoreConfig[];
  proxmoxVmSnapshots?: ProxmoxVmSnapshotPolicyConfig[];
  proxmoxCtSnapshots?: ProxmoxCtSnapshotPolicyConfig[];
  proxmoxVmGuestAgent?: ProxmoxVmGuestAgentConfig[];
  proxmoxStorageContent?: ProxmoxStorageContentConfig[];
  proxmoxStorageContentCopy?: ProxmoxStorageContentCopyConfig[];
  proxmoxVmDiskMoves?: ProxmoxVmDiskMoveConfig[];
  proxmoxVmDiskImports?: ProxmoxVmDiskImportConfig[];
  proxmoxVmDiskClones?: ProxmoxVmDiskCloneConfig[];
  proxmoxNodeDiskInitialize?: ProxmoxNodeDiskInitializeConfig[];
  proxmoxNodeLvmCreate?: ProxmoxNodeLvmCreateConfig[];
  proxmoxNodeLvmThinCreate?: ProxmoxNodeLvmThinCreateConfig[];
  proxmoxNodeZfsCreate?: ProxmoxNodeZfsCreateConfig[];
  proxmoxHaGroups?: ProxmoxHaGroupConfig[];
  proxmoxHaResources?: ProxmoxHaResourceConfig[];
  proxmoxHaRules?: ProxmoxHaRuleConfig[];
  proxmoxCephFlags?: ProxmoxCephFlagConfig[];
  proxmoxHaStatus?: ProxmoxHaStatusQueryConfig[];
  proxmoxCephRead?: ProxmoxCephReadQueryConfig[];
  proxmoxNodeCephRead?: ProxmoxNodeCephReadQueryConfig[];
  proxmoxNodeCephActions?: ProxmoxNodeCephActionConfig[];
  proxmoxNodeTasks?: ProxmoxNodeTaskQueryConfig[];
  proxmoxClusterTasks?: ProxmoxClusterTaskQueryConfig[];
  proxmoxNodeTaskLogs?: ProxmoxNodeTaskLogQueryConfig[];
  proxmoxNodeFirewallLogs?: ProxmoxNodeFirewallLogQueryConfig[];
  proxmoxDatacenterCrud?: ProxmoxDatacenterCrudConfig[];
  proxmoxNodeCrud?: ProxmoxNodeCrudConfig[];
}

// ============================================================================
// PROVISIONING TYPES - Phase 1
// ============================================================================

export type EnsureState = 'present' | 'absent' | 'running' | 'stopped';

export interface DiskConfig {
  interface: 'ide' | 'sata' | 'scsi' | 'virtio';
  index: number;
  storage: string;
  size: string; // "50G", "1T"
  format?: 'raw' | 'qcow2' | 'vmdk';
  cache?: 'directsync' | 'writethrough' | 'writeback' | 'unsafe' | 'none';
  discard?: 'on' | 'ignore';
  ssd?: boolean;
  iothread?: boolean;
}

export interface NetworkInterfaceConfig {
  interface: 'net';
  index: number;
  model: 'virtio' | 'e1000' | 'rtl8139' | 'vmxnet3';
  bridge: string;
  vlan?: number;
  firewall?: boolean;
  mac?: string;
  rate?: number; // MB/s limit
  tag?: number; // VLAN tag
}

export interface IpConfig {
  index: number;
  ip: string; // CIDR or "dhcp"
  gateway?: string;
  ip6?: string; // IPv6 CIDR or "auto" or "dhcp"
  gateway6?: string;
}

export interface CloudInitConfig {
  user?: string;
  password?: string;
  sshKeys?: string[];
  nameserver?: string;
  searchdomain?: string;
  upgrade?: boolean;
  ciCustom?: string; // Path to custom cloud-init config
}

export interface BootConfig {
  order?: string[]; // ["scsi0", "net0"]
  bios?: 'seabios' | 'ovmf';
}

export interface CpuConfig {
  cores: number;
  sockets?: number;
  type?: string; // "qemu64", "host", "kvm64", etc.
  limit?: number; // CPU limit
  units?: number; // CPU weight
  numa?: boolean;
}

export interface MemoryConfig {
  size: number; // MB
  balloon?: number; // Minimum memory (MB)
  shares?: number; // Memory shares
}

export interface VmProvisionConfig {
  name: string;
  vmid: number;
  node: string;
  ensure?: EnsureState; // Default: 'running'
  
  // Source
  template?: number | string; // Template VMID or name
  clone?: {
    source: number;
    full?: boolean; // Full clone vs linked
    pool?: string;
    snapname?: string;
  };
  
  // Compute
  cpu: CpuConfig;
  memory: MemoryConfig;
  
  // Storage
  disks: DiskConfig[];
  
  // Network
  networks: NetworkInterfaceConfig[];
  ipconfig?: IpConfig[];
  
  // Cloud-init
  cloudInit?: CloudInitConfig;
  
  // Boot & BIOS
  boot?: BootConfig;
  
  // Options
  onboot?: boolean;
  protection?: boolean;
  tags?: string[];
  description?: string;
  ostype?: string; // "l26" (Linux 2.6+), "win10", etc.
  agent?: boolean; // QEMU guest agent
  hotplug?: string; // "disk,network,usb,memory,cpu"
}

export interface ContainerProvisionConfig {
  name: string;
  vmid: number;
  node: string;
  ensure?: EnsureState;
  
  // Source
  ostemplate: string; // "local:vztmpl/ubuntu-22.04.tar.zst"
  
  // Compute
  cpu?: {
    cores: number;
    limit?: number;
    units?: number;
  };
  memory?: {
    size: number; // MB
    swap?: number; // MB
  };
  
  // Storage
  rootfs: {
    storage: string;
    size: string; // "20G"
  };
  mountpoints?: Array<{
    index: number;
    storage: string;
    size?: string;
    mp: string; // Mount point path
    acl?: boolean;
    backup?: boolean;
    quota?: boolean;
    replicate?: boolean;
    shared?: boolean;
  }>;
  
  // Network
  networks: Array<{
    index: number;
    bridge: string;
    ip?: string; // CIDR or "dhcp"
    gateway?: string;
    ip6?: string;
    gateway6?: string;
    firewall?: boolean;
    hwaddr?: string; // MAC address
    tag?: number; // VLAN tag
    rate?: number; // MB/s
  }>;
  
  // Options
  onboot?: boolean;
  protection?: boolean;
  tags?: string[];
  description?: string;
  hostname?: string;
  unprivileged?: boolean;
  features?: {
    nesting?: boolean;
    fuse?: boolean;
    keyctl?: boolean;
    mount?: string; // Mount types allowed
  };
}

export interface NetworkConfig {
  name: string;
  node: string;
  ensure?: 'present' | 'absent';
  type: 'bridge' | 'bond' | 'vlan';
  
  // Bridge config
  bridge_ports?: string; // "eth0 eth1"
  bridge_vlan_aware?: boolean;
  
  // VLAN config
  vlan_id?: number;
  vlan_raw_device?: string;
  
  // Bond config
  bond_mode?: 'balance-rr' | 'active-backup' | '802.3ad' | 'balance-tlb' | 'balance-alb';
  slaves?: string[]; // ["eth0", "eth1"]
  
  // IP config
  cidr?: string;
  gateway?: string;
  
  // Options
  autostart?: boolean;
  comments?: string;
}

export interface StorageConfig {
  name: string;
  node?: string; // If undefined, applies to all nodes
  ensure?: 'present' | 'absent';
  type: 'dir' | 'nfs' | 'cifs' | 'lvm' | 'lvmthin' | 'zfspool' | 'btrfs';
  
  // Common
  content?: string[]; // ["images", "rootdir", "vztmpl", "backup", "iso", "snippets"]
  
  // Directory
  path?: string;
  
  // NFS
  server?: string;
  export?: string;
  
  // CIFS
  share?: string;
  username?: string;
  domain?: string;
  
  // LVM
  vgname?: string;
  
  // ZFS
  pool?: string;
  blocksize?: string;
  sparse?: boolean;
  
  // Options
  maxfiles?: number;
  prune_backups?: string;
  shared?: boolean;
  disable?: boolean;
  nodes?: string[]; // Nodes this storage is available on
}

export type PlanAction =
  // Existing state management actions
  | {
      kind: 'proxmox.snapshot';
      node: string;
      vmid: number;
      name: string;
      reason: string;
    }
  | {
      kind: 'proxmox.start' | 'proxmox.stop' | 'proxmox.reboot';
      node: string;
      vmid: number;
      reason: string;
      vmType: 'qemu' | 'lxc';
    }
  | {
      kind: 'docker.compose.redeploy';
      path: string;
      reason: string;
    }
  | {
      kind: 'validate.grafana';
      reason: string;
    }
  | {
      kind: 'grafana.request';
      method: GrafanaCrudMethod;
      path: string;
      payload?: GrafanaRequestData;
      query?: GrafanaRequestData;
      body?: GrafanaRequestData;
      headers?: Record<string, string>;
      orgId?: number;
      reason: string;
    }
  | {
      kind: 'grafana.folder.upsert';
      config: GrafanaFolderConfig;
      reason: string;
    }
  | {
      kind: 'grafana.folder.delete';
      uid: string;
      reason: string;
    }
  | {
      kind: 'grafana.dashboard.upsert';
      config: GrafanaDashboardConfig;
      reason: string;
    }
  | {
      kind: 'grafana.dashboard.delete';
      uid: string;
      reason: string;
    }
  | {
      kind: 'grafana.create' | 'grafana.read' | 'grafana.update' | 'grafana.delete';
      path: string;
      payload?: GrafanaRequestData;
      reason: string;
    }
  // New: VM provisioning actions
  | {
      kind: 'proxmox.vm.create';
      node: string;
      vmid: number;
      config: VmProvisionConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.clone';
      node: string;
      vmid: number;
      sourceVmid: number;
      config: Partial<VmProvisionConfig>;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.update';
      node: string;
      vmid: number;
      changes: ConfigChange[];
      reason: string;
    }
  | {
      kind: 'proxmox.vm.delete';
      node: string;
      vmid: number;
      reason: string;
    }
  // New: Container provisioning actions
  | {
      kind: 'proxmox.ct.create';
      node: string;
      vmid: number;
      config: ContainerProvisionConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ct.update';
      node: string;
      vmid: number;
      changes: ConfigChange[];
      reason: string;
    }
  | {
      kind: 'proxmox.ct.delete';
      node: string;
      vmid: number;
      reason: string;
    }
  // New: Infrastructure actions
  | {
      kind: 'proxmox.network.create';
      node: string;
      name: string;
      config: NetworkConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.network.update';
      node: string;
      name: string;
      config: NetworkConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.network.delete';
      node: string;
      name: string;
      reason: string;
    }
  | {
      kind: 'proxmox.storage.create';
      name: string;
      config: StorageConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.storage.update';
      name: string;
      config: StorageConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.storage.delete';
      name: string;
      reason: string;
    }
  // New: Disk operations
  | {
      kind: 'proxmox.vm.resize-disk';
      node: string;
      vmid: number;
      disk: string;
      newSize: string;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.attach-disk';
      node: string;
      vmid: number;
      disk: DiskConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.detach-disk';
      node: string;
      vmid: number;
      disk: string;
      reason: string;
    }
  // New: Proxmox IAM actions
  | {
      kind: 'proxmox.user.create' | 'proxmox.user.update';
      config: ProxmoxUserConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.user.delete';
      userId: string;
      reason: string;
    }
  | {
      kind: 'proxmox.token.create' | 'proxmox.token.update';
      config: ProxmoxTokenConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.token.delete';
      userId: string;
      tokenId: string;
      reason: string;
    }
  | {
      kind: 'proxmox.acl.upsert';
      config: ProxmoxAclConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.acl.delete';
      config: ProxmoxAclConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.role.create' | 'proxmox.role.update';
      config: ProxmoxRoleConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.role.delete';
      roleId: string;
      reason: string;
    }
  | {
      kind: 'proxmox.group.create' | 'proxmox.group.update';
      config: ProxmoxGroupConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.group.delete';
      groupId: string;
      reason: string;
    }
  | {
      kind: 'proxmox.realm.create' | 'proxmox.realm.update';
      config: ProxmoxRealmConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.realm.delete';
      realm: string;
      reason: string;
    }
  | {
      kind: 'proxmox.tfa.create' | 'proxmox.tfa.update';
      config: ProxmoxTfaConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.tfa.delete';
      userId: string;
      id: string;
      reason: string;
    }
  | {
      kind: 'proxmox.cluster-options.update';
      config: ProxmoxClusterOptionsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.pool.create' | 'proxmox.pool.update';
      config: ProxmoxPoolConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.pool.delete';
      poolId: string;
      reason: string;
    }
  | {
      kind: 'proxmox.backup-job.create' | 'proxmox.backup-job.update';
      config: ProxmoxBackupJobConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.backup-job.delete';
      id: string;
      reason: string;
    }
  | {
      kind: 'proxmox.replication-job.create' | 'proxmox.replication-job.update';
      config: ProxmoxReplicationJobConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.replication-job.delete';
      id: string;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-options.update';
      config: ProxmoxDatacenterFirewallOptionsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-dns.update';
      config: ProxmoxNodeDnsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-hosts.update';
      config: ProxmoxNodeHostsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-options.update';
      config: ProxmoxNodeOptionsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-time.update';
      config: ProxmoxNodeTimeConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-service.action';
      config: ProxmoxNodeServiceActionConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-apt.action';
      config: ProxmoxNodeAptActionConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-certificate.request';
      config: ProxmoxNodeCertificateRequestConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-ceph.action';
      config: ProxmoxNodeCephActionConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-firewall-options.update';
      config: ProxmoxNodeFirewallOptionsConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-firewall-rule.upsert';
      config: ProxmoxNodeFirewallRuleConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-firewall-rule.delete';
      node: string;
      id: string;
      reason: string;
    }
  | {
      kind: 'proxmox.node-certificate-custom.upsert';
      config: ProxmoxNodeCertificateCustomConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-certificate-custom.delete';
      node: string;
      reason: string;
    }
  | {
      kind: 'proxmox.node-certificate-acme.upsert';
      config: ProxmoxNodeCertificateAcmeConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-certificate-acme.delete';
      node: string;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-zone.create' | 'proxmox.sdn-zone.update';
      config: ProxmoxSdnZoneConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-zone.delete';
      zone: string;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-vnet.create' | 'proxmox.sdn-vnet.update';
      config: ProxmoxSdnVnetConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-vnet.delete';
      vnet: string;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-subnet.create' | 'proxmox.sdn-subnet.update';
      config: ProxmoxSdnSubnetConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-subnet.delete';
      vnet: string;
      subnet: string;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-ipam.update';
      config: ProxmoxSdnIpamConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.sdn-ipam.delete';
      ipam: string;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-alias.update';
      config: ProxmoxDatacenterFirewallAliasConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-alias.delete';
      name: string;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-ipset.update';
      config: ProxmoxDatacenterFirewallIpsetConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-ipset.delete';
      name: string;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-rule.upsert';
      config: ProxmoxDatacenterFirewallRuleConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter-firewall-rule.delete';
      id: string;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.migrate';
      config: ProxmoxVmMigrationConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ct.migrate';
      config: ProxmoxCtMigrationConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.backup';
      config: ProxmoxVmBackupConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ct.backup';
      config: ProxmoxCtBackupConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.restore';
      config: ProxmoxVmRestoreConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ct.restore';
      config: ProxmoxCtRestoreConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.snapshot.create' | 'proxmox.vm.snapshot.delete';
      config: ProxmoxVmSnapshotPolicyConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ct.snapshot.create' | 'proxmox.ct.snapshot.delete';
      config: ProxmoxCtSnapshotPolicyConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.guest-agent.command';
      config: ProxmoxVmGuestAgentConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.storage-content.delete';
      config: ProxmoxStorageContentConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.disk.move';
      config: ProxmoxVmDiskMoveConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.disk.import';
      config: ProxmoxVmDiskImportConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.vm.disk.clone';
      config: ProxmoxVmDiskCloneConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.storage-content.copy';
      config: ProxmoxStorageContentCopyConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-disk.initialize';
      config: ProxmoxNodeDiskInitializeConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-lvm.create';
      config: ProxmoxNodeLvmCreateConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-lvmthin.create';
      config: ProxmoxNodeLvmThinCreateConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-zfs.create';
      config: ProxmoxNodeZfsCreateConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-group.update';
      config: ProxmoxHaGroupConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-group.delete';
      group: string;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-resource.update';
      config: ProxmoxHaResourceConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-resource.delete';
      sid: string;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-rule.update';
      config: ProxmoxHaRuleConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-rule.delete';
      rule: string;
      reason: string;
    }
  | {
      kind: 'proxmox.ceph-flag.update';
      config: ProxmoxCephFlagConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ceph-flag.delete';
      flag: string;
      reason: string;
    }
  | {
      kind: 'proxmox.ha-status.read';
      config: ProxmoxHaStatusQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.ceph.read';
      config: ProxmoxCephReadQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-ceph.read';
      config: ProxmoxNodeCephReadQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-task.read';
      config: ProxmoxNodeTaskQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.cluster-task.read';
      config: ProxmoxClusterTaskQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-task.log.read';
      config: ProxmoxNodeTaskLogQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.node-firewall.log.read';
      config: ProxmoxNodeFirewallLogQueryConfig;
      reason: string;
    }
  | {
      kind: 'proxmox.datacenter.create' | 'proxmox.datacenter.read' | 'proxmox.datacenter.update' | 'proxmox.datacenter.delete';
      path: string;
      payload?: Record<string, string | number | boolean>;
      reason: string;
    }
  | {
      kind: 'proxmox.node.create' | 'proxmox.node.read' | 'proxmox.node.update' | 'proxmox.node.delete';
      node: string;
      path: string;
      payload?: Record<string, string | number | boolean>;
      reason: string;
    };

export interface ConfigChange {
  path: string; // "cpu.cores", "memory.size", etc.
  oldValue: unknown;
  newValue: unknown;
  requiresReboot: boolean;
}

export interface Plan {
  generatedAt: string;
  env: EnvironmentName;
  actions: PlanAction[];
}

export interface ActionResult {
  action: PlanAction;
  success: boolean;
  startedAt: string;
  finishedAt: string;
  message: string;
  output?: string;
}

export interface ApplyResult {
  generatedAt: string;
  env: EnvironmentName;
  dryRun: boolean;
  ok: boolean;
  results: ActionResult[];
  rollback?: {
    attempted: boolean;
    ok: boolean;
    results: ActionResult[];
    message?: string;
  };
}

export interface ConfigFile {
  proxmox?: {
    endpoint: string;
    insecure?: boolean;
    timeoutMs?: number;
    tokenIdEnv?: string;
    tokenSecretEnv?: string;
    usernameEnv?: string;
    passwordEnv?: string;
    realm?: string;
  };
  docker?: {
    host?: string;
  };
  grafana?: {
    endpoint?: string;
    tokenEnv?: string;
    insecure?: boolean;
    timeoutMs?: number;
    orgId?: number;
  };
  desiredSpecPath: string;
}
