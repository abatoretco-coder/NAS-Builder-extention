import { describe, expect, it, vi } from 'vitest';
import type { Plan } from '@naas/shared';
import { executePlan } from '../src/planner/executor.js';
import type { ExecutorDeps } from '../src/planner/executor.js';

function depsWithSpies() {
  const startVm = vi.fn(async () => undefined);
  const stopVm = vi.fn(async () => undefined);
  const createStorage = vi.fn(async () => undefined);
  const createNetwork = vi.fn(async () => undefined);
  const deleteNetwork = vi.fn(async () => undefined);
  const updateNetwork = vi.fn(async () => undefined);
  const updateStorage = vi.fn(async () => undefined);
  const upsertUser = vi.fn(async () => undefined);
  const upsertToken = vi.fn(async () => undefined);
  const upsertAcl = vi.fn(async () => undefined);
  const upsertRole = vi.fn(async () => undefined);
  const upsertGroup = vi.fn(async () => undefined);
  const upsertRealm = vi.fn(async () => undefined);
  const createTfa = vi.fn(async () => undefined);
  const updateTfa = vi.fn(async () => undefined);
  const deleteTfa = vi.fn(async () => undefined);
  const updateClusterOptions = vi.fn(async () => undefined);
  const upsertPool = vi.fn(async () => undefined);
  const deletePool = vi.fn(async () => undefined);
  const upsertBackupJob = vi.fn(async () => undefined);
  const deleteBackupJob = vi.fn(async () => undefined);
  const upsertReplicationJob = vi.fn(async () => undefined);
  const deleteReplicationJob = vi.fn(async () => undefined);
  const updateDatacenterFirewallOptions = vi.fn(async () => undefined);
  const updateNodeDns = vi.fn(async () => undefined);
  const updateNodeHosts = vi.fn(async () => undefined);
  const updateNodeOptions = vi.fn(async () => undefined);
  const updateNodeTime = vi.fn(async () => undefined);
  const runNodeServiceAction = vi.fn(async () => undefined);
  const runNodeAptAction = vi.fn(async () => undefined);
  const requestNodeCertificate = vi.fn(async () => ({}));
  const upsertSdnZone = vi.fn(async () => undefined);
  const deleteSdnZone = vi.fn(async () => undefined);
  const upsertSdnVnet = vi.fn(async () => undefined);
  const deleteSdnVnet = vi.fn(async () => undefined);
  const upsertSdnSubnet = vi.fn(async () => undefined);
  const deleteSdnSubnet = vi.fn(async () => undefined);
  const upsertDatacenterFirewallAlias = vi.fn(async () => undefined);
  const deleteDatacenterFirewallAlias = vi.fn(async () => undefined);
  const upsertDatacenterFirewallIpset = vi.fn(async () => undefined);
  const deleteDatacenterFirewallIpset = vi.fn(async () => undefined);
  const upsertDatacenterFirewallRule = vi.fn(async () => undefined);
  const deleteDatacenterFirewallRule = vi.fn(async () => undefined);
  const migrateVm = vi.fn(async () => undefined);
  const migrateCt = vi.fn(async () => undefined);
  const backupVm = vi.fn(async () => undefined);
  const backupCt = vi.fn(async () => undefined);
  const restoreVm = vi.fn(async () => undefined);
  const restoreCt = vi.fn(async () => undefined);
  const createVmSnapshot = vi.fn(async () => undefined);
  const deleteVmSnapshot = vi.fn(async () => undefined);
  const createCtSnapshot = vi.fn(async () => undefined);
  const deleteCtSnapshot = vi.fn(async () => undefined);
  const runVmGuestAgentCommand = vi.fn(async () => ({}));
  const deleteStorageContent = vi.fn(async () => undefined);
  const copyStorageContent = vi.fn(async () => undefined);
  const moveVmDisk = vi.fn(async () => undefined);
  const importVmDisk = vi.fn(async () => undefined);
  const cloneVmDisk = vi.fn(async () => undefined);
  const initializeNodeDisk = vi.fn(async () => undefined);
  const createNodeLvm = vi.fn(async () => undefined);
  const createNodeLvmThin = vi.fn(async () => undefined);
  const createNodeZfs = vi.fn(async () => undefined);
  const upsertHaGroup = vi.fn(async () => undefined);
  const deleteHaGroup = vi.fn(async () => undefined);
  const upsertHaResource = vi.fn(async () => undefined);
  const deleteHaResource = vi.fn(async () => undefined);
  const upsertHaRule = vi.fn(async () => undefined);
  const deleteHaRule = vi.fn(async () => undefined);
  const setCephFlag = vi.fn(async () => undefined);
  const clearCephFlag = vi.fn(async () => undefined);
  const readHaStatus = vi.fn(async () => ({}));
  const readCeph = vi.fn(async () => ({}));
  const readNodeCeph = vi.fn(async () => ({}));
  const runNodeCephAction = vi.fn(async () => ({}));
  const updateNodeFirewallOptions = vi.fn(async () => undefined);
  const upsertNodeFirewallRule = vi.fn(async () => undefined);
  const deleteNodeFirewallRule = vi.fn(async () => undefined);
  const upsertNodeCustomCertificate = vi.fn(async () => undefined);
  const deleteNodeCustomCertificate = vi.fn(async () => undefined);
  const upsertNodeAcmeCertificate = vi.fn(async () => undefined);
  const deleteNodeAcmeCertificate = vi.fn(async () => undefined);
  const upsertSdnIpam = vi.fn(async () => undefined);
  const deleteSdnIpam = vi.fn(async () => undefined);
  const readNodeTasks = vi.fn(async () => ({}));
  const readClusterTasks = vi.fn(async () => ({}));
  const readNodeTaskLog = vi.fn(async () => ({}));
  const readNodeFirewallLog = vi.fn(async () => ({}));
  const datacenterRequest = vi.fn(async () => ({}));
  const nodeRequest = vi.fn(async () => ({}));
  const grafanaRequest = vi.fn(async () => ({}));
  const validateGrafana = vi.fn(async () => ({ ok: true, details: 'ok' }));
  const upsertFolder = vi.fn(async () => ({}));
  const deleteFolder = vi.fn(async () => ({}));
  const upsertDashboard = vi.fn(async () => ({}));
  const deleteDashboard = vi.fn(async () => ({}));
  const upsertAlertRuleGroup = vi.fn(async () => ({}));
  const deleteAlertRuleGroup = vi.fn(async () => ({}));
  const upsertContactPoint = vi.fn(async () => ({}));
  const deleteContactPoint = vi.fn(async () => ({}));
  const replaceNotificationPolicy = vi.fn(async () => ({}));
  const upsertDatasource = vi.fn(async () => ({}));
  const deleteDatasource = vi.fn(async () => ({}));
  const upsertTeam = vi.fn(async () => ({}));
  const deleteTeam = vi.fn(async () => ({}));
  const syncTeamMembership = vi.fn(async () => ({}));
  const upsertServiceAccount = vi.fn(async () => ({}));
  const deleteServiceAccount = vi.fn(async () => ({}));
  const createServiceAccountToken = vi.fn(async () => ({}));
  const deleteServiceAccountToken = vi.fn(async () => ({}));
  const readFolder = vi.fn(async () => ({}));
  const readDashboard = vi.fn(async () => ({}));
  const readAlertRuleGroup = vi.fn(async () => ({}));
  const readContactPoint = vi.fn(async () => ({}));
  const readNotificationPolicy = vi.fn(async () => ({}));
  const checkDatasourceHealth = vi.fn(async () => ({}));
  const queryDatasource = vi.fn(async () => ({}));
  const listServiceAccountTokens = vi.fn(async () => ({}));
  const loggerInfo = vi.fn();
  const loggerWarn = vi.fn();
  const loggerError = vi.fn();

  const proxmox = {
    startVm,
    stopVm,
    rebootVm: vi.fn(async () => undefined),
    snapshotQemu: vi.fn(async () => undefined),
    createVm: vi.fn(async () => undefined),
    cloneVm: vi.fn(async () => undefined),
    updateVmConfig: vi.fn(async () => undefined),
    deleteVm: vi.fn(async () => undefined),
    createContainer: vi.fn(async () => undefined),
    updateContainerConfig: vi.fn(async () => undefined),
    deleteContainer: vi.fn(async () => undefined),
    resizeVmDisk: vi.fn(async () => undefined),
    attachVmDisk: vi.fn(async () => undefined),
    detachVmDisk: vi.fn(async () => undefined),
    createNetwork,
    updateNetwork,
    deleteNetwork,
    createStorage,
    updateStorage,
    deleteStorage: vi.fn(async () => undefined),
    upsertUser,
    updateUser: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
    upsertToken,
    updateToken: vi.fn(async () => undefined),
    deleteToken: vi.fn(async () => undefined),
    upsertAcl,
    deleteAcl: vi.fn(async () => undefined),
    upsertRole,
    updateRole: vi.fn(async () => undefined),
    deleteRole: vi.fn(async () => undefined),
    upsertGroup,
    updateGroup: vi.fn(async () => undefined),
    deleteGroup: vi.fn(async () => undefined),
    upsertRealm,
    updateRealm: vi.fn(async () => undefined),
    deleteRealm: vi.fn(async () => undefined),
    createTfa,
    updateTfa,
    deleteTfa,
    updateClusterOptions,
    upsertPool,
    deletePool,
    upsertBackupJob,
    deleteBackupJob,
    upsertReplicationJob,
    deleteReplicationJob,
    updateDatacenterFirewallOptions,
    updateNodeDns,
    updateNodeHosts,
    updateNodeOptions,
    updateNodeTime,
    runNodeServiceAction,
    runNodeAptAction,
    requestNodeCertificate,
    upsertSdnZone,
    deleteSdnZone,
    upsertSdnVnet,
    deleteSdnVnet,
    upsertSdnSubnet,
    deleteSdnSubnet,
    upsertDatacenterFirewallAlias,
    deleteDatacenterFirewallAlias,
    upsertDatacenterFirewallIpset,
    deleteDatacenterFirewallIpset,
    upsertDatacenterFirewallRule,
    deleteDatacenterFirewallRule,
    migrateVm,
    migrateCt,
    backupVm,
    backupCt,
    restoreVm,
    restoreCt,
    createVmSnapshot,
    deleteVmSnapshot,
    createCtSnapshot,
    deleteCtSnapshot,
    runVmGuestAgentCommand,
    deleteStorageContent,
    copyStorageContent,
    moveVmDisk,
    importVmDisk,
    cloneVmDisk,
    initializeNodeDisk,
    createNodeLvm,
    createNodeLvmThin,
    createNodeZfs,
    upsertHaGroup,
    deleteHaGroup,
    upsertHaResource,
    deleteHaResource,
    upsertHaRule,
    deleteHaRule,
    setCephFlag,
    clearCephFlag,
    readHaStatus,
    readCeph,
    readNodeCeph,
    runNodeCephAction,
    updateNodeFirewallOptions,
    upsertNodeFirewallRule,
    deleteNodeFirewallRule,
    upsertNodeCustomCertificate,
    deleteNodeCustomCertificate,
    upsertNodeAcmeCertificate,
    deleteNodeAcmeCertificate,
    upsertSdnIpam,
    deleteSdnIpam,
    readNodeTasks,
    readClusterTasks,
    readNodeTaskLog,
    readNodeFirewallLog,
    datacenterRequest,
    nodeRequest
  };

  const docker = {
    redeployCompose: vi.fn(async () => 'ok')
  };

  const deps: ExecutorDeps = {
    proxmox: proxmox as unknown as ExecutorDeps['proxmox'],
    docker: docker as unknown as ExecutorDeps['docker'],
    grafana: {
      grafanaRequest,
      validate: validateGrafana,
      upsertFolder,
      deleteFolder,
      upsertDashboard,
      deleteDashboard,
      upsertAlertRuleGroup,
      deleteAlertRuleGroup,
      upsertContactPoint,
      deleteContactPoint,
      replaceNotificationPolicy,
      upsertDatasource,
      deleteDatasource,
      upsertTeam,
      deleteTeam,
      syncTeamMembership,
      upsertServiceAccount,
      deleteServiceAccount,
      createServiceAccountToken,
      deleteServiceAccountToken,
      readFolder,
      readDashboard,
      readAlertRuleGroup,
      readContactPoint,
      readNotificationPolicy,
      checkDatasourceHealth,
      queryDatasource,
      listServiceAccountTokens
    } as unknown as ExecutorDeps['grafana'],
    logger: {
      info: loggerInfo,
      warn: loggerWarn,
      error: loggerError
    }
  };

  return {
    deps,
    startVm,
    stopVm,
    createStorage,
    createNetwork,
    deleteNetwork,
    updateNetwork,
    updateStorage,
    upsertUser,
    upsertToken,
    upsertAcl,
    upsertRole,
    upsertGroup,
    upsertRealm,
    createTfa,
    updateTfa,
    deleteTfa,
    updateClusterOptions,
    upsertPool,
    deletePool,
    upsertBackupJob,
    deleteBackupJob,
    upsertReplicationJob,
    deleteReplicationJob,
    updateDatacenterFirewallOptions,
    updateNodeDns,
    updateNodeHosts,
    updateNodeOptions,
    updateNodeTime,
    runNodeServiceAction,
    runNodeAptAction,
    requestNodeCertificate,
    upsertSdnZone,
    deleteSdnZone,
    upsertSdnVnet,
    deleteSdnVnet,
    upsertSdnSubnet,
    deleteSdnSubnet,
    upsertDatacenterFirewallAlias,
    deleteDatacenterFirewallAlias,
    upsertDatacenterFirewallIpset,
    deleteDatacenterFirewallIpset,
    upsertDatacenterFirewallRule,
    deleteDatacenterFirewallRule,
    migrateVm,
    migrateCt,
    backupVm,
    backupCt,
    restoreVm,
    restoreCt,
    createVmSnapshot,
    deleteVmSnapshot,
    createCtSnapshot,
    deleteCtSnapshot,
    runVmGuestAgentCommand,
    deleteStorageContent,
    copyStorageContent,
    moveVmDisk,
    importVmDisk,
    cloneVmDisk,
    initializeNodeDisk,
    createNodeLvm,
    createNodeLvmThin,
    createNodeZfs,
    upsertHaGroup,
    deleteHaGroup,
    upsertHaResource,
    deleteHaResource,
    upsertHaRule,
    deleteHaRule,
    setCephFlag,
    clearCephFlag,
    readHaStatus,
    readCeph,
    readNodeCeph,
    runNodeCephAction,
    updateNodeFirewallOptions,
    upsertNodeFirewallRule,
    deleteNodeFirewallRule,
    upsertNodeCustomCertificate,
    deleteNodeCustomCertificate,
    upsertNodeAcmeCertificate,
    deleteNodeAcmeCertificate,
    upsertSdnIpam,
    deleteSdnIpam,
    readNodeTasks,
    readClusterTasks,
    readNodeTaskLog,
    readNodeFirewallLog,
    datacenterRequest,
    nodeRequest,
    grafanaRequest,
    validateGrafana,
    upsertFolder,
    deleteFolder,
    upsertDashboard,
    deleteDashboard,
    upsertAlertRuleGroup,
    deleteAlertRuleGroup,
    upsertContactPoint,
    deleteContactPoint,
    replaceNotificationPolicy,
    upsertDatasource,
    deleteDatasource,
    upsertTeam,
    deleteTeam,
    syncTeamMembership,
    upsertServiceAccount,
    deleteServiceAccount,
    createServiceAccountToken,
    deleteServiceAccountToken,
    readFolder,
    readDashboard,
    readAlertRuleGroup,
    readContactPoint,
    readNotificationPolicy,
    checkDatasourceHealth,
    queryDatasource,
    listServiceAccountTokens,
    loggerInfo,
    loggerWarn,
    loggerError
  };
}

