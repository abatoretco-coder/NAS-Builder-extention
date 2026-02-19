import { describe, expect, it } from 'vitest';
import type { DesiredSpec, Plan, UnifiedState } from '@naas/shared';
import { runPreflightChecks } from '../src/planner/preflight.js';

function baseState(): UnifiedState {
  return {
    generatedAt: new Date().toISOString(),
    env: 'preprod',
    compute: {
      nodes: [{ id: 'node1', name: 'node1', status: 'online', cpuUsage: 0.2, memoryUsedBytes: 1, memoryTotalBytes: 2 }],
      vms: [
        {
          id: 'node1/qemu/101',
          vmid: 101,
          node: 'node1',
          name: 'vm-101',
          status: 'running',
          disks: [],
          tags: [],
          bridges: []
        }
      ],
      cts: []
    },
    apps: { dockerHosts: [] },
    observability: { grafanaDashboards: [], grafanaDatasources: [] },
    warnings: []
  };
}

describe('runPreflightChecks', () => {
  it('returns error for conflicting provision/delete vmids', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'new-vm',
          vmid: 200,
          node: 'node1',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ],
      deleteVms: [200]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('both provisioned and deleted'))).toBe(true);
  });

  it('returns error for duplicate network declaration', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      networks: [
        { name: 'vmbr9', node: 'node1', type: 'bridge' },
        { name: 'vmbr9', node: 'node1', type: 'bridge' }
      ]
    };
    const plan: Plan = {
      generatedAt: new Date().toISOString(),
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.network.create',
          node: 'node1',
          name: 'vmbr9',
          config: { name: 'vmbr9', node: 'node1', type: 'bridge' },
          reason: 'create test bridge'
        }
      ]
    };

    const report = runPreflightChecks(current, desired, plan);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate network declaration'))).toBe(true);
  });

  it('returns warning for unknown node target', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'new-vm',
          vmid: 210,
          node: 'node-x',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.warnings.some((warning) => warning.includes('unknown node'))).toBe(true);
  });

  it('returns error for denied high-risk datacenter CRUD path', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxDatacenterCrud: [
        {
          method: 'create',
          path: '/qemu'
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('proxmoxDatacenterCrud'))).toBe(true);
  });

  it('returns error for invalid grafanaCrud path outside allowlist', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaCrud: [
        {
          method: 'read',
          path: '/admin/users'
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('grafanaCrud'))).toBe(true);
  });

  it('returns error when high-risk grafanaCrud write misses explicit confirmation', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaCrud: [
        {
          method: 'update',
          path: '/api/folders/ops'
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('I_UNDERSTAND'))).toBe(true);
  });

  it('accepts high-risk grafanaCrud write when body confirmation is provided', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaCrud: [
        {
          method: 'patch',
          path: '/api/folders/ops',
          body: { title: 'ops', confirm: 'I_UNDERSTAND' }
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(true);
  });

  it('returns error when high-risk generic CRUD misses explicit confirmation', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxDatacenterCrud: [
        {
          method: 'delete',
          path: '/access/users/naas@pve'
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('I_UNDERSTAND'))).toBe(true);
  });

  it('returns error for invalid typed node certificate path', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeCertificates: [
        {
          node: 'node1',
          method: 'read',
          path: '/dns'
        }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('proxmoxNodeCertificates path'))).toBe(true);
  });

  it('returns errors for duplicate SDN resources and firewall rule delete without id', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxSdnZones: [{ zone: 'zone-a' }, { zone: 'zone-a' }],
      proxmoxSdnVnets: [{ vnet: 'vnet100', zone: 'zone-a' }, { vnet: 'vnet100', zone: 'zone-a' }],
      proxmoxDatacenterFirewallRules: [{ ensure: 'absent', action: 'DROP' }]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxSdnZones'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxSdnVnets'))).toBe(true);
    expect(report.errors.some((error) => error.includes('ensure=absent require id'))).toBe(true);
  });

  it('returns errors for invalid Wave 5 migration target and duplicate snapshots', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxVmMigrations: [{ node: 'node1', vmid: 101, target: 'node1' }],
      proxmoxVmSnapshots: [
        { node: 'node1', vmid: 101, name: 'daily' },
        { node: 'node1', vmid: 101, name: 'daily' }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('identical source/target'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxVmSnapshots'))).toBe(true);
  });

  it('returns Wave 6 errors for duplicate storage content and warnings for unknown node operations', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxStorageContent: [
        { node: 'node1', storage: 'local-lvm', volume: 'vm-101-disk-0' },
        { node: 'node1', storage: 'local-lvm', volume: 'vm-101-disk-0' }
      ],
      proxmoxStorageContentCopy: [{ node: 'node-copy', storage: 'local-lvm', volume: 'vm-101-disk-0', targetStorage: 'archive' }],
      proxmoxVmDiskMoves: [{ node: 'node-x', vmid: 101, disk: 'scsi0', targetStorage: 'fast-ssd' }],
      proxmoxVmDiskImports: [{ node: 'node-y', vmid: 101, source: '/tmp/disk.qcow2', storage: 'local-lvm' }],
      proxmoxVmDiskClones: [{ node: 'node-clone', vmid: 101, disk: 'scsi0', targetStorage: 'fast-ssd', targetVmid: 102 }],
      proxmoxNodeDiskInitialize: [{ node: 'node-z', disk: '/dev/sdb' }],
      proxmoxNodeLvmCreate: [{ node: 'node-a', name: 'vg-data', device: '/dev/sdb' }],
      proxmoxNodeLvmThinCreate: [{ node: 'node-b', volumeGroup: 'vg-data', name: 'thin-data' }],
      proxmoxNodeZfsCreate: [{ node: 'node-c', name: 'zpool-data', devices: ['/dev/sdc'] }]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxStorageContent'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Storage content copy targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('VM disk move targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('VM disk import targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('VM disk clone targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node disk initialize targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node LVM create targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node LVM-thin create targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node ZFS create targets unknown node'))).toBe(true);
  });

  it('returns Wave 7 errors for duplicate HA/Ceph entries and warning for unknown HA group node', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxHaGroups: [
        { group: 'grp-a', nodes: ['node1', 'node-x'] },
        { group: 'grp-a', nodes: ['node1'] }
      ],
      proxmoxHaResources: [{ sid: 'vm:101' }, { sid: 'vm:101' }],
      proxmoxHaRules: [{ rule: 'rule-a' }, { rule: 'rule-a' }],
      proxmoxCephFlags: [{ flag: 'norebalance' }, { flag: 'norebalance' }]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxHaGroups'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxHaResources'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxHaRules'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxCephFlags'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('references unknown node node-x'))).toBe(true);
  });

  it('returns Wave 7+8 errors and warnings for node firewall/cert/IPAM/task declarations', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeFirewallOptions: [{ node: 'node-x', options: { enable: 1 } }],
      proxmoxNodeFirewallRules: [
        { node: 'node-y', ensure: 'absent', action: 'DROP' },
        { node: 'node-z', action: 'ACCEPT', type: 'in' }
      ],
      proxmoxNodeCertificateCustom: [{ node: 'node-a' }],
      proxmoxNodeCertificateAcme: [{ node: 'node-b' }],
      proxmoxSdnIpams: [{ ipam: 'pve-ipam' }, { ipam: 'pve-ipam' }],
      proxmoxNodeTasks: [{ node: 'node-t', limit: 10 }]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('proxmoxNodeFirewallRules entries with ensure=absent require id'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxSdnIpams'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node firewall options target unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node firewall rule targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node custom certificate request targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node ACME certificate request targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node task query targets unknown node'))).toBe(true);
  });

  it('returns Wave 8 errors for duplicate HA status and Ceph read declarations', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxHaStatus: [{ section: 'status' }, { section: 'status' }],
      proxmoxCephRead: [{ section: 'status' }, { section: 'status' }],
      proxmoxNodeCephRead: [{ node: 'node-x' }, { node: 'node-x' }],
      proxmoxNodeCephActions: [
        { node: 'node-x', method: 'update' },
        { node: 'node-x', method: 'update' }
      ]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxHaStatus'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxCephRead'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxNodeCephRead'))).toBe(true);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxNodeCephActions'))).toBe(true);
    expect(report.errors.some((error) => error.includes('confirm=I_UNDERSTAND'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node ceph query targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node ceph action targets unknown node'))).toBe(true);
  });

  it('returns log query validation results for node task logs and firewall logs', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeTaskLogs: [
        { node: 'node-x', upid: 'UPID:node-x:0001' },
        { node: 'node-x', upid: 'UPID:node-x:0001' }
      ],
      proxmoxNodeFirewallLogs: [{ node: 'node-y', limit: 20 }]
    };

    const report = runPreflightChecks(current, desired);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('Duplicate proxmoxNodeTaskLogs'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node task log query targets unknown node'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('Node firewall log query targets unknown node'))).toBe(true);
  });
});
