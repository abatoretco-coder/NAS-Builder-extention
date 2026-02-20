import { describe, expect, it } from 'vitest';
import type { DesiredSpec, UnifiedState } from '@naas/shared';
import { buildPlan } from '../src/planner/planner.js';

function baseState(): UnifiedState {
  return {
    generatedAt: new Date().toISOString(),
    env: 'preprod',
    compute: {
      nodes: [],
      vms: [
        {
          id: 'node1/qemu/101',
          vmid: 101,
          node: 'node1',
          name: 'media-vm',
          status: 'running',
          cpuCores: 2,
          memoryMb: 2048,
          disks: ['scsi0:local-lvm:vm-101-disk-0,size=20G'],
          tags: [],
          bridges: []
        }
      ],
      cts: [],
      networks: [],
      storage: []
    },
    apps: {
      dockerHosts: []
    },
    observability: {
      grafanaDashboards: [],
      grafanaDatasources: []
    },
    warnings: []
  };
}

describe('buildPlan', () => {
  it('adds snapshot before risky stop', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [
        {
          vmid: 101,
          desiredPower: 'stopped',
          risky: true
        }
      ],
      composeProjects: []
    };

    const plan = buildPlan(current, desired);

    expect(plan.actions[0]?.kind).toBe('proxmox.snapshot');
    expect(plan.actions[1]?.kind).toBe('proxmox.stop');
  });

  it('adds compose redeploy actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [
        {
          path: '/opt/stacks/media',
          ensure: 'running'
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ kind: 'docker.compose.redeploy' });
  });

  it('adds grafana CRUD actions from desired spec', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaCrud: [
        {
          method: 'read',
          path: '/api/search',
          payload: { query: 'infra' }
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        kind: 'grafana.read',
        path: '/api/search',
        payload: { query: 'infra' }
      })
    );
  });

  it('adds grafana.request action for advanced HTTP options', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaCrud: [
        {
          method: 'patch',
          path: '/api/teams/1',
          query: { force: true },
          body: { name: 'sre-team' },
          headers: { 'X-Trace': 'naas' },
          orgId: 2
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        kind: 'grafana.request',
        method: 'patch',
        path: '/api/teams/1',
        orgId: 2
      })
    );
  });

  it('adds typed grafana folder and dashboard actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaFolders: [
        { uid: 'ops', title: 'Ops' },
        { uid: 'old', title: 'Old', ensure: 'absent' }
      ],
      grafanaDashboards: [
        { uid: 'dash-ops', title: 'Ops Dashboard', dashboard: { title: 'Ops Dashboard' } },
        { uid: 'dash-old', ensure: 'absent' }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions).toContainEqual(
      expect.objectContaining({ kind: 'grafana.folder.upsert' })
    );
    expect(plan.actions).toContainEqual(
      expect.objectContaining({ kind: 'grafana.folder.delete', uid: 'old' })
    );
    expect(plan.actions).toContainEqual(
      expect.objectContaining({ kind: 'grafana.dashboard.upsert' })
    );
    expect(plan.actions).toContainEqual(
      expect.objectContaining({ kind: 'grafana.dashboard.delete', uid: 'dash-old' })
    );
  });

  it('adds Wave 2 typed grafana actions for alerting, datasource, team and service-account domains', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaAlertRuleGroups: [{ folderUid: 'ops', group: 'alerts' }],
      grafanaContactPoints: [{ uid: 'cp1', name: 'email-main' }, { uid: 'cp-old', name: 'old', ensure: 'absent' }],
      grafanaNotificationPolicies: [{ policyTree: { receiver: 'email-main' }, confirm: 'I_UNDERSTAND' }],
      grafanaDatasources: [
        { uid: 'ds-prom', name: 'Prom', type: 'prometheus' },
        { uid: 'ds-old', name: 'Old', type: 'prometheus', ensure: 'absent' }
      ],
      grafanaTeams: [{ name: 'sre' }, { id: 12, name: 'old-team', ensure: 'absent' }],
      grafanaTeamMemberships: [{ teamId: 12, userIds: [1], mode: 'replace', confirm: 'I_UNDERSTAND' }],
      grafanaServiceAccounts: [{ name: 'naas-sa' }, { id: 33, name: 'old-sa', ensure: 'absent' }],
      grafanaServiceAccountTokens: [
        { serviceAccountId: 33, name: 'naas-token' },
        { serviceAccountId: 33, name: 'old-token', ensure: 'absent', tokenId: 44 }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'grafana.alert-rule-group.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.contact-point.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.contact-point.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.notification-policy.replace')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.datasource.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.datasource.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.team.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.team.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.team-membership.sync')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.service-account.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.service-account.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.service-account-token.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.service-account-token.delete')).toBe(true);
  });

  it('adds Wave 3 typed grafana read health query and token-list actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      grafanaFolderReads: [{ uid: 'ops' }],
      grafanaDashboardReads: [{ uid: 'dash-ops' }],
      grafanaAlertRuleGroupReads: [{ folderUid: 'ops', group: 'alerts' }],
      grafanaContactPointReads: [{ uid: 'cp1' }],
      grafanaNotificationPolicyRead: true,
      grafanaDatasourceHealthChecks: [{ uid: 'ds-prom' }],
      grafanaDatasourceQueries: [{ queries: [{ refId: 'A' }] }],
      grafanaServiceAccountTokenLists: [{ serviceAccountId: 33 }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'grafana.folder.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.dashboard.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.alert-rule-group.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.contact-point.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.notification-policy.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.datasource.health-check')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.datasource.query')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'grafana.service-account-token.list')).toBe(true);
  });

  it('adds vm provisioning action when vm does not exist', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'new-vm',
          vmid: 999,
          node: 'node1',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.create')).toBe(true);
  });

  it('adds container create and delete actions', () => {
    const current = baseState();
    current.compute.cts.push({
      id: 'node1/lxc/201',
      vmid: 201,
      node: 'node1',
      name: 'old-ct',
      status: 'running',
      cpuCores: 1,
      memoryMb: 512,
      rootFs: 'local-lvm:4',
      tags: [],
      bridges: []
    });

    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      containerProvision: [
        {
          name: 'new-ct',
          vmid: 301,
          node: 'node1',
          ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
          rootfs: { storage: 'local-lvm', size: '8G' },
          networks: [{ index: 0, bridge: 'vmbr0', ip: 'dhcp' }]
        }
      ],
      deleteContainers: [201]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.delete')).toBe(true);
  });

  it('adds vm update and disk actions for existing vm', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'media-vm',
          vmid: 101,
          node: 'node1',
          cpu: { cores: 4 },
          memory: { size: 4096 },
          disks: [
            { interface: 'scsi', index: 0, storage: 'local-lvm', size: '40G' },
            { interface: 'scsi', index: 1, storage: 'local-lvm', size: '10G' }
          ],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.resize-disk')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.attach-disk')).toBe(true);
  });

  it('adds container update for existing container changes', () => {
    const current = baseState();
    current.compute.cts.push({
      id: 'node1/lxc/301',
      vmid: 301,
      node: 'node1',
      name: 'app-ct',
      status: 'running',
      cpuCores: 1,
      memoryMb: 1024,
      rootFs: 'local-lvm:8',
      tags: [],
      bridges: []
    });

    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      containerProvision: [
        {
          name: 'app-ct',
          vmid: 301,
          node: 'node1',
          ostemplate: 'local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          rootfs: { storage: 'local-lvm', size: '8G' },
          networks: [{ index: 0, bridge: 'vmbr0', ip: 'dhcp' }]
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.update')).toBe(true);
  });

  it('adds reboot after vm update when change requires reboot', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'media-vm',
          vmid: 101,
          node: 'node1',
          cpu: { cores: 2, sockets: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ]
    };

    const plan = buildPlan(current, desired);
    const updateIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.vm.update');
    const rebootIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.reboot');

    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(rebootIndex).toBeGreaterThan(updateIndex);
  });

  it('keeps delete actions after create/update actions for safer apply', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [{ path: '/opt/stacks/media', ensure: 'running' }],
      vmProvision: [
        {
          name: 'new-vm',
          vmid: 202,
          node: 'node1',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ],
      deleteVms: [101]
    };

    const plan = buildPlan(current, desired);
    const createIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.vm.create');
    const appIndex = plan.actions.findIndex((action) => action.kind === 'docker.compose.redeploy');
    const deleteIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.vm.delete');

    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(appIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(createIndex);
    expect(deleteIndex).toBeGreaterThan(appIndex);
  });

  it('adds network and storage actions before vm provisioning actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      networks: [{ name: 'vmbr10', node: 'node1', type: 'bridge' }],
      storage: [{ name: 'pool10', type: 'dir', path: '/srv/pool10' }],
      vmProvision: [
        {
          name: 'new-vm',
          vmid: 777,
          node: 'node1',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'pool10', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr10' }]
        }
      ]
    };

    const plan = buildPlan(current, desired);
    const networkIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.network.create');
    const storageIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.storage.create');
    const vmCreateIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.vm.create');

    expect(networkIndex).toBeGreaterThanOrEqual(0);
    expect(storageIndex).toBeGreaterThanOrEqual(0);
    expect(vmCreateIndex).toBeGreaterThanOrEqual(0);
    expect(networkIndex).toBeLessThan(vmCreateIndex);
    expect(storageIndex).toBeLessThan(vmCreateIndex);
  });

  it('uses network/storage update actions when infra already exists with drift', () => {
    const current = baseState();
    current.compute.networks = [
      {
        node: 'node1',
        name: 'vmbr20',
        type: 'bridge',
        config: {
          bridge_ports: 'eth0',
          bridge_vlan_aware: false
        }
      }
    ];
    current.compute.storage = [
      {
        name: 'pool20',
        type: 'dir',
        config: {
          path: '/srv/oldpool'
        }
      }
    ];

    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      networks: [
        {
          name: 'vmbr20',
          node: 'node1',
          type: 'bridge',
          bridge_ports: 'eth1',
          bridge_vlan_aware: true
        }
      ],
      storage: [
        {
          name: 'pool20',
          type: 'dir',
          path: '/srv/newpool'
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.network.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.storage.update')).toBe(true);
  });

  it('adds Proxmox IAM actions for users, tokens, ACL and roles', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxUsers: [
        {
          userId: 'naas@pve',
          comment: 'NAAS service account'
        }
      ],
      proxmoxTokens: [
        {
          userId: 'naas@pve',
          tokenId: 'naasctl',
          privilegeSeparation: false
        }
      ],
      proxmoxRoles: [
        {
          roleId: 'NAASAdmin',
          privs: ['VM.Allocate', 'VM.Config.CPU']
        }
      ],
      proxmoxAcls: [
        {
          path: '/',
          roleId: 'NAASAdmin',
          userId: 'naas@pve',
          propagate: true
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.user.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.token.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.role.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.acl.upsert')).toBe(true);
  });

  it('adds Proxmox access actions for groups, realms and TFA', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxGroups: [
        {
          groupId: 'naas-group',
          users: ['naas@pve']
        }
      ],
      proxmoxRealms: [
        {
          realm: 'naas-realm',
          type: 'openid',
          options: { 'issuer-url': 'https://issuer.example' }
        }
      ],
      proxmoxTfa: [
        {
          userId: 'naas@pve',
          type: 'totp',
          value: 'JBSWY3DPEHPK3PXP'
        },
        {
          userId: 'naas@pve',
          id: 'token-a',
          enabled: true
        },
        {
          userId: 'naas@pve',
          id: 'token-b',
          ensure: 'absent'
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.group.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.realm.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.tfa.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.tfa.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.tfa.delete')).toBe(true);
  });

  it('adds Phase 2 datacenter governance actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxClusterOptions: {
        options: { keyboard: 'fr' }
      },
      proxmoxPools: [
        {
          poolId: 'naas-pool',
          users: ['naas@pve']
        }
      ],
      proxmoxBackupJobs: [
        {
          id: 'backup-naas',
          storage: 'pbs',
          schedule: 'daily'
        }
      ],
      proxmoxReplicationJobs: [
        {
          id: 'rep-naas',
          source: 'local-lvm:100',
          target: 'remote-lvm:100',
          schedule: '*/15'
        }
      ],
      proxmoxDatacenterFirewallOptions: {
        options: { enable: 1 }
      }
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.cluster-options.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.pool.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.backup-job.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.replication-job.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter-firewall-options.update')).toBe(true);
  });

  it('adds Phase 3 node system actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeDns: [{ node: 'proxmox', options: { search: 'lan' } }],
      proxmoxNodeHosts: [{ node: 'proxmox', options: { digest: 'abc', data: '192.168.1.10 nas.local' } }],
      proxmoxNodeOptions: [{ node: 'proxmox', options: { keyboard: 'fr' } }],
      proxmoxNodeTime: [{ node: 'proxmox', options: { timezone: 'Europe/Paris' } }],
      proxmoxNodeServices: [{ node: 'proxmox', service: 'pveproxy', action: 'restart' }],
      proxmoxNodeApt: [{ node: 'proxmox', action: 'update' }],
      proxmoxNodeCertificates: [{ node: 'proxmox', method: 'read', path: '/certificates/info' }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-dns.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-hosts.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-options.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-time.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-service.action')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-apt.action')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-certificate.request')).toBe(true);
  });

  it('adds Wave 4 SDN and datacenter firewall actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxSdnZones: [{ zone: 'zone-a', type: 'simple' }],
      proxmoxSdnVnets: [{ vnet: 'vnet100', zone: 'zone-a', tag: 100 }],
      proxmoxSdnSubnets: [{ vnet: 'vnet100', subnet: '10.10.100.0/24', gateway: '10.10.100.1' }],
      proxmoxDatacenterFirewallAliases: [{ name: 'lan-net', cidr: '10.10.0.0/16' }],
      proxmoxDatacenterFirewallIpsets: [{ name: 'trusted' }],
      proxmoxDatacenterFirewallRules: [{ action: 'ACCEPT', type: 'in', source: '+trusted', pos: 0 }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.sdn-zone.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.sdn-vnet.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.sdn-subnet.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter-firewall-alias.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter-firewall-ipset.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter-firewall-rule.upsert')).toBe(true);
  });

  it('moves firewall mutation actions to the end of the plan for safer rollout', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      vmProvision: [
        {
          name: 'new-vm-safe-order',
          vmid: 909,
          node: 'node1',
          cpu: { cores: 2 },
          memory: { size: 2048 },
          disks: [{ interface: 'scsi', index: 0, storage: 'local-lvm', size: '20G' }],
          networks: [{ interface: 'net', index: 0, model: 'virtio', bridge: 'vmbr0' }]
        }
      ],
      proxmoxDatacenterFirewallRules: [{ action: 'DROP', type: 'in', pos: 999 }]
    };

    const plan = buildPlan(current, desired);
    const vmCreateIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.vm.create');
    const firewallIndex = plan.actions.findIndex((action) => action.kind === 'proxmox.datacenter-firewall-rule.upsert');

    expect(vmCreateIndex).toBeGreaterThanOrEqual(0);
    expect(firewallIndex).toBeGreaterThan(vmCreateIndex);
  });

  it('adds Wave 5 VM/CT advanced lifecycle actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxVmMigrations: [{ node: 'proxmox', vmid: 100, target: 'proxmox2' }],
      proxmoxCtMigrations: [{ node: 'proxmox', vmid: 200, target: 'proxmox2' }],
      proxmoxVmBackups: [{ node: 'proxmox', vmid: 100, storage: 'pbs' }],
      proxmoxCtBackups: [{ node: 'proxmox', vmid: 200, storage: 'pbs' }],
      proxmoxVmRestores: [{ node: 'proxmox', vmid: 101, archive: 'backup/vzdump-qemu-100.vma.zst' }],
      proxmoxCtRestores: [{ node: 'proxmox', vmid: 201, archive: 'backup/vzdump-lxc-200.tar.zst' }],
      proxmoxVmSnapshots: [{ node: 'proxmox', vmid: 100, name: 'daily' }],
      proxmoxCtSnapshots: [{ node: 'proxmox', vmid: 200, name: 'daily' }],
      proxmoxVmGuestAgent: [{ node: 'proxmox', vmid: 100, command: 'ping' }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.migrate')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.migrate')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.backup')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.backup')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.restore')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.restore')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.snapshot.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ct.snapshot.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.guest-agent.command')).toBe(true);
  });

  it('adds Wave 6 storage and disk advanced lifecycle actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxStorageContent: [{ node: 'proxmox', storage: 'local-lvm', volume: 'vm-100-disk-1' }],
      proxmoxStorageContentCopy: [{ node: 'proxmox', storage: 'local-lvm', volume: 'vm-100-disk-1', targetStorage: 'archive' }],
      proxmoxVmDiskMoves: [{ node: 'proxmox', vmid: 100, disk: 'scsi0', targetStorage: 'fast-ssd' }],
      proxmoxVmDiskImports: [{ node: 'proxmox', vmid: 100, source: '/var/lib/vz/images/disk.qcow2', storage: 'local-lvm' }],
      proxmoxVmDiskClones: [{ node: 'proxmox', vmid: 100, disk: 'scsi0', targetStorage: 'fast-ssd', targetVmid: 101, targetDisk: 'scsi1' }],
      proxmoxNodeDiskInitialize: [{ node: 'proxmox', disk: '/dev/sdb' }],
      proxmoxNodeLvmCreate: [{ node: 'proxmox', name: 'vg-data', device: '/dev/sdb' }],
      proxmoxNodeLvmThinCreate: [{ node: 'proxmox', volumeGroup: 'vg-data', name: 'thin-data' }],
      proxmoxNodeZfsCreate: [{ node: 'proxmox', name: 'zpool-data', devices: ['/dev/sdc'], raidLevel: 'raid0' }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.storage-content.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.storage-content.copy')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.disk.move')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.disk.import')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.vm.disk.clone')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-disk.initialize')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-lvm.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-lvmthin.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-zfs.create')).toBe(true);
  });

  it('adds capacity hints for high-usage target storage in Wave 6 actions', () => {
    const current = baseState();
    current.compute.storage = [
      {
        name: 'fast-ssd',
        type: 'lvmthin',
        config: { total: 1000, used: 920 }
      }
    ];

    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxVmDiskMoves: [{ node: 'proxmox', vmid: 100, disk: 'scsi0', targetStorage: 'fast-ssd' }],
      proxmoxVmDiskClones: [{ node: 'proxmox', vmid: 100, disk: 'scsi0', targetStorage: 'fast-ssd', targetVmid: 101 }],
      proxmoxStorageContentCopy: [{ node: 'proxmox', storage: 'local-lvm', volume: 'vm-100-disk-0', targetStorage: 'fast-ssd' }]
    };

    const plan = buildPlan(current, desired);
    const reasons = plan.actions
      .filter((action) => ['proxmox.vm.disk.move', 'proxmox.vm.disk.clone', 'proxmox.storage-content.copy'].includes(action.kind))
      .map((action) => action.reason);

    expect(reasons.length).toBe(3);
    expect(reasons.every((reason) => reason.includes('capacity hint'))).toBe(true);
    expect(reasons.every((reason) => reason.includes('fast-ssd'))).toBe(true);
  });

  it('adds Wave 7 HA and Ceph flag actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxHaGroups: [{ group: 'grp-a', nodes: ['proxmox'] }],
      proxmoxHaResources: [{ sid: 'vm:100', group: 'grp-a', state: 'started' }],
      proxmoxHaRules: [{ rule: 'rule-a', type: 'affinity', resources: ['vm:100'] }],
      proxmoxCephFlags: [{ flag: 'norebalance' }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ha-group.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ha-resource.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ha-rule.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ceph-flag.update')).toBe(true);
  });

  it('adds Wave 7+8 node firewall, cert lifecycle, SDN IPAM and task read actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeFirewallOptions: [{ node: 'proxmox', options: { enable: 1 } }],
      proxmoxNodeFirewallRules: [
        { node: 'proxmox', action: 'ACCEPT', type: 'in' },
        { node: 'proxmox', id: '0', ensure: 'absent', action: 'DROP' }
      ],
      proxmoxNodeCertificateCustom: [{ node: 'proxmox', payload: { restart: 1 } }],
      proxmoxNodeCertificateAcme: [{ node: 'proxmox', payload: { force: 1 } }],
      proxmoxSdnIpams: [{ ipam: 'pve-ipam', type: 'pve' }],
      proxmoxNodeTasks: [{ node: 'proxmox', limit: 5 }],
      proxmoxClusterTasks: [{ limit: 10 }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-firewall-options.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-firewall-rule.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-firewall-rule.delete')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-certificate-custom.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-certificate-acme.upsert')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.sdn-ipam.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-task.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.cluster-task.read')).toBe(true);
  });

  it('adds HA status and Ceph read actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxHaStatus: [{}],
      proxmoxCephRead: [{ section: 'overview' }, { section: 'status' }, { section: 'metadata' }, { section: 'flags' }],
      proxmoxNodeCephRead: [{ node: 'proxmox' }, { node: 'proxmox', section: 'status' }],
      proxmoxNodeCephActions: [{ node: 'proxmox', method: 'update', section: 'status', confirm: 'I_UNDERSTAND' }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.ha-status.read')).toBe(true);
    expect(plan.actions.filter((action) => action.kind === 'proxmox.ceph.read').length).toBe(4);
    expect(plan.actions.filter((action) => action.kind === 'proxmox.node-ceph.read').length).toBe(2);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-ceph.action')).toBe(true);
  });

  it('adds node task log and firewall log read actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeTaskLogs: [{ node: 'proxmox', upid: 'UPID:node:0001', limit: 10 }],
      proxmoxNodeFirewallLogs: [{ node: 'proxmox', limit: 50 }]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-task.log.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node-firewall.log.read')).toBe(true);
  });

  it('adds generic proxmox datacenter CRUD actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxDatacenterCrud: [
        {
          method: 'create',
          path: '/access/groups',
          payload: { groupid: 'naas-group', comment: 'NAAS group' }
        },
        {
          method: 'read',
          path: '/access/users'
        },
        {
          method: 'update',
          path: '/cluster/options',
          payload: { keyboard: 'fr' }
        },
        {
          method: 'delete',
          path: '/access/groups/naas-group'
        }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.datacenter.delete')).toBe(true);
  });

  it('adds generic proxmox node CRUD actions', () => {
    const current = baseState();
    const desired: DesiredSpec = {
      vms: [],
      composeProjects: [],
      proxmoxNodeCrud: [
        { method: 'read', node: 'proxmox', path: '/network' },
        { method: 'update', node: 'proxmox', path: '/dns', payload: { search: 'lan' } },
        { method: 'create', node: 'proxmox', path: '/firewall/rules', payload: { action: 'ACCEPT' } },
        { method: 'delete', node: 'proxmox', path: '/firewall/rules/0' }
      ]
    };

    const plan = buildPlan(current, desired);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node.read')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node.update')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node.create')).toBe(true);
    expect(plan.actions.some((action) => action.kind === 'proxmox.node.delete')).toBe(true);
  });
});