describe('executePlan rollback', () => {
  it('runs compensating rollback actions after a failure', async () => {
    const { deps, startVm, stopVm, createStorage } = depsWithSpies();
    createStorage.mockRejectedValueOnce(new Error('forced storage failure'));

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.start',
          node: 'node1',
          vmid: 101,
          vmType: 'qemu',
          reason: 'start vm'
        },
        {
          kind: 'proxmox.storage.create',
          name: 'pool-x',
          config: { name: 'pool-x', type: 'dir', path: '/srv/pool-x' },
          reason: 'forced failure action'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(false);
    expect(startVm).toHaveBeenCalledTimes(1);
    expect(stopVm).toHaveBeenCalledTimes(1);
    expect(result.rollback?.attempted).toBe(true);
    expect(result.rollback?.ok).toBe(true);
    expect(result.rollback?.results.some((item) => item.action.kind === 'proxmox.stop')).toBe(true);
  });

  it('rolls back created network if a later action fails', async () => {
    const { deps, createStorage, createNetwork, deleteNetwork } = depsWithSpies();
    createStorage.mockRejectedValueOnce(new Error('forced storage failure'));

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.network.create',
          node: 'node1',
          name: 'vmbr91',
          config: { name: 'vmbr91', node: 'node1', type: 'bridge' },
          reason: 'create network first'
        },
        {
          kind: 'proxmox.storage.create',
          name: 'pool-x',
          config: { name: 'pool-x', type: 'dir', path: '/srv/pool-x' },
          reason: 'forced failure action'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(false);
    expect(createNetwork).toHaveBeenCalledTimes(1);
    expect(deleteNetwork).toHaveBeenCalledTimes(1);
    expect(result.rollback?.attempted).toBe(true);
    expect(result.rollback?.results.some((item) => item.action.kind === 'proxmox.network.delete')).toBe(true);
  });

  it('executes explicit update actions for network and storage', async () => {
    const { deps, updateNetwork, updateStorage } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.network.update',
          node: 'node1',
          name: 'vmbr40',
          config: { name: 'vmbr40', node: 'node1', type: 'bridge', bridge_ports: 'eth1' },
          reason: 'update network'
        },
        {
          kind: 'proxmox.storage.update',
          name: 'pool40',
          config: { name: 'pool40', type: 'dir', path: '/srv/pool40' },
          reason: 'update storage'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(updateNetwork).toHaveBeenCalledTimes(1);
    expect(updateStorage).toHaveBeenCalledTimes(1);
  });

  it('executes proxmox IAM actions', async () => {
    const { deps, upsertUser, upsertToken, upsertAcl, upsertRole } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.user.update',
          config: { userId: 'naas@pve', comment: 'svc' },
          reason: 'upsert user'
        },
        {
          kind: 'proxmox.token.update',
          config: { userId: 'naas@pve', tokenId: 'naasctl', privilegeSeparation: false },
          reason: 'upsert token'
        },
        {
          kind: 'proxmox.role.update',
          config: { roleId: 'NAASAdmin', privs: ['VM.Allocate'] },
          reason: 'upsert role'
        },
        {
          kind: 'proxmox.acl.upsert',
          config: { path: '/', roleId: 'NAASAdmin', userId: 'naas@pve', propagate: true },
          reason: 'upsert acl'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertUser).toHaveBeenCalledTimes(1);
    expect(upsertToken).toHaveBeenCalledTimes(1);
    expect(upsertRole).toHaveBeenCalledTimes(1);
    expect(upsertAcl).toHaveBeenCalledTimes(1);
  });

  it('executes generic datacenter CRUD actions', async () => {
    const { deps, datacenterRequest } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.datacenter.create',
          path: '/access/groups',
          payload: { groupid: 'naas-group' },
          reason: 'create group'
        },
        {
          kind: 'proxmox.datacenter.read',
          path: '/access/users',
          reason: 'list users'
        },
        {
          kind: 'proxmox.datacenter.update',
          path: '/cluster/options',
          payload: { keyboard: 'fr' },
          reason: 'update options'
        },
        {
          kind: 'proxmox.datacenter.delete',
          path: '/access/groups/naas-group',
          reason: 'delete group'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(datacenterRequest).toHaveBeenNthCalledWith(1, 'create', '/access/groups', { groupid: 'naas-group' });
    expect(datacenterRequest).toHaveBeenNthCalledWith(2, 'read', '/access/users', undefined);
    expect(datacenterRequest).toHaveBeenNthCalledWith(3, 'update', '/cluster/options', { keyboard: 'fr' });
    expect(datacenterRequest).toHaveBeenNthCalledWith(4, 'delete', '/access/groups/naas-group', undefined);
  });

  it('executes Wave 6 storage and disk advanced lifecycle actions', async () => {
    const { deps, deleteStorageContent, copyStorageContent, moveVmDisk, importVmDisk, cloneVmDisk, initializeNodeDisk, createNodeLvm, createNodeLvmThin, createNodeZfs } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.storage-content.delete',
          config: { node: 'node1', storage: 'local-lvm', volume: 'vm-101-disk-0' },
          reason: 'delete old volume'
        },
        {
          kind: 'proxmox.storage-content.copy',
          config: { node: 'node1', storage: 'local-lvm', volume: 'vm-101-disk-0', targetStorage: 'archive' },
          reason: 'copy volume'
        },
        {
          kind: 'proxmox.vm.disk.move',
          config: { node: 'node1', vmid: 101, disk: 'scsi0', targetStorage: 'fast-ssd', deleteSource: true },
          reason: 'move disk'
        },
        {
          kind: 'proxmox.vm.disk.import',
          config: { node: 'node1', vmid: 101, source: '/tmp/disk.qcow2', storage: 'local-lvm', format: 'qcow2' },
          reason: 'import disk'
        },
        {
          kind: 'proxmox.vm.disk.clone',
          config: { node: 'node1', vmid: 101, disk: 'scsi0', targetStorage: 'fast-ssd', targetVmid: 102, targetDisk: 'scsi1', format: 'qcow2' },
          reason: 'clone disk'
        },
        {
          kind: 'proxmox.node-disk.initialize',
          config: { node: 'node1', disk: '/dev/sdb' },
          reason: 'init gpt'
        },
        {
          kind: 'proxmox.node-lvm.create',
          config: { node: 'node1', name: 'vg-data', device: '/dev/sdb' },
          reason: 'create lvm'
        },
        {
          kind: 'proxmox.node-lvmthin.create',
          config: { node: 'node1', volumeGroup: 'vg-data', name: 'thin-data' },
          reason: 'create lvm thin'
        },
        {
          kind: 'proxmox.node-zfs.create',
          config: { node: 'node1', name: 'zpool-data', devices: ['/dev/sdc'], raidLevel: 'raid0' },
          reason: 'create zfs'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(deleteStorageContent).toHaveBeenCalledTimes(1);
    expect(copyStorageContent).toHaveBeenCalledTimes(1);
    expect(moveVmDisk).toHaveBeenCalledTimes(1);
    expect(importVmDisk).toHaveBeenCalledTimes(1);
    expect(cloneVmDisk).toHaveBeenCalledTimes(1);
    expect(initializeNodeDisk).toHaveBeenCalledTimes(1);
    expect(createNodeLvm).toHaveBeenCalledTimes(1);
    expect(createNodeLvmThin).toHaveBeenCalledTimes(1);
    expect(createNodeZfs).toHaveBeenCalledTimes(1);
  });

  it('logs task progress messages for long-running proxmox actions', async () => {
    const { deps, migrateVm, loggerInfo } = depsWithSpies();
    migrateVm.mockImplementation(async (...args: unknown[]) => {
      const onProgress = args[1] as ((progress: { node: string; upid: string; operation: string; status: string; details?: string }) => void) | undefined;
      onProgress?.({
        node: 'node1',
        upid: 'UPID:node1:00000001:00000001:00000001:qmmigrate:101:root@pam:',
        operation: 'VM migrate 101',
        status: 'running'
      });
      onProgress?.({
        node: 'node1',
        upid: 'UPID:node1:00000001:00000001:00000001:qmmigrate:101:root@pam:',
        operation: 'VM migrate 101',
        status: 'OK',
        details: 'exitstatus=OK'
      });
    });

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.vm.migrate',
          config: { node: 'node1', vmid: 101, target: 'node2' },
          reason: 'migrate vm'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('[task] proxmox.vm.migrate'));
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('running'));
    expect(loggerInfo).toHaveBeenCalledWith(expect.stringContaining('exitstatus=OK'));
  });

  it('executes Proxmox group/realm/TFA actions', async () => {
    const { deps, upsertGroup, upsertRealm, createTfa, updateTfa, deleteTfa } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.group.update',
          config: { groupId: 'naas-group', users: ['naas@pve'] },
          reason: 'upsert group'
        },
        {
          kind: 'proxmox.realm.update',
          config: { realm: 'naas-realm', type: 'openid' },
          reason: 'upsert realm'
        },
        {
          kind: 'proxmox.tfa.create',
          config: { userId: 'naas@pve', type: 'totp', value: 'JBSWY3DPEHPK3PXP' },
          reason: 'create tfa'
        },
        {
          kind: 'proxmox.tfa.update',
          config: { userId: 'naas@pve', id: 'token-a', enabled: true },
          reason: 'update tfa'
        },
        {
          kind: 'proxmox.tfa.delete',
          userId: 'naas@pve',
          id: 'token-a',
          reason: 'delete tfa'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertGroup).toHaveBeenCalledTimes(1);
    expect(upsertRealm).toHaveBeenCalledTimes(1);
    expect(createTfa).toHaveBeenCalledTimes(1);
    expect(updateTfa).toHaveBeenCalledTimes(1);
    expect(deleteTfa).toHaveBeenCalledTimes(1);
  });

  it('executes Phase 2 datacenter governance actions', async () => {
    const {
      deps,
      updateClusterOptions,
      upsertPool,
      deletePool,
      upsertBackupJob,
      deleteBackupJob,
      upsertReplicationJob,
      deleteReplicationJob,
      updateDatacenterFirewallOptions
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.cluster-options.update',
          config: { options: { keyboard: 'fr' } },
          reason: 'cluster options'
        },
        {
          kind: 'proxmox.pool.update',
          config: { poolId: 'naas-pool', users: ['naas@pve'] },
          reason: 'pool update'
        },
        {
          kind: 'proxmox.pool.delete',
          poolId: 'old-pool',
          reason: 'pool delete'
        },
        {
          kind: 'proxmox.backup-job.update',
          config: { id: 'backup-naas', storage: 'pbs' },
          reason: 'backup update'
        },
        {
          kind: 'proxmox.backup-job.delete',
          id: 'old-backup',
          reason: 'backup delete'
        },
        {
          kind: 'proxmox.replication-job.update',
          config: { id: 'rep-naas', source: 'local-lvm:100', target: 'remote-lvm:100' },
          reason: 'replication update'
        },
        {
          kind: 'proxmox.replication-job.delete',
          id: 'old-rep',
          reason: 'replication delete'
        },
        {
          kind: 'proxmox.datacenter-firewall-options.update',
          config: { options: { enable: 1 } },
          reason: 'firewall options'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(updateClusterOptions).toHaveBeenCalledTimes(1);
    expect(upsertPool).toHaveBeenCalledTimes(1);
    expect(deletePool).toHaveBeenCalledTimes(1);
    expect(upsertBackupJob).toHaveBeenCalledTimes(1);
    expect(deleteBackupJob).toHaveBeenCalledTimes(1);
    expect(upsertReplicationJob).toHaveBeenCalledTimes(1);
    expect(deleteReplicationJob).toHaveBeenCalledTimes(1);
    expect(updateDatacenterFirewallOptions).toHaveBeenCalledTimes(1);
  });

  it('executes Phase 3 node system actions', async () => {
    const { deps, updateNodeDns, updateNodeHosts, updateNodeOptions, updateNodeTime, runNodeServiceAction, runNodeAptAction, requestNodeCertificate } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.node-dns.update', config: { node: 'proxmox', options: { search: 'lan' } }, reason: 'dns' },
        { kind: 'proxmox.node-hosts.update', config: { node: 'proxmox', options: { data: '127.0.0.1 localhost' } }, reason: 'hosts' },
        { kind: 'proxmox.node-options.update', config: { node: 'proxmox', options: { keyboard: 'fr' } }, reason: 'options' },
        { kind: 'proxmox.node-time.update', config: { node: 'proxmox', options: { timezone: 'Europe/Paris' } }, reason: 'time' },
        { kind: 'proxmox.node-service.action', config: { node: 'proxmox', service: 'pveproxy', action: 'restart' }, reason: 'service' },
        { kind: 'proxmox.node-apt.action', config: { node: 'proxmox', action: 'update' }, reason: 'apt' },
        {
          kind: 'proxmox.node-certificate.request',
          config: { node: 'proxmox', method: 'read', path: '/certificates/info' },
          reason: 'cert'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(updateNodeDns).toHaveBeenCalledTimes(1);
    expect(updateNodeHosts).toHaveBeenCalledTimes(1);
    expect(updateNodeOptions).toHaveBeenCalledTimes(1);
    expect(updateNodeTime).toHaveBeenCalledTimes(1);
    expect(runNodeServiceAction).toHaveBeenCalledTimes(1);
    expect(runNodeAptAction).toHaveBeenCalledTimes(1);
    expect(requestNodeCertificate).toHaveBeenCalledTimes(1);
  });

  it('executes Wave 4 SDN and datacenter firewall actions', async () => {
    const {
      deps,
      upsertSdnZone,
      deleteSdnZone,
      upsertSdnVnet,
      deleteSdnVnet,
      upsertSdnSubnet,
      deleteSdnSubnet,
      upsertDatacenterFirewallAlias,
      deleteDatacenterFirewallAlias,
      upsertDatacenterFirewallIpset,
      deleteDatacenterFirewallIpset,
      upsertDatacenterFirewallRule,
      deleteDatacenterFirewallRule
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.sdn-zone.update', config: { zone: 'zone-a', type: 'simple' }, reason: 'zone' },
        { kind: 'proxmox.sdn-zone.delete', zone: 'zone-old', reason: 'zone del' },
        { kind: 'proxmox.sdn-vnet.update', config: { vnet: 'vnet100', zone: 'zone-a' }, reason: 'vnet' },
        { kind: 'proxmox.sdn-vnet.delete', vnet: 'vnet-old', reason: 'vnet del' },
        { kind: 'proxmox.sdn-subnet.update', config: { vnet: 'vnet100', subnet: '10.0.0.0/24' }, reason: 'subnet' },
        { kind: 'proxmox.sdn-subnet.delete', vnet: 'vnet100', subnet: '10.0.1.0/24', reason: 'subnet del' },
        { kind: 'proxmox.datacenter-firewall-alias.update', config: { name: 'lan', cidr: '10.0.0.0/8' }, reason: 'alias' },
        { kind: 'proxmox.datacenter-firewall-alias.delete', name: 'old-alias', reason: 'alias del' },
        { kind: 'proxmox.datacenter-firewall-ipset.update', config: { name: 'trusted' }, reason: 'ipset' },
        { kind: 'proxmox.datacenter-firewall-ipset.delete', name: 'old-ipset', reason: 'ipset del' },
        { kind: 'proxmox.datacenter-firewall-rule.upsert', config: { action: 'ACCEPT', type: 'in' }, reason: 'rule' },
        { kind: 'proxmox.datacenter-firewall-rule.delete', id: '0', reason: 'rule del' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertSdnZone).toHaveBeenCalledTimes(1);
    expect(deleteSdnZone).toHaveBeenCalledTimes(1);
    expect(upsertSdnVnet).toHaveBeenCalledTimes(1);
    expect(deleteSdnVnet).toHaveBeenCalledTimes(1);
    expect(upsertSdnSubnet).toHaveBeenCalledTimes(1);
    expect(deleteSdnSubnet).toHaveBeenCalledTimes(1);
    expect(upsertDatacenterFirewallAlias).toHaveBeenCalledTimes(1);
    expect(deleteDatacenterFirewallAlias).toHaveBeenCalledTimes(1);
    expect(upsertDatacenterFirewallIpset).toHaveBeenCalledTimes(1);
    expect(deleteDatacenterFirewallIpset).toHaveBeenCalledTimes(1);
    expect(upsertDatacenterFirewallRule).toHaveBeenCalledTimes(1);
    expect(deleteDatacenterFirewallRule).toHaveBeenCalledTimes(1);
  });

  it('executes Wave 5 VM/CT advanced lifecycle actions', async () => {
    const {
      deps,
      migrateVm,
      migrateCt,
      backupVm,
      backupCt,
      restoreVm,
      restoreCt,
      createVmSnapshot,
      deleteVmSnapshot,
      createCtSnapshot,
      deleteCtSnapshot,
      runVmGuestAgentCommand
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.vm.migrate', config: { node: 'proxmox', vmid: 100, target: 'proxmox2' }, reason: 'vm migrate' },
        { kind: 'proxmox.ct.migrate', config: { node: 'proxmox', vmid: 200, target: 'proxmox2' }, reason: 'ct migrate' },
        { kind: 'proxmox.vm.backup', config: { node: 'proxmox', vmid: 100 }, reason: 'vm backup' },
        { kind: 'proxmox.ct.backup', config: { node: 'proxmox', vmid: 200 }, reason: 'ct backup' },
        {
          kind: 'proxmox.vm.restore',
          config: { node: 'proxmox', vmid: 101, archive: 'backup/vzdump-qemu-100.vma.zst' },
          reason: 'vm restore'
        },
        {
          kind: 'proxmox.ct.restore',
          config: { node: 'proxmox', vmid: 201, archive: 'backup/vzdump-lxc-200.tar.zst' },
          reason: 'ct restore'
        },
        {
          kind: 'proxmox.vm.snapshot.create',
          config: { node: 'proxmox', vmid: 100, name: 'snap-a' },
          reason: 'vm snap create'
        },
        {
          kind: 'proxmox.vm.snapshot.delete',
          config: { node: 'proxmox', vmid: 100, name: 'snap-a' },
          reason: 'vm snap delete'
        },
        {
          kind: 'proxmox.ct.snapshot.create',
          config: { node: 'proxmox', vmid: 200, name: 'snap-c' },
          reason: 'ct snap create'
        },
        {
          kind: 'proxmox.ct.snapshot.delete',
          config: { node: 'proxmox', vmid: 200, name: 'snap-c' },
          reason: 'ct snap delete'
        },
        {
          kind: 'proxmox.vm.guest-agent.command',
          config: { node: 'proxmox', vmid: 100, command: 'ping' },
          reason: 'agent'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(migrateVm).toHaveBeenCalledTimes(1);
    expect(migrateCt).toHaveBeenCalledTimes(1);
    expect(backupVm).toHaveBeenCalledTimes(1);
    expect(backupCt).toHaveBeenCalledTimes(1);
    expect(restoreVm).toHaveBeenCalledTimes(1);
    expect(restoreCt).toHaveBeenCalledTimes(1);
    expect(createVmSnapshot).toHaveBeenCalledTimes(1);
    expect(deleteVmSnapshot).toHaveBeenCalledTimes(1);
    expect(createCtSnapshot).toHaveBeenCalledTimes(1);
    expect(deleteCtSnapshot).toHaveBeenCalledTimes(1);
    expect(runVmGuestAgentCommand).toHaveBeenCalledTimes(1);
  });

  it('executes Wave 7 HA and Ceph flag actions', async () => {
    const { deps, upsertHaGroup, deleteHaGroup, upsertHaResource, deleteHaResource, upsertHaRule, deleteHaRule, setCephFlag, clearCephFlag } =
      depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.ha-group.update', config: { group: 'grp-a', nodes: ['proxmox'] }, reason: 'ha group' },
        { kind: 'proxmox.ha-group.delete', group: 'grp-old', reason: 'ha group del' },
        { kind: 'proxmox.ha-resource.update', config: { sid: 'vm:100', group: 'grp-a' }, reason: 'ha resource' },
        { kind: 'proxmox.ha-resource.delete', sid: 'vm:999', reason: 'ha resource del' },
        { kind: 'proxmox.ha-rule.update', config: { rule: 'rule-a', type: 'affinity', resources: ['vm:100'] }, reason: 'ha rule' },
        { kind: 'proxmox.ha-rule.delete', rule: 'rule-old', reason: 'ha rule del' },
        { kind: 'proxmox.ceph-flag.update', config: { flag: 'norebalance' }, reason: 'ceph flag' },
        { kind: 'proxmox.ceph-flag.delete', flag: 'nobackfill', reason: 'ceph flag del' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertHaGroup).toHaveBeenCalledTimes(1);
    expect(deleteHaGroup).toHaveBeenCalledTimes(1);
    expect(upsertHaResource).toHaveBeenCalledTimes(1);
    expect(deleteHaResource).toHaveBeenCalledTimes(1);
    expect(upsertHaRule).toHaveBeenCalledTimes(1);
    expect(deleteHaRule).toHaveBeenCalledTimes(1);
    expect(setCephFlag).toHaveBeenCalledTimes(1);
    expect(clearCephFlag).toHaveBeenCalledTimes(1);
  });

  it('executes HA status and Ceph read actions', async () => {
    const { deps, readHaStatus, readCeph, readNodeCeph, runNodeCephAction } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.ha-status.read', config: {}, reason: 'ha status' },
        { kind: 'proxmox.ceph.read', config: { section: 'status' }, reason: 'ceph status' },
        { kind: 'proxmox.ceph.read', config: { section: 'metadata' }, reason: 'ceph metadata' },
        { kind: 'proxmox.ceph.read', config: { section: 'flags' }, reason: 'ceph flags' },
        { kind: 'proxmox.node-ceph.read', config: { node: 'proxmox', section: 'status' }, reason: 'node ceph status' },
        { kind: 'proxmox.node-ceph.action', config: { node: 'proxmox', method: 'update', section: 'status', confirm: 'I_UNDERSTAND' }, reason: 'node ceph action' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(readHaStatus).toHaveBeenCalledTimes(1);
    expect(readCeph).toHaveBeenCalledTimes(3);
    expect(readNodeCeph).toHaveBeenCalledTimes(1);
    expect(runNodeCephAction).toHaveBeenCalledTimes(1);
  });

  it('executes Wave 7+8 node firewall/certs, SDN IPAM and task read actions', async () => {
    const {
      deps,
      updateNodeFirewallOptions,
      upsertNodeFirewallRule,
      deleteNodeFirewallRule,
      upsertNodeCustomCertificate,
      deleteNodeCustomCertificate,
      upsertNodeAcmeCertificate,
      deleteNodeAcmeCertificate,
      upsertSdnIpam,
      deleteSdnIpam,
      readNodeTasks,
      readClusterTasks
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.node-firewall-options.update', config: { node: 'proxmox', options: { enable: 1 } }, reason: 'fw opts' },
        { kind: 'proxmox.node-firewall-rule.upsert', config: { node: 'proxmox', action: 'ACCEPT', type: 'in' }, reason: 'fw rule upsert' },
        { kind: 'proxmox.node-firewall-rule.delete', node: 'proxmox', id: '0', reason: 'fw rule del' },
        { kind: 'proxmox.node-certificate-custom.upsert', config: { node: 'proxmox', payload: { restart: 1 } }, reason: 'custom cert' },
        { kind: 'proxmox.node-certificate-custom.delete', node: 'proxmox', reason: 'custom cert del' },
        { kind: 'proxmox.node-certificate-acme.upsert', config: { node: 'proxmox', payload: { force: 1 } }, reason: 'acme cert' },
        { kind: 'proxmox.node-certificate-acme.delete', node: 'proxmox', reason: 'acme cert del' },
        { kind: 'proxmox.sdn-ipam.update', config: { ipam: 'pve-ipam', type: 'pve' }, reason: 'ipam upsert' },
        { kind: 'proxmox.sdn-ipam.delete', ipam: 'old-ipam', reason: 'ipam del' },
        { kind: 'proxmox.node-task.read', config: { node: 'proxmox', limit: 5 }, reason: 'node tasks' },
        { kind: 'proxmox.cluster-task.read', config: { limit: 10 }, reason: 'cluster tasks' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(updateNodeFirewallOptions).toHaveBeenCalledTimes(1);
    expect(upsertNodeFirewallRule).toHaveBeenCalledTimes(1);
    expect(deleteNodeFirewallRule).toHaveBeenCalledTimes(1);
    expect(upsertNodeCustomCertificate).toHaveBeenCalledTimes(1);
    expect(deleteNodeCustomCertificate).toHaveBeenCalledTimes(1);
    expect(upsertNodeAcmeCertificate).toHaveBeenCalledTimes(1);
    expect(deleteNodeAcmeCertificate).toHaveBeenCalledTimes(1);
    expect(upsertSdnIpam).toHaveBeenCalledTimes(1);
    expect(deleteSdnIpam).toHaveBeenCalledTimes(1);
    expect(readNodeTasks).toHaveBeenCalledTimes(1);
    expect(readClusterTasks).toHaveBeenCalledTimes(1);
  });

  it('executes node task log and node firewall log read actions', async () => {
    const { deps, readNodeTaskLog, readNodeFirewallLog } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'proxmox.node-task.log.read', config: { node: 'proxmox', upid: 'UPID:node:0001', limit: 20 }, reason: 'task log' },
        { kind: 'proxmox.node-firewall.log.read', config: { node: 'proxmox', limit: 50 }, reason: 'firewall log' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(readNodeTaskLog).toHaveBeenCalledTimes(1);
    expect(readNodeFirewallLog).toHaveBeenCalledTimes(1);
  });

  it('executes generic node CRUD actions', async () => {
    const { deps, nodeRequest } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.node.read',
          node: 'proxmox',
          path: '/network',
          reason: 'list networks'
        },
        {
          kind: 'proxmox.node.update',
          node: 'proxmox',
          path: '/dns',
          payload: { search: 'lan' },
          reason: 'update dns'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(nodeRequest).toHaveBeenNthCalledWith(1, 'proxmox', 'read', '/network', undefined);
    expect(nodeRequest).toHaveBeenNthCalledWith(2, 'proxmox', 'update', '/dns', { search: 'lan' });
  });

  it('executes grafana CRUD actions', async () => {
    const { deps, grafanaRequest } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'grafana.create',
          path: '/api/folders',
          payload: { title: 'ops' },
          reason: 'create folder'
        },
        {
          kind: 'grafana.read',
          path: '/api/search',
          payload: { query: 'ops' },
          reason: 'read folders'
        },
        {
          kind: 'grafana.update',
          path: '/api/folders/ops',
          payload: { title: 'ops-updated', confirm: 'I_UNDERSTAND' },
          reason: 'update folder'
        },
        {
          kind: 'grafana.delete',
          path: '/api/folders/ops',
          payload: { confirm: 'I_UNDERSTAND' },
          reason: 'delete folder'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(grafanaRequest).toHaveBeenNthCalledWith(1, 'create', '/api/folders', { payload: { title: 'ops' } });
    expect(grafanaRequest).toHaveBeenNthCalledWith(2, 'read', '/api/search', { payload: { query: 'ops' } });
    expect(grafanaRequest).toHaveBeenNthCalledWith(3, 'update', '/api/folders/ops', {
      payload: {
        title: 'ops-updated',
        confirm: 'I_UNDERSTAND'
      }
    });
    expect(grafanaRequest).toHaveBeenNthCalledWith(4, 'delete', '/api/folders/ops', {
      payload: { confirm: 'I_UNDERSTAND' }
    });
  });

  it('executes universal grafana.request actions with method/query/body/headers/org', async () => {
    const { deps, grafanaRequest } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'grafana.request',
          method: 'patch',
          path: '/api/teams/1',
          query: { force: true },
          body: { name: 'sre-team', confirm: 'I_UNDERSTAND' },
          headers: { 'X-Custom-Trace': 'naas' },
          orgId: 2,
          reason: 'patch team'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(grafanaRequest).toHaveBeenCalledWith('patch', '/api/teams/1', {
      payload: undefined,
      query: { force: true },
      body: { name: 'sre-team', confirm: 'I_UNDERSTAND' },
      headers: { 'X-Custom-Trace': 'naas' },
      orgId: 2
    });
  });

  it('redacts sensitive fields from grafana action output', async () => {
    const { deps, grafanaRequest } = depsWithSpies();
    grafanaRequest.mockResolvedValueOnce({
      token: 'abc123',
      apiKey: 'key-123',
      headers: {
        Authorization: 'Bearer super-secret-token'
      },
      nested: {
        clientSecret: 'secret-value'
      }
    });

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'grafana.request',
          method: 'read',
          path: '/api/teams/1',
          reason: 'read team with sensitive payload'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    const output = result.results[0]?.output ?? '';
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('abc123');
    expect(output).not.toContain('key-123');
    expect(output).not.toContain('super-secret-token');
    expect(output).not.toContain('secret-value');
  });

  it('redacts sensitive values from action failure messages and logs', async () => {
    const { deps, grafanaRequest, loggerError } = depsWithSpies();
    grafanaRequest.mockRejectedValueOnce(
      new Error('request failed token=abc123 Authorization=Bearer super-secret-token password=hunter2')
    );

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'grafana.request',
          method: 'read',
          path: '/api/teams/1',
          reason: 'force a sensitive failure'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(false);
    const message = result.results[0]?.message ?? '';
    expect(message).toContain('[REDACTED]');
    expect(message).not.toContain('abc123');
    expect(message).not.toContain('super-secret-token');
    expect(message).not.toContain('hunter2');

    const serializedLoggerCalls = loggerError.mock.calls.map((call) => String(call[0])).join('\n');
    expect(serializedLoggerCalls).toContain('[REDACTED]');
    expect(serializedLoggerCalls).not.toContain('abc123');
    expect(serializedLoggerCalls).not.toContain('super-secret-token');
    expect(serializedLoggerCalls).not.toContain('hunter2');
  });

  it('executes typed grafana folder and dashboard actions', async () => {
    const { deps, upsertFolder, deleteFolder, upsertDashboard, deleteDashboard } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'grafana.folder.upsert',
          config: { uid: 'ops', title: 'Ops' },
          reason: 'upsert folder'
        },
        {
          kind: 'grafana.folder.delete',
          uid: 'old-folder',
          reason: 'delete folder'
        },
        {
          kind: 'grafana.dashboard.upsert',
          config: { uid: 'dash-ops', title: 'Ops Dashboard', dashboard: { title: 'Ops Dashboard' } },
          reason: 'upsert dashboard'
        },
        {
          kind: 'grafana.dashboard.delete',
          uid: 'dash-old',
          reason: 'delete dashboard'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertFolder).toHaveBeenCalledWith({ uid: 'ops', title: 'Ops' });
    expect(deleteFolder).toHaveBeenCalledWith('old-folder');
    expect(upsertDashboard).toHaveBeenCalledWith({ uid: 'dash-ops', title: 'Ops Dashboard', dashboard: { title: 'Ops Dashboard' } });
    expect(deleteDashboard).toHaveBeenCalledWith('dash-old');
  });

  it('executes Wave 2 typed grafana alerting, datasource, team and service-account actions', async () => {
    const {
      deps,
      upsertAlertRuleGroup,
      deleteAlertRuleGroup,
      upsertContactPoint,
      deleteContactPoint,
      replaceNotificationPolicy,
      upsertDatasource,
      deleteDatasource,
      upsertTeam,
      deleteTeam,
      syncTeamMembership,
      upsertServiceAccount,
      deleteServiceAccount,
      createServiceAccountToken,
      deleteServiceAccountToken
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'grafana.alert-rule-group.upsert', config: { folderUid: 'ops', group: 'alerts' }, reason: 'arg upsert' },
        { kind: 'grafana.alert-rule-group.delete', folderUid: 'ops', group: 'old', reason: 'arg delete' },
        { kind: 'grafana.contact-point.upsert', config: { uid: 'cp1', name: 'email-main' }, reason: 'cp upsert' },
        { kind: 'grafana.contact-point.delete', uid: 'cp-old', reason: 'cp delete' },
        {
          kind: 'grafana.notification-policy.replace',
          config: { policyTree: { receiver: 'email-main' }, confirm: 'I_UNDERSTAND' },
          reason: 'policy replace'
        },
        { kind: 'grafana.datasource.upsert', config: { uid: 'ds-prom', name: 'Prom', type: 'prometheus' }, reason: 'ds upsert' },
        { kind: 'grafana.datasource.delete', uid: 'ds-old', reason: 'ds delete' },
        { kind: 'grafana.team.upsert', config: { name: 'sre' }, reason: 'team upsert' },
        { kind: 'grafana.team.delete', id: 12, reason: 'team delete' },
        {
          kind: 'grafana.team-membership.sync',
          config: { teamId: 12, userIds: [1, 2], mode: 'replace', confirm: 'I_UNDERSTAND' },
          reason: 'team sync'
        },
        { kind: 'grafana.service-account.upsert', config: { name: 'naas-sa' }, reason: 'sa upsert' },
        { kind: 'grafana.service-account.delete', id: 33, reason: 'sa delete' },
        {
          kind: 'grafana.service-account-token.create',
          config: { serviceAccountId: 33, name: 'naas-token', secondsToLive: 3600 },
          reason: 'token create'
        },
        {
          kind: 'grafana.service-account-token.delete',
          serviceAccountId: 33,
          tokenId: 44,
          reason: 'token delete'
        }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(upsertAlertRuleGroup).toHaveBeenCalledTimes(1);
    expect(deleteAlertRuleGroup).toHaveBeenCalledTimes(1);
    expect(upsertContactPoint).toHaveBeenCalledTimes(1);
    expect(deleteContactPoint).toHaveBeenCalledTimes(1);
    expect(replaceNotificationPolicy).toHaveBeenCalledTimes(1);
    expect(upsertDatasource).toHaveBeenCalledTimes(1);
    expect(deleteDatasource).toHaveBeenCalledTimes(1);
    expect(upsertTeam).toHaveBeenCalledTimes(1);
    expect(deleteTeam).toHaveBeenCalledTimes(1);
    expect(syncTeamMembership).toHaveBeenCalledTimes(1);
    expect(upsertServiceAccount).toHaveBeenCalledTimes(1);
    expect(deleteServiceAccount).toHaveBeenCalledTimes(1);
    expect(createServiceAccountToken).toHaveBeenCalledTimes(1);
    expect(deleteServiceAccountToken).toHaveBeenCalledTimes(1);
  });

  it('executes Wave 3 typed grafana read/health/query/list actions', async () => {
    const {
      deps,
      readFolder,
      readDashboard,
      readAlertRuleGroup,
      readContactPoint,
      readNotificationPolicy,
      checkDatasourceHealth,
      queryDatasource,
      listServiceAccountTokens
    } = depsWithSpies();

    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        { kind: 'grafana.folder.read', config: { uid: 'ops' }, reason: 'read folder' },
        { kind: 'grafana.dashboard.read', config: { uid: 'dash-ops' }, reason: 'read dashboard' },
        { kind: 'grafana.alert-rule-group.read', config: { folderUid: 'ops', group: 'alerts' }, reason: 'read arg' },
        { kind: 'grafana.contact-point.read', config: { uid: 'cp1' }, reason: 'read cp' },
        { kind: 'grafana.notification-policy.read', reason: 'read policy' },
        { kind: 'grafana.datasource.health-check', config: { uid: 'ds-prom' }, reason: 'health' },
        { kind: 'grafana.datasource.query', config: { queries: [{ refId: 'A' }] }, reason: 'query' },
        { kind: 'grafana.service-account-token.list', config: { serviceAccountId: 33 }, reason: 'list tokens' }
      ]
    };

    const result = await executePlan(plan, deps, { dryRun: false, yes: true });

    expect(result.ok).toBe(true);
    expect(readFolder).toHaveBeenCalledTimes(1);
    expect(readDashboard).toHaveBeenCalledTimes(1);
    expect(readAlertRuleGroup).toHaveBeenCalledTimes(1);
    expect(readContactPoint).toHaveBeenCalledTimes(1);
    expect(readNotificationPolicy).toHaveBeenCalledTimes(1);
    expect(checkDatasourceHealth).toHaveBeenCalledTimes(1);
    expect(queryDatasource).toHaveBeenCalledTimes(1);
    expect(listServiceAccountTokens).toHaveBeenCalledTimes(1);
  });
});
