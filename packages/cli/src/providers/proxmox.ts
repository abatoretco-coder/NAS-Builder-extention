import https from 'node:https';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import type {
  ProxmoxCt, 
  ProxmoxNetworkState,
  ProxmoxNode, 
  ProxmoxStorageState,
  ProxmoxDatacenterState,
  ProxmoxNodeAdminState,
  ProxmoxVm, 
  VmProvisionConfig, 
  ContainerProvisionConfig,
  DiskConfig,
  ConfigChange,
  NetworkConfig,
  StorageConfig,
  ProxmoxUserConfig,
  ProxmoxTokenConfig,
  ProxmoxAclConfig,
  ProxmoxRoleConfig,
  ProxmoxGroupConfig,
  ProxmoxRealmConfig,
  ProxmoxTfaConfig,
  ProxmoxClusterOptionsConfig,
  ProxmoxPoolConfig,
  ProxmoxBackupJobConfig,
  ProxmoxReplicationJobConfig,
  ProxmoxDatacenterFirewallOptionsConfig,
  ProxmoxNodeDnsConfig,
  ProxmoxNodeHostsConfig,
  ProxmoxNodeOptionsConfig,
  ProxmoxNodeTimeConfig,
  ProxmoxNodeServiceActionConfig,
  ProxmoxNodeAptActionConfig,
  ProxmoxNodeCertificateRequestConfig,
  ProxmoxNodeFirewallOptionsConfig,
  ProxmoxNodeFirewallRuleConfig,
  ProxmoxNodeCertificateCustomConfig,
  ProxmoxNodeCertificateAcmeConfig,
  ProxmoxSdnZoneConfig,
  ProxmoxSdnVnetConfig,
  ProxmoxSdnSubnetConfig,
  ProxmoxSdnIpamConfig,
  ProxmoxDatacenterFirewallAliasConfig,
  ProxmoxDatacenterFirewallIpsetConfig,
  ProxmoxDatacenterFirewallRuleConfig,
  ProxmoxVmMigrationConfig,
  ProxmoxCtMigrationConfig,
  ProxmoxVmBackupConfig,
  ProxmoxCtBackupConfig,
  ProxmoxVmRestoreConfig,
  ProxmoxCtRestoreConfig,
  ProxmoxVmSnapshotPolicyConfig,
  ProxmoxCtSnapshotPolicyConfig,
  ProxmoxVmGuestAgentConfig,
  ProxmoxStorageContentConfig,
  ProxmoxStorageContentCopyConfig,
  ProxmoxVmDiskMoveConfig,
  ProxmoxVmDiskImportConfig,
  ProxmoxVmDiskCloneConfig,
  ProxmoxNodeDiskInitializeConfig,
  ProxmoxNodeLvmCreateConfig,
  ProxmoxNodeLvmThinCreateConfig,
  ProxmoxNodeZfsCreateConfig,
  ProxmoxHaGroupConfig,
  ProxmoxHaResourceConfig,
  ProxmoxHaRuleConfig,
  ProxmoxCephFlagConfig,
  ProxmoxHaStatusQueryConfig,
  ProxmoxCephReadQueryConfig,
  ProxmoxNodeCephReadQueryConfig,
  ProxmoxNodeCephActionConfig,
  ProxmoxNodeTaskQueryConfig,
  ProxmoxClusterTaskQueryConfig,
  ProxmoxNodeTaskLogQueryConfig,
  ProxmoxNodeFirewallLogQueryConfig
} from '@naas/shared';
import type { ProxmoxAuth } from '../config/secrets.js';
import { errorMessage } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';
import { evaluateGenericCrudPolicy, type CrudPayload } from './proxmoxCrudPolicy.js';
import { ProxmoxIamApi } from './proxmoxIam.js';

interface ProxmoxApiResponse<T> {
  data: T;
}

interface ProxmoxNodeSummary {
  node: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
}

interface ProxmoxVmSummary {
  vmid: number;
  name?: string;
  status?: string;
}

interface ProxmoxCtSummary {
  vmid: number;
  name?: string;
  status?: string;
}

interface ProxmoxNetworkSummary {
  iface: string;
  type: string;
  [key: string]: string | number | boolean | undefined;
}

interface ProxmoxStorageSummary {
  storage: string;
  type: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ProxmoxTaskProgress {
  node: string;
  upid: string;
  operation: string;
  status: string;
  details?: string;
}

export type ProxmoxTaskProgressHandler = (progress: ProxmoxTaskProgress) => void;

export class ProxmoxProvider {
  private readonly client: AxiosInstance;
  private readonly auth: ProxmoxAuth;
  private readonly iam: ProxmoxIamApi;
  private readonly nodeCephSupportCache = new Map<string, boolean>();

  constructor(auth: ProxmoxAuth) {
    this.auth = auth;
    if (auth.insecure) {
      console.warn(
        '[naasctl] WARNING: Proxmox TLS verification is disabled (insecure: true). ' +
        'This exposes credentials to network interception. Do not use in production.'
      );
    }
    this.client = axios.create({
      baseURL: `${auth.endpoint}/api2/json`,
      timeout: auth.timeoutMs ?? 10_000,
      httpsAgent: new https.Agent({ rejectUnauthorized: !auth.insecure })
    });
    this.iam = new ProxmoxIamApi(this.client);
  }

  async initialize(): Promise<void> {
    if (this.auth.tokenId && this.auth.tokenSecret) {
      this.client.defaults.headers.common.Authorization = `PVEAPIToken=${this.auth.tokenId}=${this.auth.tokenSecret}`;
      return;
    }

    if (!this.auth.username || !this.auth.password) {
      throw new Error('Proxmox auth missing. Provide token or username/password env values.');
    }

    const realm = this.auth.realm ?? 'pam';
    const username = this.auth.username.includes('@')
      ? this.auth.username
      : `${this.auth.username}@${realm}`;

    const response = await this.client.post<ProxmoxApiResponse<{ ticket: string; CSRFPreventionToken: string }>>(
      '/access/ticket',
      new URLSearchParams({ username, password: this.auth.password })
    );

    const ticket = response.data.data.ticket;
    const csrf = response.data.data.CSRFPreventionToken;
    this.client.defaults.headers.common.Cookie = `PVEAuthCookie=${ticket}`;
    this.client.defaults.headers.common.CSRFPreventionToken = csrf;
  }

  async scan(): Promise<{
    nodes: ProxmoxNode[];
    vms: ProxmoxVm[];
    cts: ProxmoxCt[];
    networks: ProxmoxNetworkState[];
    storage: ProxmoxStorageState[];
    datacenter?: ProxmoxDatacenterState;
    nodeAdmin?: Record<string, ProxmoxNodeAdminState>;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    const nodes = await this.safeCall(async () => {
      const response = await this.client.get<ProxmoxApiResponse<ProxmoxNodeSummary[]>>('/nodes');
      return response.data.data.map((node) => ({
        id: node.node,
        name: node.node,
        status: node.status,
        cpuUsage: node.cpu,
        memoryUsedBytes: node.mem,
        memoryTotalBytes: node.maxmem
      }));
    }, warnings, 'Failed to scan Proxmox nodes', []);

    const vms: ProxmoxVm[] = [];
    const cts: ProxmoxCt[] = [];
    const networks: ProxmoxNetworkState[] = [];

    for (const node of nodes) {
      const nodeVms = await this.safeCall(async () => this.scanNodeVms(node.name), warnings, `VM scan failed on ${node.name}`, []);
      vms.push(...nodeVms);

      const nodeCts = await this.safeCall(async () => this.scanNodeCts(node.name), warnings, `LXC scan failed on ${node.name}`, []);
      cts.push(...nodeCts);

      const nodeNetworks = await this.safeCall(
        async () => this.scanNodeNetworks(node.name),
        warnings,
        `Network scan failed on ${node.name}`,
        []
      );
      networks.push(...nodeNetworks);
    }

    const storage = await this.safeCall(async () => this.scanStorage(), warnings, 'Storage scan failed', []);

    let datacenter: ProxmoxDatacenterState | undefined;
    try {
      datacenter = await this.scanDatacenter(warnings);
    } catch (error) {
      warnings.push(`Datacenter scan failed: ${errorMessage(error)}`);
    }

    const nodeAdmin: Record<string, ProxmoxNodeAdminState> = {};
    for (const node of nodes) {
      try {
        nodeAdmin[node.name] = await this.scanNodeAdmin(node.name, warnings);
      } catch (error) {
        warnings.push(`Node admin scan failed on ${node.name}: ${errorMessage(error)}`);
      }
    }

    return { nodes, vms, cts, networks, storage, datacenter, nodeAdmin, warnings };
  }

  async datacenterRequest(
    method: 'create' | 'read' | 'update' | 'delete',
    path: string,
    payload?: Record<string, string | number | boolean>
  ): Promise<unknown> {
    const policy = evaluateGenericCrudPolicy('datacenter', method, path, payload as CrudPayload | undefined);
    if (!policy.ok) {
      throw new Error(policy.reason ?? 'Datacenter CRUD policy validation failed');
    }

    const normalizedPath = policy.normalizedPath;
    const safePayload = policy.sanitizedPayload;

    try {
      switch (method) {
        case 'create': {
          const response = await withRetry(async () => this.client.post(normalizedPath, safePayload ?? {}));
          return response.data?.data;
        }
        case 'read': {
          const response = await withRetry(async () => this.client.get(normalizedPath, { params: safePayload ?? {} }));
          return response.data?.data;
        }
        case 'update': {
          const response = await withRetry(async () => this.client.put(normalizedPath, safePayload ?? {}));
          return response.data?.data;
        }
        case 'delete': {
          const response = await withRetry(async () => this.client.delete(normalizedPath, { data: safePayload ?? {} }));
          return response.data?.data;
        }
        default:
          throw new Error(`Unsupported datacenter method ${method}`);
      }
    } catch (error) {
      throw new Error(`Datacenter ${method.toUpperCase()} ${normalizedPath} failed: ${errorMessage(error)}`);
    }
  }

  async nodeRequest(
    node: string,
    method: 'create' | 'read' | 'update' | 'delete',
    path: string,
    payload?: Record<string, string | number | boolean>
  ): Promise<unknown> {
    const policy = evaluateGenericCrudPolicy('node', method, path, payload as CrudPayload | undefined);
    if (!policy.ok) {
      throw new Error(policy.reason ?? 'Node CRUD policy validation failed');
    }

    const normalizedPath = policy.normalizedPath;
    const safePayload = policy.sanitizedPayload;
    const fullPath = `/nodes/${encodeURIComponent(node)}${normalizedPath}`;

    try {
      switch (method) {
        case 'create': {
          const response = await withRetry(async () => this.client.post(fullPath, safePayload ?? {}));
          return response.data?.data;
        }
        case 'read': {
          const response = await withRetry(async () => this.client.get(fullPath, { params: safePayload ?? {} }));
          return response.data?.data;
        }
        case 'update': {
          const response = await withRetry(async () => this.client.put(fullPath, safePayload ?? {}));
          return response.data?.data;
        }
        case 'delete': {
          const response = await withRetry(async () => this.client.delete(fullPath, { data: safePayload ?? {} }));
          return response.data?.data;
        }
        default:
          throw new Error(`Unsupported node method ${method}`);
      }
    } catch (error) {
      throw new Error(`Node ${node} ${method.toUpperCase()} ${normalizedPath} failed: ${errorMessage(error)}`);
    }
  }

  async startVm(node: string, vmid: number, vmType: 'qemu' | 'lxc'): Promise<void> {
    await this.runAction(node, vmid, vmType, 'start');
  }

  async stopVm(node: string, vmid: number, vmType: 'qemu' | 'lxc'): Promise<void> {
    await this.runAction(node, vmid, vmType, 'stop');
  }

  async rebootVm(node: string, vmid: number, vmType: 'qemu' | 'lxc'): Promise<void> {
    await this.runAction(node, vmid, vmType, 'reboot');
  }

  async snapshotQemu(node: string, vmid: number, name: string): Promise<void> {
    await withRetry(async () => {
      await this.client.post(`/nodes/${node}/qemu/${vmid}/snapshot`, {
        snapname: name,
        description: `Created by naasctl at ${new Date().toISOString()}`
      });
    });
  }

  async migrateVm(config: ProxmoxVmMigrationConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      target: config.target
    };
    if (config.online !== undefined) {
      payload.online = config.online ? 1 : 0;
    }
    if (config.withLocalDisks !== undefined) {
      payload['with-local-disks'] = config.withLocalDisks ? 1 : 0;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `VM migrate ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/migrate`, payload),
      onProgress
    );
  }

  async migrateCt(config: ProxmoxCtMigrationConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      target: config.target
    };
    if (config.restart !== undefined) {
      payload.restart = config.restart ? 1 : 0;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `CT migrate ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/lxc/${config.vmid}/migrate`, payload),
      onProgress
    );
  }

  async backupVm(config: ProxmoxVmBackupConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload = this.toVzdumpPayload(config.vmid, config);
    await this.executeNodeTaskAndWait(
      config.node,
      `VM backup ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/vzdump`, payload),
      onProgress
    );
  }

  async backupCt(config: ProxmoxCtBackupConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload = this.toVzdumpPayload(config.vmid, config);
    await this.executeNodeTaskAndWait(
      config.node,
      `CT backup ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/vzdump`, payload),
      onProgress
    );
  }

  async restoreVm(config: ProxmoxVmRestoreConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      vmid: config.vmid,
      archive: config.archive
    };
    if (config.storage) {
      payload.storage = config.storage;
    }
    if (config.force !== undefined) {
      payload.force = config.force ? 1 : 0;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `VM restore ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu`, payload),
      onProgress
    );
  }

  async restoreCt(config: ProxmoxCtRestoreConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      vmid: config.vmid,
      archive: config.archive
    };
    if (config.storage) {
      payload.storage = config.storage;
    }
    if (config.force !== undefined) {
      payload.force = config.force ? 1 : 0;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `CT restore ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/lxc`, payload),
      onProgress
    );
  }

  async createVmSnapshot(config: ProxmoxVmSnapshotPolicyConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      snapname: config.name
    };
    if (config.description) {
      payload.description = config.description;
    }
    if (config.vmstate !== undefined) {
      payload.vmstate = config.vmstate ? 1 : 0;
    }
    await this.executeNodeTaskAndWait(
      config.node,
      `VM snapshot create ${config.vmid}/${config.name}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/snapshot`, payload),
      onProgress
    );
  }

  async deleteVmSnapshot(config: ProxmoxVmSnapshotPolicyConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `VM snapshot delete ${config.vmid}/${config.name}`,
      () => this.client.delete(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/snapshot/${encodeURIComponent(config.name)}`),
      onProgress
    );
  }

  async createCtSnapshot(config: ProxmoxCtSnapshotPolicyConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      snapname: config.name
    };
    if (config.description) {
      payload.description = config.description;
    }
    await this.executeNodeTaskAndWait(
      config.node,
      `CT snapshot create ${config.vmid}/${config.name}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/lxc/${config.vmid}/snapshot`, payload),
      onProgress
    );
  }

  async deleteCtSnapshot(config: ProxmoxCtSnapshotPolicyConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `CT snapshot delete ${config.vmid}/${config.name}`,
      () => this.client.delete(`/nodes/${encodeURIComponent(config.node)}/lxc/${config.vmid}/snapshot/${encodeURIComponent(config.name)}`),
      onProgress
    );
  }

  async runVmGuestAgentCommand(config: ProxmoxVmGuestAgentConfig): Promise<unknown> {
    const response = await withRetry(async () =>
      this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/agent/${encodeURIComponent(config.command)}`, config.payload ?? {})
    );
    return response.data?.data;
  }

  async deleteStorageContent(config: ProxmoxStorageContentConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `Storage content delete ${config.storage}/${config.volume}`,
      () =>
        this.client.delete(
          `/nodes/${encodeURIComponent(config.node)}/storage/${encodeURIComponent(config.storage)}/content/${encodeURIComponent(config.volume)}`
        ),
      onProgress
    );
  }

  async moveVmDisk(config: ProxmoxVmDiskMoveConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      disk: config.disk,
      storage: config.targetStorage
    };
    if (config.deleteSource !== undefined) {
      payload.delete = config.deleteSource ? 1 : 0;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `VM disk move ${config.vmid}/${config.disk}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/move_disk`, payload),
      onProgress
    );
  }

  async importVmDisk(config: ProxmoxVmDiskImportConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      source: config.source,
      storage: config.storage
    };
    if (config.format) {
      payload.format = config.format;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `VM disk import ${config.vmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/importdisk`, payload),
      onProgress
    );
  }

  async cloneVmDisk(config: ProxmoxVmDiskCloneConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      disk: config.disk,
      storage: config.targetStorage,
      'target-vmid': config.targetVmid,
      delete: 0
    };
    if (config.targetDisk) {
      payload['target-disk'] = config.targetDisk;
    }
    if (config.format) {
      payload.format = config.format;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `VM disk clone ${config.vmid}/${config.disk} -> ${config.targetVmid}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/qemu/${config.vmid}/move_disk`, payload),
      onProgress
    );
  }

  async copyStorageContent(config: ProxmoxStorageContentCopyConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `Storage content copy ${config.storage}/${config.volume} -> ${config.targetStorage}`,
      () =>
        this.client.post(
          `/nodes/${encodeURIComponent(config.node)}/storage/${encodeURIComponent(config.storage)}/content/${encodeURIComponent(config.volume)}`,
          {
            target: config.targetStorage
          }
        ),
      onProgress
    );
  }

  async initializeNodeDisk(config: ProxmoxNodeDiskInitializeConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `Node disk initgpt ${config.disk}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/disks/initgpt`, { disk: config.disk }),
      onProgress
    );
  }

  async createNodeLvm(config: ProxmoxNodeLvmCreateConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `Node LVM create ${config.name}`,
      () =>
        this.client.post(`/nodes/${encodeURIComponent(config.node)}/disks/lvm`, {
          name: config.name,
          device: config.device
        }),
      onProgress
    );
  }

  async createNodeLvmThin(config: ProxmoxNodeLvmThinCreateConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    await this.executeNodeTaskAndWait(
      config.node,
      `Node LVM-thin create ${config.volumeGroup}/${config.name}`,
      () =>
        this.client.post(`/nodes/${encodeURIComponent(config.node)}/disks/lvmthin`, {
          vgname: config.volumeGroup,
          name: config.name
        }),
      onProgress
    );
  }

  async createNodeZfs(config: ProxmoxNodeZfsCreateConfig, onProgress?: ProxmoxTaskProgressHandler): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      name: config.name,
      devices: config.devices.join(',')
    };
    if (config.raidLevel) {
      payload.raidlevel = config.raidLevel;
    }
    if (config.ashift !== undefined) {
      payload.ashift = config.ashift;
    }

    await this.executeNodeTaskAndWait(
      config.node,
      `Node ZFS create ${config.name}`,
      () => this.client.post(`/nodes/${encodeURIComponent(config.node)}/disks/zfs`, payload),
      onProgress
    );
  }

  async upsertHaGroup(config: ProxmoxHaGroupConfig): Promise<void> {
    const payload = this.toHaGroupPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/ha/groups', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateHaGroup(config);
    }
  }

  async updateHaGroup(config: ProxmoxHaGroupConfig): Promise<void> {
    const payload = this.toHaGroupPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/ha/groups/${encodeURIComponent(config.group)}`, payload);
    });
  }

  async deleteHaGroup(group: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/ha/groups/${encodeURIComponent(group)}`);
    });
  }

  async upsertHaResource(config: ProxmoxHaResourceConfig): Promise<void> {
    const payload = this.toHaResourcePayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/ha/resources', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateHaResource(config);
    }
  }

  async updateHaResource(config: ProxmoxHaResourceConfig): Promise<void> {
    const payload = this.toHaResourcePayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/ha/resources/${encodeURIComponent(config.sid)}`, payload);
    });
  }

  async deleteHaResource(sid: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/ha/resources/${encodeURIComponent(sid)}`);
    });
  }

  async upsertHaRule(config: ProxmoxHaRuleConfig): Promise<void> {
    const payload = this.toHaRulePayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/ha/rules', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateHaRule(config);
    }
  }

  async updateHaRule(config: ProxmoxHaRuleConfig): Promise<void> {
    const payload = this.toHaRulePayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/ha/rules/${encodeURIComponent(config.rule)}`, payload);
    });
  }

  async deleteHaRule(rule: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/ha/rules/${encodeURIComponent(rule)}`);
    });
  }

  async setCephFlag(config: ProxmoxCephFlagConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.put(`/cluster/ceph/flags/${encodeURIComponent(config.flag)}`);
    });
  }

  async clearCephFlag(flag: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/ceph/flags/${encodeURIComponent(flag)}`);
    });
  }

  async readHaStatus(_config: ProxmoxHaStatusQueryConfig): Promise<unknown> {
    const response = await withRetry(async () => this.client.get('/cluster/ha/status'));
    return response.data?.data;
  }

  async readCeph(config: ProxmoxCephReadQueryConfig): Promise<unknown> {
    const pathBySection: Record<ProxmoxCephReadQueryConfig['section'], string> = {
      overview: '/cluster/ceph',
      status: '/cluster/ceph/status',
      metadata: '/cluster/ceph/metadata',
      flags: '/cluster/ceph/flags'
    };
    const path = pathBySection[config.section];
    const response = await withRetry(async () => this.client.get(path));
    return response.data?.data;
  }

  async readNodeCeph(config: ProxmoxNodeCephReadQueryConfig): Promise<unknown> {
    const node = config.node;
    const supported = await this.hasNodeCephEndpoints(node);
    if (!supported) {
      throw new Error(
        `Node ${node} does not expose /nodes/{node}/ceph* endpoints on this cluster/version; skip proxmoxNodeCephRead for this node or upgrade Ceph/Proxmox features.`
      );
    }

    const section = config.section?.trim();
    const path = !section || section === 'overview'
      ? `/nodes/${encodeURIComponent(node)}/ceph`
      : `/nodes/${encodeURIComponent(node)}/ceph/${encodeURIComponent(section)}`;

    const response = await withRetry(async () => this.client.get(path));
    return response.data?.data;
  }

  async runNodeCephAction(config: ProxmoxNodeCephActionConfig): Promise<unknown> {
    const node = config.node;
    const supported = await this.hasNodeCephEndpoints(node);
    if (!supported) {
      throw new Error(
        `Node ${node} does not expose /nodes/{node}/ceph* endpoints on this cluster/version; skip proxmoxNodeCephActions for this node or upgrade Ceph/Proxmox features.`
      );
    }

    if (config.confirm !== 'I_UNDERSTAND') {
      throw new Error('High-risk node Ceph write requires confirm=I_UNDERSTAND');
    }

    const section = config.section?.trim();
    const path = !section || section === 'overview'
      ? `/nodes/${encodeURIComponent(node)}/ceph`
      : `/nodes/${encodeURIComponent(node)}/ceph/${encodeURIComponent(section)}`;

    switch (config.method) {
      case 'create': {
        const response = await withRetry(async () => this.client.post(path, config.payload ?? {}));
        return response.data?.data;
      }
      case 'update': {
        const response = await withRetry(async () => this.client.put(path, config.payload ?? {}));
        return response.data?.data;
      }
      case 'delete': {
        const response = await withRetry(async () => this.client.delete(path, { data: config.payload ?? {} }));
        return response.data?.data;
      }
      default:
        throw new Error(`Unsupported node Ceph method ${String(config.method)}`);
    }
  }

  async readNodeTasks(config: ProxmoxNodeTaskQueryConfig): Promise<unknown> {
    const basePath = `/nodes/${encodeURIComponent(config.node)}/tasks`;
    const upid = config.upid;
    if (upid) {
      const response = await withRetry(async () =>
        this.client.get(`${basePath}/${encodeURIComponent(upid)}/status`)
      );
      return response.data?.data;
    }

    const params: Record<string, string | number> = {};
    if (config.limit !== undefined) {
      params.limit = config.limit;
    }
    if (config.source) {
      params.source = config.source;
    }
    if (config.running !== undefined) {
      params.running = config.running ? 1 : 0;
    }
    if (config.since !== undefined) {
      params.since = config.since;
    }

    const response = await withRetry(async () => this.client.get(basePath, { params }));
    return response.data?.data;
  }

  async readClusterTasks(config: ProxmoxClusterTaskQueryConfig): Promise<unknown> {
    const params: Record<string, string | number> = {};
    if (config.limit !== undefined) {
      params.limit = config.limit;
    }
    if (config.source) {
      params.source = config.source;
    }
    if (config.running !== undefined) {
      params.running = config.running ? 1 : 0;
    }
    if (config.since !== undefined) {
      params.since = config.since;
    }

    const response = await withRetry(async () => this.client.get('/cluster/tasks', { params }));
    return response.data?.data;
  }

  async readNodeTaskLog(config: ProxmoxNodeTaskLogQueryConfig): Promise<unknown> {
    const params: Record<string, string | number> = {};
    if (config.start !== undefined) {
      params.start = config.start;
    }
    if (config.limit !== undefined) {
      params.limit = config.limit;
    }

    const response = await withRetry(async () =>
      this.client.get(
        `/nodes/${encodeURIComponent(config.node)}/tasks/${encodeURIComponent(config.upid)}/log`,
        { params }
      )
    );
    return response.data?.data;
  }

  async readNodeFirewallLog(config: ProxmoxNodeFirewallLogQueryConfig): Promise<unknown> {
    const params: Record<string, string | number> = {};
    if (config.limit !== undefined) {
      params.limit = config.limit;
    }
    if (config.since !== undefined) {
      params.since = config.since;
    }

    const response = await withRetry(async () =>
      this.client.get(`/nodes/${encodeURIComponent(config.node)}/firewall/log`, { params })
    );
    return response.data?.data;
  }

  async createVm(config: VmProvisionConfig): Promise<void> {
    const payload = this.toVmCreatePayload(config);
    try {
      await withRetry(async () => {
        await this.client.post(`/nodes/${config.node}/qemu`, payload);
      });
    } catch (error) {
      throw new Error(`Failed to create VM ${config.vmid} on node ${config.node}: ${errorMessage(error)}`);
    }
  }

  async cloneVm(node: string, sourceVmid: number, vmid: number, config: Partial<VmProvisionConfig>): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      newid: vmid,
      full: config.clone?.full ?? true
    };

    if (config.name) {
      payload.name = config.name;
    }
    if (config.clone?.pool) {
      payload.pool = config.clone.pool;
    }
    if (config.clone?.snapname) {
      payload.snapname = config.clone.snapname;
    }

    await withRetry(async () => {
      await this.client.post(`/nodes/${node}/qemu/${sourceVmid}/clone`, payload);
    });
  }

  async updateVmConfig(node: string, vmid: number, changes: ConfigChange[]): Promise<void> {
    const payload: Record<string, string | number | boolean> = {};

    for (const change of changes) {
      this.applyConfigChange(payload, change);
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await withRetry(async () => {
      await this.client.put(`/nodes/${node}/qemu/${vmid}/config`, payload);
    });
  }

  async deleteVm(node: string, vmid: number): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${node}/qemu/${vmid}`);
    });
  }

  async createContainer(config: ContainerProvisionConfig): Promise<void> {
    const payload = this.toCtCreatePayload(config);
    await withRetry(async () => {
      await this.client.post(`/nodes/${config.node}/lxc`, payload);
    });
  }

  async updateContainerConfig(node: string, vmid: number, changes: ConfigChange[]): Promise<void> {
    const payload: Record<string, string | number | boolean> = {};

    for (const change of changes) {
      this.applyConfigChange(payload, change);
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await withRetry(async () => {
      await this.client.put(`/nodes/${node}/lxc/${vmid}/config`, payload);
    });
  }

  async deleteContainer(node: string, vmid: number): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${node}/lxc/${vmid}`);
    });
  }

  async resizeVmDisk(node: string, vmid: number, disk: string, newSize: string): Promise<void> {
    await withRetry(async () => {
      await this.client.put(`/nodes/${node}/qemu/${vmid}/resize`, {
        disk,
        size: newSize
      });
    });
  }

  async attachVmDisk(node: string, vmid: number, disk: DiskConfig): Promise<void> {
    const key = `${disk.interface}${disk.index}`;
    const diskValueParts = [`${disk.storage}:${this.normalizeStorageSizeToken(disk.size)}`];

    if (disk.format) {
      diskValueParts.push(`format=${disk.format}`);
    }
    if (disk.cache) {
      diskValueParts.push(`cache=${disk.cache}`);
    }
    if (disk.discard) {
      diskValueParts.push(`discard=${disk.discard}`);
    }
    if (disk.ssd !== undefined) {
      diskValueParts.push(`ssd=${disk.ssd ? 1 : 0}`);
    }
    if (disk.iothread !== undefined) {
      diskValueParts.push(`iothread=${disk.iothread ? 1 : 0}`);
    }

    await withRetry(async () => {
      await this.client.put(`/nodes/${node}/qemu/${vmid}/config`, {
        [key]: diskValueParts.join(',')
      });
    });
  }

  async detachVmDisk(node: string, vmid: number, disk: string): Promise<void> {
    await withRetry(async () => {
      await this.client.put(`/nodes/${node}/qemu/${vmid}/config`, {
        delete: disk
      });
    });
  }

  async createNetwork(config: NetworkConfig): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      iface: config.name,
      type: config.type
    };

    if (config.bridge_ports) {
      payload.bridge_ports = config.bridge_ports;
    }
    if (config.bridge_vlan_aware !== undefined) {
      payload.bridge_vlan_aware = config.bridge_vlan_aware ? 1 : 0;
    }
    if (config.vlan_id !== undefined) {
      payload.vlan_id = config.vlan_id;
    }
    if (config.vlan_raw_device) {
      payload.vlan_raw_device = config.vlan_raw_device;
    }
    if (config.bond_mode) {
      payload.bond_mode = config.bond_mode;
    }
    if (config.slaves?.length) {
      payload.slaves = config.slaves.join(' ');
    }
    if (config.cidr) {
      payload.cidr = config.cidr;
    }
    if (config.gateway) {
      payload.gateway = config.gateway;
    }
    if (config.autostart !== undefined) {
      payload.autostart = config.autostart ? 1 : 0;
    }
    if (config.comments) {
      payload.comments = config.comments;
    }

    try {
      await withRetry(async () => {
        await this.client.post(`/nodes/${config.node}/network`, payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateNetwork(config);
    }
  }

  async deleteNetwork(node: string, name: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${node}/network/${name}`);
    });
  }

  async updateNetwork(config: NetworkConfig): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      type: config.type
    };

    if (config.bridge_ports) {
      payload.bridge_ports = config.bridge_ports;
    }
    if (config.bridge_vlan_aware !== undefined) {
      payload.bridge_vlan_aware = config.bridge_vlan_aware ? 1 : 0;
    }
    if (config.vlan_id !== undefined) {
      payload.vlan_id = config.vlan_id;
    }
    if (config.vlan_raw_device) {
      payload.vlan_raw_device = config.vlan_raw_device;
    }
    if (config.bond_mode) {
      payload.bond_mode = config.bond_mode;
    }
    if (config.slaves?.length) {
      payload.slaves = config.slaves.join(' ');
    }
    if (config.cidr) {
      payload.cidr = config.cidr;
    }
    if (config.gateway) {
      payload.gateway = config.gateway;
    }
    if (config.autostart !== undefined) {
      payload.autostart = config.autostart ? 1 : 0;
    }
    if (config.comments) {
      payload.comments = config.comments;
    }

    await withRetry(async () => {
      await this.client.put(`/nodes/${config.node}/network/${config.name}`, payload);
    });
  }

  async createStorage(config: StorageConfig): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      storage: config.name,
      type: config.type
    };

    if (config.content?.length) {
      payload.content = config.content.join(',');
    }
    if (config.path) {
      payload.path = config.path;
    }
    if (config.server) {
      payload.server = config.server;
    }
    if (config.export) {
      payload.export = config.export;
    }
    if (config.share) {
      payload.share = config.share;
    }
    if (config.username) {
      payload.username = config.username;
    }
    if (config.domain) {
      payload.domain = config.domain;
    }
    if (config.vgname) {
      payload.vgname = config.vgname;
    }
    if (config.pool) {
      payload.pool = config.pool;
    }
    if (config.blocksize) {
      payload.blocksize = config.blocksize;
    }
    if (config.sparse !== undefined) {
      payload.sparse = config.sparse ? 1 : 0;
    }
    if (config.maxfiles !== undefined) {
      payload.maxfiles = config.maxfiles;
    }
    if (config.prune_backups) {
      payload['prune-backups'] = config.prune_backups;
    }
    if (config.shared !== undefined) {
      payload.shared = config.shared ? 1 : 0;
    }
    if (config.disable !== undefined) {
      payload.disable = config.disable ? 1 : 0;
    }
    if (config.nodes?.length) {
      payload.nodes = config.nodes.join(',');
    }

    try {
      await withRetry(async () => {
        await this.client.post('/storage', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateStorage(config);
    }
  }

  async deleteStorage(name: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/storage/${name}`);
    });
  }

  async updateStorage(config: StorageConfig): Promise<void> {
    const payload: Record<string, string | number | boolean> = {
      type: config.type
    };

    if (config.content?.length) {
      payload.content = config.content.join(',');
    }
    if (config.path) {
      payload.path = config.path;
    }
    if (config.server) {
      payload.server = config.server;
    }
    if (config.export) {
      payload.export = config.export;
    }
    if (config.share) {
      payload.share = config.share;
    }
    if (config.username) {
      payload.username = config.username;
    }
    if (config.domain) {
      payload.domain = config.domain;
    }
    if (config.vgname) {
      payload.vgname = config.vgname;
    }
    if (config.pool) {
      payload.pool = config.pool;
    }
    if (config.blocksize) {
      payload.blocksize = config.blocksize;
    }
    if (config.sparse !== undefined) {
      payload.sparse = config.sparse ? 1 : 0;
    }
    if (config.maxfiles !== undefined) {
      payload.maxfiles = config.maxfiles;
    }
    if (config.prune_backups) {
      payload['prune-backups'] = config.prune_backups;
    }
    if (config.shared !== undefined) {
      payload.shared = config.shared ? 1 : 0;
    }
    if (config.disable !== undefined) {
      payload.disable = config.disable ? 1 : 0;
    }
    if (config.nodes?.length) {
      payload.nodes = config.nodes.join(',');
    }

    await withRetry(async () => {
      await this.client.put(`/storage/${config.name}`, payload);
    });
  }

  // ---------------------------------------------------------------------------
  // IAM operations — delegated to ProxmoxIamApi
  // ---------------------------------------------------------------------------

  async upsertUser(config: ProxmoxUserConfig): Promise<void> {
    return this.iam.upsertUser(config);
  }

  async updateUser(config: ProxmoxUserConfig): Promise<void> {
    return this.iam.updateUser(config);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.iam.deleteUser(userId);
  }

  async upsertToken(config: ProxmoxTokenConfig): Promise<void> {
    return this.iam.upsertToken(config);
  }

  async updateToken(config: ProxmoxTokenConfig): Promise<void> {
    return this.iam.updateToken(config);
  }

  async deleteToken(userId: string, tokenId: string): Promise<void> {
    return this.iam.deleteToken(userId, tokenId);
  }

  async upsertAcl(config: ProxmoxAclConfig): Promise<void> {
    return this.iam.upsertAcl(config);
  }

  async deleteAcl(config: ProxmoxAclConfig): Promise<void> {
    return this.iam.deleteAcl(config);
  }

  async upsertRole(config: ProxmoxRoleConfig): Promise<void> {
    return this.iam.upsertRole(config);
  }

  async updateRole(config: ProxmoxRoleConfig): Promise<void> {
    return this.iam.updateRole(config);
  }

  async deleteRole(roleId: string): Promise<void> {
    return this.iam.deleteRole(roleId);
  }

  async upsertGroup(config: ProxmoxGroupConfig): Promise<void> {
    return this.iam.upsertGroup(config);
  }

  async updateGroup(config: ProxmoxGroupConfig): Promise<void> {
    return this.iam.updateGroup(config);
  }

  async deleteGroup(groupId: string): Promise<void> {
    return this.iam.deleteGroup(groupId);
  }

  async upsertRealm(config: ProxmoxRealmConfig): Promise<void> {
    return this.iam.upsertRealm(config);
  }

  async updateRealm(config: ProxmoxRealmConfig): Promise<void> {
    return this.iam.updateRealm(config);
  }

  async deleteRealm(realm: string): Promise<void> {
    return this.iam.deleteRealm(realm);
  }

  async createTfa(config: ProxmoxTfaConfig): Promise<void> {
    return this.iam.createTfa(config);
  }

  async updateTfa(config: ProxmoxTfaConfig): Promise<void> {
    return this.iam.updateTfa(config);
  }

  async deleteTfa(userId: string, id: string): Promise<void> {
    return this.iam.deleteTfa(userId, id);
  }

  async updateClusterOptions(config: ProxmoxClusterOptionsConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.put('/cluster/options', { ...config.options });
    });
  }

  async upsertPool(config: ProxmoxPoolConfig): Promise<void> {
    const payload = this.toPoolPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/pools', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updatePool(config);
    }
  }

  async updatePool(config: ProxmoxPoolConfig): Promise<void> {
    const payload = this.toPoolPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/pools/${encodeURIComponent(config.poolId)}`, payload);
    });
  }

  async deletePool(poolId: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/pools/${encodeURIComponent(poolId)}`);
    });
  }

  async upsertBackupJob(config: ProxmoxBackupJobConfig): Promise<void> {
    const payload = this.toBackupJobPayload(config);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/backup', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateBackupJob(config);
    }
  }

  async updateBackupJob(config: ProxmoxBackupJobConfig): Promise<void> {
    const payload = this.toBackupJobPayload(config);
    await withRetry(async () => {
      await this.client.put(`/cluster/backup/${encodeURIComponent(config.id)}`, payload);
    });
  }

  async deleteBackupJob(id: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/backup/${encodeURIComponent(id)}`);
    });
  }

  async upsertReplicationJob(config: ProxmoxReplicationJobConfig): Promise<void> {
    const payload = this.toReplicationJobPayload(config);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/replication', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateReplicationJob(config);
    }
  }

  async updateReplicationJob(config: ProxmoxReplicationJobConfig): Promise<void> {
    const payload = this.toReplicationJobPayload(config);
    await withRetry(async () => {
      await this.client.put(`/cluster/replication/${encodeURIComponent(config.id)}`, payload);
    });
  }

  async deleteReplicationJob(id: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/replication/${encodeURIComponent(id)}`);
    });
  }

  async updateDatacenterFirewallOptions(config: ProxmoxDatacenterFirewallOptionsConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.put('/cluster/firewall/options', { ...config.options });
    });
  }

  async updateNodeDns(config: ProxmoxNodeDnsConfig): Promise<void> {
    await this.nodeRequest(config.node, 'update', '/dns', config.options);
  }

  async updateNodeHosts(config: ProxmoxNodeHostsConfig): Promise<void> {
    await this.nodeRequest(config.node, 'update', '/hosts', config.options);
  }

  async updateNodeOptions(config: ProxmoxNodeOptionsConfig): Promise<void> {
    await this.nodeRequest(config.node, 'update', '/config', config.options);
  }

  async updateNodeTime(config: ProxmoxNodeTimeConfig): Promise<void> {
    await this.nodeRequest(config.node, 'update', '/time', config.options);
  }

  async runNodeServiceAction(config: ProxmoxNodeServiceActionConfig): Promise<void> {
    await this.nodeRequest(
      config.node,
      'create',
      `/services/${encodeURIComponent(config.service)}/${encodeURIComponent(config.action)}`,
      config.payload
    );
  }

  async runNodeAptAction(config: ProxmoxNodeAptActionConfig): Promise<void> {
    const path = config.action === 'update' ? '/apt/update' : '/apt/upgrade';
    await this.nodeRequest(config.node, 'create', path, config.payload);
  }

  async requestNodeCertificate(config: ProxmoxNodeCertificateRequestConfig): Promise<unknown> {
    const normalized = config.path.startsWith('/') ? config.path : `/${config.path}`;
    if (!normalized.startsWith('/certificates')) {
      throw new Error(`Node certificate request path must start with /certificates (got ${config.path})`);
    }
    return this.nodeRequest(config.node, config.method, normalized, config.payload);
  }

  async updateNodeFirewallOptions(config: ProxmoxNodeFirewallOptionsConfig): Promise<void> {
    await this.nodeRequest(config.node, 'update', '/firewall/options', config.options);
  }

  async upsertNodeFirewallRule(config: ProxmoxNodeFirewallRuleConfig): Promise<void> {
    if (config.id) {
      await this.updateNodeFirewallRule(config);
      return;
    }

    const payload = this.toNodeFirewallRulePayload(config, false);
    await withRetry(async () => {
      await this.client.post(`/nodes/${encodeURIComponent(config.node)}/firewall/rules`, payload);
    });
  }

  async updateNodeFirewallRule(config: ProxmoxNodeFirewallRuleConfig): Promise<void> {
    if (!config.id) {
      throw new Error('Node firewall rule update requires id');
    }
    const ruleId = config.id;
    const payload = this.toNodeFirewallRulePayload(config, true);
    await withRetry(async () => {
      await this.client.put(`/nodes/${encodeURIComponent(config.node)}/firewall/rules/${encodeURIComponent(ruleId)}`, payload);
    });
  }

  async deleteNodeFirewallRule(node: string, id: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${encodeURIComponent(node)}/firewall/rules/${encodeURIComponent(id)}`);
    });
  }

  async upsertNodeCustomCertificate(config: ProxmoxNodeCertificateCustomConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.post(`/nodes/${encodeURIComponent(config.node)}/certificates/custom`, config.payload ?? {});
    });
  }

  async deleteNodeCustomCertificate(node: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${encodeURIComponent(node)}/certificates/custom`);
    });
  }

  async upsertNodeAcmeCertificate(config: ProxmoxNodeCertificateAcmeConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.post(`/nodes/${encodeURIComponent(config.node)}/certificates/acme/certificate`, config.payload ?? {});
    });
  }

  async deleteNodeAcmeCertificate(node: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/nodes/${encodeURIComponent(node)}/certificates/acme/certificate`);
    });
  }

  async upsertSdnZone(config: ProxmoxSdnZoneConfig): Promise<void> {
    const payload = this.toSdnZonePayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/sdn/zones', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateSdnZone(config);
    }
  }

  async updateSdnZone(config: ProxmoxSdnZoneConfig): Promise<void> {
    const payload = this.toSdnZonePayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/sdn/zones/${encodeURIComponent(config.zone)}`, payload);
    });
  }

  async deleteSdnZone(zone: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/sdn/zones/${encodeURIComponent(zone)}`);
    });
  }

  async upsertSdnVnet(config: ProxmoxSdnVnetConfig): Promise<void> {
    const payload = this.toSdnVnetPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/sdn/vnets', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateSdnVnet(config);
    }
  }

  async updateSdnVnet(config: ProxmoxSdnVnetConfig): Promise<void> {
    const payload = this.toSdnVnetPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/sdn/vnets/${encodeURIComponent(config.vnet)}`, payload);
    });
  }

  async deleteSdnVnet(vnet: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/sdn/vnets/${encodeURIComponent(vnet)}`);
    });
  }

  async upsertSdnSubnet(config: ProxmoxSdnSubnetConfig): Promise<void> {
    const payload = this.toSdnSubnetPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post(`/cluster/sdn/vnets/${encodeURIComponent(config.vnet)}/subnets`, payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateSdnSubnet(config);
    }
  }

  async updateSdnSubnet(config: ProxmoxSdnSubnetConfig): Promise<void> {
    const payload = this.toSdnSubnetPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/sdn/vnets/${encodeURIComponent(config.vnet)}/subnets/${encodeURIComponent(config.subnet)}`, payload);
    });
  }

  async deleteSdnSubnet(vnet: string, subnet: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/sdn/vnets/${encodeURIComponent(vnet)}/subnets/${encodeURIComponent(subnet)}`);
    });
  }

  async upsertSdnIpam(config: ProxmoxSdnIpamConfig): Promise<void> {
    const payload = this.toSdnIpamPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/sdn/ipams', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateSdnIpam(config);
    }
  }

  async updateSdnIpam(config: ProxmoxSdnIpamConfig): Promise<void> {
    const payload = this.toSdnIpamPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/sdn/ipams/${encodeURIComponent(config.ipam)}`, payload);
    });
  }

  async deleteSdnIpam(ipam: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/sdn/ipams/${encodeURIComponent(ipam)}`);
    });
  }

  async upsertDatacenterFirewallAlias(config: ProxmoxDatacenterFirewallAliasConfig): Promise<void> {
    const payload = this.toDatacenterFirewallAliasPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/firewall/aliases', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateDatacenterFirewallAlias(config);
    }
  }

  async updateDatacenterFirewallAlias(config: ProxmoxDatacenterFirewallAliasConfig): Promise<void> {
    const payload = this.toDatacenterFirewallAliasPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/firewall/aliases/${encodeURIComponent(config.name)}`, payload);
    });
  }

  async deleteDatacenterFirewallAlias(name: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/firewall/aliases/${encodeURIComponent(name)}`);
    });
  }

  async upsertDatacenterFirewallIpset(config: ProxmoxDatacenterFirewallIpsetConfig): Promise<void> {
    const payload = this.toDatacenterFirewallIpsetPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/cluster/firewall/ipset', payload);
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateDatacenterFirewallIpset(config);
    }
  }

  async updateDatacenterFirewallIpset(config: ProxmoxDatacenterFirewallIpsetConfig): Promise<void> {
    const payload = this.toDatacenterFirewallIpsetPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/cluster/firewall/ipset/${encodeURIComponent(config.name)}`, payload);
    });
  }

  async deleteDatacenterFirewallIpset(name: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/firewall/ipset/${encodeURIComponent(name)}`);
    });
  }

  async upsertDatacenterFirewallRule(config: ProxmoxDatacenterFirewallRuleConfig): Promise<void> {
    if (config.id) {
      await this.updateDatacenterFirewallRule(config);
      return;
    }

    const payload = this.toDatacenterFirewallRulePayload(config, false);
    await withRetry(async () => {
      await this.client.post('/cluster/firewall/rules', payload);
    });
  }

  async updateDatacenterFirewallRule(config: ProxmoxDatacenterFirewallRuleConfig): Promise<void> {
    if (!config.id) {
      throw new Error('Firewall rule update requires id');
    }
    const payload = this.toDatacenterFirewallRulePayload(config, true);
    await withRetry(async () => {
      await this.client.put(`/cluster/firewall/rules/${encodeURIComponent(config.id ?? '')}`, payload);
    });
  }

  async deleteDatacenterFirewallRule(id: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/cluster/firewall/rules/${encodeURIComponent(id)}`);
    });
  }

  private async runAction(node: string, vmid: number, vmType: 'qemu' | 'lxc', action: 'start' | 'stop' | 'reboot'): Promise<void> {
    await withRetry(async () => {
      await this.client.post(`/nodes/${node}/${vmType}/${vmid}/status/${action}`);
    });
  }

  private toPoolPayload(config: ProxmoxPoolConfig, includePoolId: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includePoolId) {
      payload.poolid = config.poolId;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.users?.length) {
      payload.users = config.users.join(',');
    }
    if (config.groups?.length) {
      payload.groups = config.groups.join(',');
    }
    return payload;
  }

  private toBackupJobPayload(config: ProxmoxBackupJobConfig): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      id: config.id
    };

    if (config.enabled !== undefined) {
      payload.enabled = config.enabled ? 1 : 0;
    }
    if (config.schedule) {
      payload.schedule = config.schedule;
    }
    if (config.storage) {
      payload.storage = config.storage;
    }
    if (config.node) {
      payload.node = config.node;
    }
    if (config.mode) {
      payload.mode = config.mode;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }

    return payload;
  }

  private toHaGroupPayload(config: ProxmoxHaGroupConfig, includeGroup: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeGroup) {
      payload.group = config.group;
    }
    if (config.nodes?.length) {
      payload.nodes = config.nodes.join(',');
    }
    if (config.nofailback !== undefined) {
      payload.nofailback = config.nofailback ? 1 : 0;
    }
    if (config.restricted !== undefined) {
      payload.restricted = config.restricted ? 1 : 0;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toHaResourcePayload(config: ProxmoxHaResourceConfig, includeSid: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeSid) {
      payload.sid = config.sid;
    }
    if (config.state) {
      payload.state = config.state;
    }
    if (config.group) {
      payload.group = config.group;
    }
    if (config.maxRestart !== undefined) {
      payload.max_restart = config.maxRestart;
    }
    if (config.maxRelocate !== undefined) {
      payload.max_relocate = config.maxRelocate;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toHaRulePayload(config: ProxmoxHaRuleConfig, includeRule: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeRule) {
      payload.rule = config.rule;
    }
    if (config.type) {
      payload.type = config.type;
    }
    if (config.resources?.length) {
      payload.resources = config.resources.join(',');
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toReplicationJobPayload(config: ProxmoxReplicationJobConfig): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      id: config.id,
      source: config.source,
      target: config.target
    };

    if (config.enabled !== undefined) {
      payload.disable = config.enabled ? 0 : 1;
    }
    if (config.schedule) {
      payload.schedule = config.schedule;
    }
    if (config.rate !== undefined) {
      payload.rate = config.rate;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }

    return payload;
  }

  private toVzdumpPayload(
    vmid: number,
    config: { storage?: string; mode?: string; compress?: string; remove?: boolean; mailNotification?: string }
  ): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      vmid
    };
    if (config.storage) {
      payload.storage = config.storage;
    }
    if (config.mode) {
      payload.mode = config.mode;
    }
    if (config.compress) {
      payload.compress = config.compress;
    }
    if (config.remove !== undefined) {
      payload.remove = config.remove ? 1 : 0;
    }
    if (config.mailNotification) {
      payload['mailnotification'] = config.mailNotification;
    }
    return payload;
  }

  private toSdnZonePayload(config: ProxmoxSdnZoneConfig, includeZone: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeZone) {
      payload.zone = config.zone;
    }
    if (config.type) {
      payload.type = config.type;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toSdnVnetPayload(config: ProxmoxSdnVnetConfig, includeVnet: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      zone: config.zone
    };
    if (includeVnet) {
      payload.vnet = config.vnet;
    }
    if (config.alias) {
      payload.alias = config.alias;
    }
    if (config.tag !== undefined) {
      payload.tag = config.tag;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toSdnSubnetPayload(config: ProxmoxSdnSubnetConfig, includeSubnet: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeSubnet) {
      payload.subnet = config.subnet;
    }
    if (config.gateway) {
      payload.gateway = config.gateway;
    }
    if (config.snat !== undefined) {
      payload.snat = config.snat ? 1 : 0;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toSdnIpamPayload(config: ProxmoxSdnIpamConfig, includeIpam: boolean): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeIpam) {
      payload.ipam = config.ipam;
    }
    if (config.type) {
      payload.type = config.type;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private toNodeFirewallRulePayload(
    config: ProxmoxNodeFirewallRuleConfig,
    includeId: boolean
  ): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      action: config.action
    };

    if (includeId && config.id) {
      payload.id = config.id;
    }
    if (config.type) {
      payload.type = config.type;
    }
    if (config.iface) {
      payload.iface = config.iface;
    }
    if (config.source) {
      payload.source = config.source;
    }
    if (config.dest) {
      payload.dest = config.dest;
    }
    if (config.proto) {
      payload.proto = config.proto;
    }
    if (config.sport) {
      payload.sport = config.sport;
    }
    if (config.dport) {
      payload.dport = config.dport;
    }
    if (config.enable !== undefined) {
      payload.enable = config.enable ? 1 : 0;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.pos !== undefined) {
      payload.pos = config.pos;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }

    return payload;
  }

  private toDatacenterFirewallAliasPayload(
    config: ProxmoxDatacenterFirewallAliasConfig,
    includeName: boolean
  ): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      cidr: config.cidr
    };
    if (includeName) {
      payload.name = config.name;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    return payload;
  }

  private toDatacenterFirewallIpsetPayload(
    config: ProxmoxDatacenterFirewallIpsetConfig,
    includeName: boolean
  ): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};
    if (includeName) {
      payload.name = config.name;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    return payload;
  }

  private toDatacenterFirewallRulePayload(
    config: ProxmoxDatacenterFirewallRuleConfig,
    includeId: boolean
  ): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      action: config.action
    };
    if (includeId && config.id) {
      payload.id = config.id;
    }
    if (config.type) {
      payload.type = config.type;
    }
    if (config.iface) {
      payload.iface = config.iface;
    }
    if (config.source) {
      payload.source = config.source;
    }
    if (config.dest) {
      payload.dest = config.dest;
    }
    if (config.proto) {
      payload.proto = config.proto;
    }
    if (config.sport) {
      payload.sport = config.sport;
    }
    if (config.dport) {
      payload.dport = config.dport;
    }
    if (config.enable !== undefined) {
      payload.enable = config.enable ? 1 : 0;
    }
    if (config.comment) {
      payload.comment = config.comment;
    }
    if (config.pos !== undefined) {
      payload.pos = config.pos;
    }
    if (config.options) {
      Object.assign(payload, config.options);
    }
    return payload;
  }

  private isAlreadyExistsError(error: unknown): boolean {
    const message = errorMessage(error).toLowerCase();
    return (
      message.includes('already exists') ||
      message.includes('entry exists') ||
      message.includes('file exists') ||
      message.includes('exist')
    );
  }

  private async hasNodeCephEndpoints(node: string): Promise<boolean> {
    const cached = this.nodeCephSupportCache.get(node);
    if (cached !== undefined) {
      return cached;
    }

    try {
      await withRetry(async () => this.client.get(`/nodes/${encodeURIComponent(node)}/ceph`));
      this.nodeCephSupportCache.set(node, true);
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404 || status === 501) {
          this.nodeCephSupportCache.set(node, false);
          return false;
        }
      }

      const msg = errorMessage(error).toLowerCase();
      if (msg.includes('not implemented') || msg.includes('no such') || msg.includes('not found')) {
        this.nodeCephSupportCache.set(node, false);
        return false;
      }

      throw error;
    }
  }

  private toVmCreatePayload(config: VmProvisionConfig): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      vmid: config.vmid,
      name: config.name,
      cores: config.cpu.cores,
      memory: config.memory.size
    };

    if (config.cpu.sockets) {
      payload.sockets = config.cpu.sockets;
    }
    if (config.cpu.type) {
      payload.cpu = config.cpu.type;
    }
    if (config.cpu.limit !== undefined) {
      payload.cpulimit = config.cpu.limit;
    }
    if (config.cpu.units !== undefined) {
      payload.cpuunits = config.cpu.units;
    }
    if (config.cpu.numa !== undefined) {
      payload.numa = config.cpu.numa ? 1 : 0;
    }

    if (config.memory.balloon !== undefined) {
      payload.balloon = config.memory.balloon;
    }
    if (config.memory.shares !== undefined) {
      payload.shares = config.memory.shares;
    }

    for (const disk of config.disks) {
      const key = `${disk.interface}${disk.index}`;
      const valueParts = [`${disk.storage}:${this.normalizeStorageSizeToken(disk.size)}`];
      if (disk.format) {
        valueParts.push(`format=${disk.format}`);
      }
      if (disk.cache) {
        valueParts.push(`cache=${disk.cache}`);
      }
      if (disk.discard) {
        valueParts.push(`discard=${disk.discard}`);
      }
      if (disk.ssd !== undefined) {
        valueParts.push(`ssd=${disk.ssd ? 1 : 0}`);
      }
      if (disk.iothread !== undefined) {
        valueParts.push(`iothread=${disk.iothread ? 1 : 0}`);
      }
      payload[key] = valueParts.join(',');
    }

    for (const nic of config.networks) {
      const key = `net${nic.index}`;
      const nicParts: string[] = [];
      if (nic.mac) {
        nicParts.push(`${nic.model}=${nic.mac}`);
      } else {
        nicParts.push(nic.model);
      }
      nicParts.push(`bridge=${nic.bridge}`);
      if (nic.vlan !== undefined) {
        nicParts.push(`tag=${nic.vlan}`);
      }
      if (nic.tag !== undefined) {
        nicParts.push(`tag=${nic.tag}`);
      }
      if (nic.firewall !== undefined) {
        nicParts.push(`firewall=${nic.firewall ? 1 : 0}`);
      }
      if (nic.rate !== undefined) {
        nicParts.push(`rate=${nic.rate}`);
      }
      payload[key] = nicParts.join(',');
    }

    for (const ip of config.ipconfig ?? []) {
      const key = `ipconfig${ip.index}`;
      const ipParts = [`ip=${ip.ip}`];
      if (ip.gateway) {
        ipParts.push(`gw=${ip.gateway}`);
      }
      if (ip.ip6) {
        ipParts.push(`ip6=${ip.ip6}`);
      }
      if (ip.gateway6) {
        ipParts.push(`gw6=${ip.gateway6}`);
      }
      payload[key] = ipParts.join(',');
    }

    if (config.cloudInit?.user) {
      payload.ciuser = config.cloudInit.user;
    }
    if (config.cloudInit?.password) {
      payload.cipassword = config.cloudInit.password;
    }
    if (config.cloudInit?.sshKeys?.length) {
      payload.sshkeys = encodeURIComponent(config.cloudInit.sshKeys.join('\n'));
    }
    if (config.cloudInit?.nameserver) {
      payload.nameserver = config.cloudInit.nameserver;
    }
    if (config.cloudInit?.searchdomain) {
      payload.searchdomain = config.cloudInit.searchdomain;
    }
    if (config.cloudInit?.upgrade !== undefined) {
      payload.ciupgrade = config.cloudInit.upgrade ? 1 : 0;
    }
    if (config.cloudInit?.ciCustom) {
      payload.cicustom = config.cloudInit.ciCustom;
    }

    if (config.boot?.bios) {
      payload.bios = config.boot.bios;
    }
    if (config.boot?.order?.length) {
      payload.boot = `order=${config.boot.order.join(';')}`;
    }

    if (config.onboot !== undefined) {
      payload.onboot = config.onboot ? 1 : 0;
    }
    if (config.protection !== undefined) {
      payload.protection = config.protection ? 1 : 0;
    }
    if (config.tags?.length) {
      payload.tags = config.tags.join(';');
    }
    if (config.description) {
      payload.description = config.description;
    }
    if (config.ostype) {
      payload.ostype = config.ostype;
    }
    if (config.agent !== undefined) {
      payload.agent = config.agent ? 1 : 0;
    }
    if (config.hotplug) {
      payload.hotplug = config.hotplug;
    }

    return payload;
  }

  private toCtCreatePayload(config: ContainerProvisionConfig): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {
      vmid: config.vmid,
      hostname: config.hostname ?? config.name,
      ostemplate: config.ostemplate,
      rootfs: `${config.rootfs.storage}:${this.normalizeStorageSizeToken(config.rootfs.size)}`
    };

    if (config.memory?.size) {
      payload.memory = config.memory.size;
    }
    if (config.memory?.swap !== undefined) {
      payload.swap = config.memory.swap;
    }
    if (config.cpu?.cores) {
      payload.cores = config.cpu.cores;
    }
    if (config.cpu?.limit !== undefined) {
      payload.cpulimit = config.cpu.limit;
    }
    if (config.cpu?.units !== undefined) {
      payload.cpuunits = config.cpu.units;
    }

    for (const nic of config.networks) {
      const key = `net${nic.index}`;
      const nicParts = [`name=eth${nic.index}`, `bridge=${nic.bridge}`];
      if (nic.ip) {
        nicParts.push(`ip=${nic.ip}`);
      }
      if (nic.gateway) {
        nicParts.push(`gw=${nic.gateway}`);
      }
      if (nic.ip6) {
        nicParts.push(`ip6=${nic.ip6}`);
      }
      if (nic.gateway6) {
        nicParts.push(`gw6=${nic.gateway6}`);
      }
      if (nic.firewall !== undefined) {
        nicParts.push(`firewall=${nic.firewall ? 1 : 0}`);
      }
      if (nic.hwaddr) {
        nicParts.push(`hwaddr=${nic.hwaddr}`);
      }
      if (nic.tag !== undefined) {
        nicParts.push(`tag=${nic.tag}`);
      }
      if (nic.rate !== undefined) {
        nicParts.push(`rate=${nic.rate}`);
      }
      payload[key] = nicParts.join(',');
    }

    for (const mp of config.mountpoints ?? []) {
      const key = `mp${mp.index}`;
      const mpParts = [`${mp.storage}${mp.size ? `:${mp.size}` : ''}`, `mp=${mp.mp}`];
      if (mp.acl !== undefined) {
        mpParts.push(`acl=${mp.acl ? 1 : 0}`);
      }
      if (mp.backup !== undefined) {
        mpParts.push(`backup=${mp.backup ? 1 : 0}`);
      }
      if (mp.quota !== undefined) {
        mpParts.push(`quota=${mp.quota ? 1 : 0}`);
      }
      if (mp.replicate !== undefined) {
        mpParts.push(`replicate=${mp.replicate ? 1 : 0}`);
      }
      if (mp.shared !== undefined) {
        mpParts.push(`shared=${mp.shared ? 1 : 0}`);
      }
      payload[key] = mpParts.join(',');
    }

    if (config.onboot !== undefined) {
      payload.onboot = config.onboot ? 1 : 0;
    }
    if (config.protection !== undefined) {
      payload.protection = config.protection ? 1 : 0;
    }
    if (config.tags?.length) {
      payload.tags = config.tags.join(';');
    }
    if (config.description) {
      payload.description = config.description;
    }
    if (config.unprivileged !== undefined) {
      payload.unprivileged = config.unprivileged ? 1 : 0;
    }
    if (config.features) {
      const features: string[] = [];
      if (config.features.nesting !== undefined) {
        features.push(`nesting=${config.features.nesting ? 1 : 0}`);
      }
      if (config.features.fuse !== undefined) {
        features.push(`fuse=${config.features.fuse ? 1 : 0}`);
      }
      if (config.features.keyctl !== undefined) {
        features.push(`keyctl=${config.features.keyctl ? 1 : 0}`);
      }
      if (config.features.mount) {
        features.push(`mount=${config.features.mount}`);
      }
      if (features.length) {
        payload.features = features.join(',');
      }
    }

    return payload;
  }

  private normalizeStorageSizeToken(size: string): string {
    const trimmed = size.trim();
    const giMatch = trimmed.match(/^(\d+)G$/i);
    if (giMatch?.[1]) {
      return giMatch[1];
    }
    return trimmed;
  }

  private applyConfigChange(payload: Record<string, string | number | boolean>, change: ConfigChange): void {
    switch (change.path) {
      case 'cpu.cores':
        if (typeof change.newValue === 'number') {
          payload.cores = change.newValue;
        }
        break;
      case 'cpu.sockets':
        if (typeof change.newValue === 'number') {
          payload.sockets = change.newValue;
        }
        break;
      case 'cpu.type':
        if (typeof change.newValue === 'string') {
          payload.cpu = change.newValue;
        }
        break;
      case 'memory.size':
        if (typeof change.newValue === 'number') {
          payload.memory = change.newValue;
        }
        break;
      case 'memory.balloon':
        if (typeof change.newValue === 'number') {
          payload.balloon = change.newValue;
        }
        break;
      case 'onboot':
        if (typeof change.newValue === 'boolean') {
          payload.onboot = change.newValue ? 1 : 0;
        }
        break;
      case 'protection':
        if (typeof change.newValue === 'boolean') {
          payload.protection = change.newValue ? 1 : 0;
        }
        break;
      case 'description':
        if (typeof change.newValue === 'string') {
          payload.description = change.newValue;
        }
        break;
      case 'tags':
        if (Array.isArray(change.newValue)) {
          payload.tags = change.newValue.join(';');
        }
        break;
      case 'cloudInit.user':
        if (typeof change.newValue === 'string') {
          payload.ciuser = change.newValue;
        }
        break;
      case 'cloudInit.password':
        if (typeof change.newValue === 'string') {
          payload.cipassword = change.newValue;
        }
        break;
      case 'cloudInit.sshKeys':
        if (Array.isArray(change.newValue)) {
          payload.sshkeys = encodeURIComponent(change.newValue.join('\n'));
        }
        break;
      case 'cloudInit.nameserver':
        if (typeof change.newValue === 'string') {
          payload.nameserver = change.newValue;
        }
        break;
      case 'cloudInit.searchdomain':
        if (typeof change.newValue === 'string') {
          payload.searchdomain = change.newValue;
        }
        break;
      case 'boot.bios':
        if (typeof change.newValue === 'string') {
          payload.bios = change.newValue;
        }
        break;
      case 'boot.order':
        if (Array.isArray(change.newValue)) {
          payload.boot = `order=${change.newValue.join(';')}`;
        }
        break;
      default:
        if (change.path.startsWith('network.net')) {
          const key = change.path.replace('network.', '');
          if (typeof change.newValue === 'object' && change.newValue && !Array.isArray(change.newValue)) {
            const candidate = change.newValue as Record<string, unknown>;
            if (typeof candidate.model === 'string') {
              const parts: string[] = [];
              if (typeof candidate.mac === 'string') {
                parts.push(`${candidate.model}=${candidate.mac}`);
              } else {
                parts.push(candidate.model);
              }
              if (typeof candidate.bridge === 'string') {
                parts.push(`bridge=${candidate.bridge}`);
              }
              if (typeof candidate.vlan === 'number') {
                parts.push(`tag=${candidate.vlan}`);
              }
              if (typeof candidate.tag === 'number') {
                parts.push(`tag=${candidate.tag}`);
              }
              if (typeof candidate.firewall === 'boolean') {
                parts.push(`firewall=${candidate.firewall ? 1 : 0}`);
              }
              if (typeof candidate.rate === 'number') {
                parts.push(`rate=${candidate.rate}`);
              }
              payload[key] = parts.join(',');
              break;
            }

            const netIndexMatch = key.match(/^net(\d+)$/);
            const netIndex = netIndexMatch ? Number(netIndexMatch[1]) : 0;
            const parts = [`name=eth${netIndex}`];
            if (typeof candidate.bridge === 'string') {
              parts.push(`bridge=${candidate.bridge}`);
            }
            if (typeof candidate.ip === 'string') {
              parts.push(`ip=${candidate.ip}`);
            }
            if (typeof candidate.gateway === 'string') {
              parts.push(`gw=${candidate.gateway}`);
            }
            if (typeof candidate.ip6 === 'string') {
              parts.push(`ip6=${candidate.ip6}`);
            }
            if (typeof candidate.gateway6 === 'string') {
              parts.push(`gw6=${candidate.gateway6}`);
            }
            if (typeof candidate.firewall === 'boolean') {
              parts.push(`firewall=${candidate.firewall ? 1 : 0}`);
            }
            if (typeof candidate.hwaddr === 'string') {
              parts.push(`hwaddr=${candidate.hwaddr}`);
            }
            if (typeof candidate.tag === 'number') {
              parts.push(`tag=${candidate.tag}`);
            }
            if (typeof candidate.rate === 'number') {
              parts.push(`rate=${candidate.rate}`);
            }
            payload[key] = parts.join(',');
          }
        }
        break;
    }
  }

  private async scanNodeVms(node: string): Promise<ProxmoxVm[]> {
    const response = await this.client.get<ProxmoxApiResponse<ProxmoxVmSummary[]>>(`/nodes/${node}/qemu`);
    const result: ProxmoxVm[] = [];

    for (const vm of response.data.data) {
      const configResponse = await this.client.get<ProxmoxApiResponse<Record<string, string | number | undefined>>>(
        `/nodes/${node}/qemu/${vm.vmid}/config`
      );
      const config = configResponse.data.data;

      const disks = Object.entries(config)
        .filter(([key]) => /^(ide|sata|scsi|virtio)\d+$/.test(key))
        .map(([key, value]) => `${key}:${String(value)}`);

      const bridges = Object.entries(config)
        .filter(([key]) => /^net\d+$/.test(key))
        .map(([, value]) => String(value))
        .map((entry) => {
          const bridgePart = entry.split(',').find((piece) => piece.startsWith('bridge='));
          return bridgePart?.split('=')[1] ?? 'unknown';
        });

      const tags = typeof config.tags === 'string' ? config.tags.split(';').filter(Boolean) : [];

      result.push({
        id: `${node}/qemu/${vm.vmid}`,
        vmid: vm.vmid,
        node,
        name: vm.name ?? `vm-${vm.vmid}`,
        status: vm.status === 'running' ? 'running' : vm.status === 'stopped' ? 'stopped' : 'unknown',
        cpuCores: typeof config.cores === 'number' ? config.cores : undefined,
        memoryMb: typeof config.memory === 'number' ? config.memory : undefined,
        disks,
        bridges,
        tags
      });
    }

    return result;
  }

  private async scanNodeCts(node: string): Promise<ProxmoxCt[]> {
    const response = await this.client.get<ProxmoxApiResponse<ProxmoxCtSummary[]>>(`/nodes/${node}/lxc`);
    const result: ProxmoxCt[] = [];

    for (const ct of response.data.data) {
      const configResponse = await this.client.get<ProxmoxApiResponse<Record<string, string | number | undefined>>>(
        `/nodes/${node}/lxc/${ct.vmid}/config`
      );
      const config = configResponse.data.data;

      const tags = typeof config.tags === 'string' ? config.tags.split(';').filter(Boolean) : [];
      const bridges = Object.entries(config)
        .filter(([key]) => /^net\d+$/.test(key))
        .map(([, value]) => String(value))
        .map((entry) => {
          const bridgePart = entry.split(',').find((piece) => piece.startsWith('bridge='));
          return bridgePart?.split('=')[1] ?? 'unknown';
        });

      result.push({
        id: `${node}/lxc/${ct.vmid}`,
        vmid: ct.vmid,
        node,
        name: ct.name ?? `ct-${ct.vmid}`,
        status: ct.status === 'running' ? 'running' : ct.status === 'stopped' ? 'stopped' : 'unknown',
        cpuCores: typeof config.cores === 'number' ? config.cores : undefined,
        memoryMb: typeof config.memory === 'number' ? config.memory : undefined,
        rootFs: typeof config.rootfs === 'string' ? config.rootfs : undefined,
        tags,
        bridges
      });
    }

    return result;
  }

  private async scanNodeNetworks(node: string): Promise<ProxmoxNetworkState[]> {
    const response = await this.client.get<ProxmoxApiResponse<ProxmoxNetworkSummary[]>>(`/nodes/${node}/network`);

    return response.data.data
      .filter((item) => typeof item.iface === 'string' && typeof item.type === 'string')
      .map((item) => {
        const config: Record<string, string | number | boolean | undefined> = { ...item };
        delete config.iface;
        delete config.type;

        return {
          node,
          name: item.iface,
          type: item.type,
          config
        };
      });
  }

  private async scanStorage(): Promise<ProxmoxStorageState[]> {
    const response = await this.client.get<ProxmoxApiResponse<ProxmoxStorageSummary[]>>('/storage');

    return response.data.data
      .filter((item) => typeof item.storage === 'string' && typeof item.type === 'string')
      .map((item) => {
        const config: Record<string, string | number | boolean | undefined> = { ...item };
        delete config.storage;
        delete config.type;

        return {
          name: item.storage,
          type: item.type,
          config
        };
      });
  }

  private async scanDatacenter(warnings: string[]): Promise<ProxmoxDatacenterState> {
    const users = await this.fetchDatacenterArray('/access/users', warnings, 'Datacenter users scan failed');
    const apiTokens: Record<string, unknown>[] = [];
    for (const user of users) {
      const userId = typeof user.userid === 'string' ? user.userid : undefined;
      if (!userId) {
        continue;
      }
      const tokens = await this.fetchDatacenterArray(
        `/access/users/${encodeURIComponent(userId)}/token`,
        warnings,
        `Datacenter token scan failed for ${userId}`
      );
      for (const token of tokens) {
        apiTokens.push({ userId, ...token });
      }
    }

    return {
      summary: await this.fetchDatacenterObject('/version', warnings, 'Datacenter summary scan failed'),
      cluster: await this.fetchDatacenterArray('/cluster/status', warnings, 'Datacenter cluster scan failed'),
      ceph: await this.fetchDatacenterArray('/cluster/ceph/status', warnings, 'Datacenter ceph scan failed'),
      options: await this.fetchDatacenterObject('/cluster/options', warnings, 'Datacenter options scan failed'),
      storage: await this.fetchDatacenterArray('/storage', warnings, 'Datacenter storage scan failed'),
      backupJobs: await this.fetchDatacenterArray('/cluster/backup', warnings, 'Datacenter backup scan failed'),
      replication: await this.fetchDatacenterArray('/cluster/replication', warnings, 'Datacenter replication scan failed'),
      permissions: {
        users,
        apiTokens,
        groups: await this.fetchDatacenterArray('/access/groups', warnings, 'Datacenter groups scan failed'),
        pools: await this.fetchDatacenterArray('/pools', warnings, 'Datacenter pools scan failed'),
        roles: await this.fetchDatacenterArray('/access/roles', warnings, 'Datacenter roles scan failed'),
        realms: await this.fetchDatacenterArray('/access/domains', warnings, 'Datacenter realms scan failed'),
        acl: await this.fetchDatacenterArray('/access/acl', warnings, 'Datacenter ACL scan failed'),
        tfa: await this.fetchDatacenterArray('/access/tfa', warnings, 'Datacenter TFA scan failed')
      }
    };
  }

  private async scanNodeAdmin(node: string, warnings: string[]): Promise<ProxmoxNodeAdminState> {
    return {
      summary: await this.fetchNodeObject(node, '/status', warnings, `Node summary scan failed on ${node}`),
      network: await this.fetchNodeArray(node, '/network', warnings, `Node network scan failed on ${node}`),
      certificates: await this.fetchNodeArray(node, '/certificates/info', warnings, `Node certificates scan failed on ${node}`),
      dns: await this.fetchNodeObject(node, '/dns', warnings, `Node DNS scan failed on ${node}`),
      hosts: await this.fetchNodeArray(node, '/hosts', warnings, `Node hosts scan failed on ${node}`),
      options: await this.fetchNodeObject(node, '/config', warnings, `Node options scan failed on ${node}`),
      time: await this.fetchNodeObject(node, '/time', warnings, `Node time scan failed on ${node}`),
      logs: await this.fetchNodeArray(node, '/syslog', warnings, `Node log scan failed on ${node}`),
      updates: await this.fetchNodeArray(node, '/apt/update', warnings, `Node updates scan failed on ${node}`),
      repositories: await this.fetchNodeArray(node, '/apt/repositories', warnings, `Node repositories scan failed on ${node}`),
      firewall: await this.fetchNodeArray(node, '/firewall/rules', warnings, `Node firewall scan failed on ${node}`),
      disks: {
        list: await this.fetchNodeArray(node, '/disks/list', warnings, `Node disks scan failed on ${node}`),
        lvm: await this.fetchNodeArray(node, '/disks/lvm', warnings, `Node LVM scan failed on ${node}`),
        lvmThin: await this.fetchNodeArray(node, '/disks/lvmthin', warnings, `Node LVM-Thin scan failed on ${node}`),
        directory: await this.fetchNodeArray(node, '/disks/directory', warnings, `Node directory scan failed on ${node}`),
        zfs: await this.fetchNodeArray(node, '/disks/zfs', warnings, `Node ZFS scan failed on ${node}`)
      }
    };
  }

  private async fetchDatacenterArray(
    endpoint: string,
    warnings: string[],
    warnMessage: string
  ): Promise<Record<string, unknown>[]> {
    try {
      const response = await withRetry(async () => this.client.get<ProxmoxApiResponse<unknown>>(endpoint));
      const data = response.data.data;
      return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    } catch (error) {
      warnings.push(`${warnMessage}: ${errorMessage(error)}`);
      return [];
    }
  }

  private async fetchDatacenterObject(
    endpoint: string,
    warnings: string[],
    warnMessage: string
  ): Promise<Record<string, unknown>> {
    try {
      const response = await withRetry(async () => this.client.get<ProxmoxApiResponse<unknown>>(endpoint));
      const data = response.data.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      warnings.push(`${warnMessage}: ${errorMessage(error)}`);
      return {};
    }
  }

  private async fetchNodeArray(
    node: string,
    endpoint: string,
    warnings: string[],
    warnMessage: string
  ): Promise<Record<string, unknown>[]> {
    try {
      const response = await withRetry(async () => this.client.get<ProxmoxApiResponse<unknown>>(`/nodes/${encodeURIComponent(node)}${endpoint}`));
      const data = response.data.data;
      return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    } catch (error) {
      warnings.push(`${warnMessage}: ${errorMessage(error)}`);
      return [];
    }
  }

  private async fetchNodeObject(
    node: string,
    endpoint: string,
    warnings: string[],
    warnMessage: string
  ): Promise<Record<string, unknown>> {
    try {
      const response = await withRetry(async () => this.client.get<ProxmoxApiResponse<unknown>>(`/nodes/${encodeURIComponent(node)}${endpoint}`));
      const data = response.data.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      warnings.push(`${warnMessage}: ${errorMessage(error)}`);
      return {};
    }
  }

  private async safeCall<T>(fn: () => Promise<T>, warnings: string[], message: string, emptyValue: T): Promise<T> {
    try {
      return await withRetry(fn);
    } catch (error) {
      const msg = `${message}: ${errorMessage(error)}`;
      warnings.push(msg);
      return emptyValue;
    }
  }

  private async executeNodeTaskAndWait(
    node: string,
    operation: string,
    request: () => Promise<AxiosResponse<ProxmoxApiResponse<unknown>>>,
    onProgress?: ProxmoxTaskProgressHandler
  ): Promise<void> {
    const response = await withRetry(request);
    const upid = this.extractUpid(response.data?.data);
    if (!upid) {
      return;
    }

    onProgress?.({ node, upid, operation, status: 'queued' });
    await this.waitForTaskCompletion(node, upid, operation, onProgress);
  }

  private async waitForTaskCompletion(
    node: string,
    upid: string,
    operation: string,
    onProgress?: ProxmoxTaskProgressHandler
  ): Promise<void> {
    const startedAtMs = Date.now();
    const timeoutMs = 15 * 60 * 1000;
    let lastStatus = '';

    while (Date.now() - startedAtMs < timeoutMs) {
      const response = await withRetry(async () =>
        this.client.get<ProxmoxApiResponse<unknown>>(`/nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/status`)
      );
      const payload = response.data?.data;
      const taskStatus = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const status = typeof taskStatus.status === 'string' ? taskStatus.status : 'unknown';
      const exitStatus = typeof taskStatus.exitstatus === 'string' ? taskStatus.exitstatus : undefined;
      const effective = status === 'stopped' ? exitStatus ?? 'stopped' : status;

      if (effective !== lastStatus) {
        onProgress?.({
          node,
          upid,
          operation,
          status: effective,
          details: exitStatus ? `exitstatus=${exitStatus}` : undefined
        });
        lastStatus = effective;
      }

      if (status === 'stopped') {
        if (exitStatus && exitStatus !== 'OK') {
          throw new Error(`${operation} task ${upid} failed with exitstatus=${exitStatus}`);
        }
        return;
      }

      await this.delay(1000);
    }

    throw new Error(`${operation} task ${upid} timed out after ${Math.round(timeoutMs / 1000)}s`);
  }

  private extractUpid(value: unknown): string | undefined {
    if (typeof value === 'string' && value.startsWith('UPID:')) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    const candidates = [record.upid, record.UPID, record.task, record.value];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.startsWith('UPID:')) {
        return candidate;
      }
    }

    return undefined;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
