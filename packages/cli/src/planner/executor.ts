import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { ActionResult, ApplyResult, Plan, PlanAction } from '@naas/shared';
import type { DockerProvider, GrafanaProvider, ProxmoxProvider, ProxmoxTaskProgress } from '../providers/index.js';
import type { Logger } from '../utils/logger.js';

export interface ExecutorDeps {
  proxmox?: ProxmoxProvider;
  docker: DockerProvider;
  grafana?: GrafanaProvider;
  logger: Logger;
}

export interface ExecuteOptions {
  dryRun: boolean;
  yes: boolean;
}

export async function executePlan(
  plan: Plan,
  deps: ExecutorDeps,
  options: ExecuteOptions
): Promise<ApplyResult> {
  const { logger } = deps;

  if (!options.yes && !options.dryRun && plan.actions.length > 0) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(`Apply ${plan.actions.length} action(s)? [y/N] `);
    rl.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      return {
        generatedAt: new Date().toISOString(),
        env: plan.env,
        dryRun: false,
        ok: false,
        results: []
      };
    }
  }

  const results: ActionResult[] = [];
  let rollback: ApplyResult['rollback'];

  for (const action of plan.actions) {
    const startedAt = new Date().toISOString();
    logger.info(`→ ${action.kind}: ${action.reason}`);

    if (options.dryRun) {
      const finishedAt = new Date().toISOString();
      results.push({
        action,
        success: true,
        startedAt,
        finishedAt,
        message: 'Dry-run: skipped execution'
      });
      continue;
    }

    try {
      const output = await executeAction(action, deps);

      const finishedAt = new Date().toISOString();
      logger.info(`✓ ${action.kind}`);
      results.push({
        action,
        success: true,
        startedAt,
        finishedAt,
        message: 'Completed',
        output
      });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const shortMsg = error instanceof Error ? error.message : String(error);
      const message = error instanceof Error && error.stack
        ? `${error.message}\n${error.stack}`.trim()
        : shortMsg;
      logger.error(`✗ ${action.kind}: ${shortMsg}`);
      results.push({
        action,
        success: false,
        startedAt,
        finishedAt,
        message
      });

      rollback = await rollbackExecutedActions(results, deps, logger);
      break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    env: plan.env,
    dryRun: options.dryRun,
    ok: results.every((item) => item.success),
    results,
    rollback
  };
}

async function executeAction(action: PlanAction, deps: ExecutorDeps): Promise<string> {
  const taskProgress = createTaskProgressHandler(deps.logger, action.kind);

  switch (action.kind) {
    case 'proxmox.start':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.startVm(action.node, action.vmid, action.vmType);
      return '';
    case 'proxmox.stop':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.stopVm(action.node, action.vmid, action.vmType);
      return '';
    case 'proxmox.reboot':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.rebootVm(action.node, action.vmid, action.vmType);
      return '';
    case 'proxmox.snapshot':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.snapshotQemu(action.node, action.vmid, action.name);
      return '';
    case 'proxmox.vm.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createVm(action.config);
      return '';
    case 'proxmox.vm.clone':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.cloneVm(action.node, action.sourceVmid, action.vmid, action.config);
      return '';
    case 'proxmox.vm.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateVmConfig(action.node, action.vmid, action.changes);
      return '';
    case 'proxmox.vm.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteVm(action.node, action.vmid);
      return '';
    case 'proxmox.ct.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createContainer(action.config);
      return '';
    case 'proxmox.ct.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateContainerConfig(action.node, action.vmid, action.changes);
      return '';
    case 'proxmox.ct.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteContainer(action.node, action.vmid);
      return '';
    case 'proxmox.vm.resize-disk':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.resizeVmDisk(action.node, action.vmid, action.disk, action.newSize);
      return '';
    case 'proxmox.vm.attach-disk':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.attachVmDisk(action.node, action.vmid, action.disk);
      return '';
    case 'proxmox.vm.detach-disk':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.detachVmDisk(action.node, action.vmid, action.disk);
      return '';
    case 'proxmox.network.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createNetwork(action.config);
      return '';
    case 'proxmox.network.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNetwork(action.config);
      return '';
    case 'proxmox.network.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteNetwork(action.node, action.name);
      return '';
    case 'proxmox.storage.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createStorage(action.config);
      return '';
    case 'proxmox.storage.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateStorage(action.config);
      return '';
    case 'proxmox.storage.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteStorage(action.name);
      return '';
    case 'proxmox.user.create':
    case 'proxmox.user.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertUser(action.config);
      return '';
    case 'proxmox.user.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteUser(action.userId);
      return '';
    case 'proxmox.token.create':
    case 'proxmox.token.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertToken(action.config);
      return '';
    case 'proxmox.token.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteToken(action.userId, action.tokenId);
      return '';
    case 'proxmox.acl.upsert':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertAcl(action.config);
      return '';
    case 'proxmox.acl.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteAcl(action.config);
      return '';
    case 'proxmox.role.create':
    case 'proxmox.role.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertRole(action.config);
      return '';
    case 'proxmox.role.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteRole(action.roleId);
      return '';
    case 'proxmox.group.create':
    case 'proxmox.group.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertGroup(action.config);
      return '';
    case 'proxmox.group.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteGroup(action.groupId);
      return '';
    case 'proxmox.realm.create':
    case 'proxmox.realm.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertRealm(action.config);
      return '';
    case 'proxmox.realm.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteRealm(action.realm);
      return '';
    case 'proxmox.tfa.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createTfa(action.config);
      return '';
    case 'proxmox.tfa.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateTfa(action.config);
      return '';
    case 'proxmox.tfa.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteTfa(action.userId, action.id);
      return '';
    case 'proxmox.cluster-options.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateClusterOptions(action.config);
      return '';
    case 'proxmox.pool.create':
    case 'proxmox.pool.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertPool(action.config);
      return '';
    case 'proxmox.pool.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deletePool(action.poolId);
      return '';
    case 'proxmox.backup-job.create':
    case 'proxmox.backup-job.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertBackupJob(action.config);
      return '';
    case 'proxmox.backup-job.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteBackupJob(action.id);
      return '';
    case 'proxmox.replication-job.create':
    case 'proxmox.replication-job.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertReplicationJob(action.config);
      return '';
    case 'proxmox.replication-job.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteReplicationJob(action.id);
      return '';
    case 'proxmox.datacenter-firewall-options.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateDatacenterFirewallOptions(action.config);
      return '';
    case 'proxmox.node-dns.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNodeDns(action.config);
      return '';
    case 'proxmox.node-hosts.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNodeHosts(action.config);
      return '';
    case 'proxmox.node-options.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNodeOptions(action.config);
      return '';
    case 'proxmox.node-time.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNodeTime(action.config);
      return '';
    case 'proxmox.node-service.action':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.runNodeServiceAction(action.config);
      return '';
    case 'proxmox.node-apt.action':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.runNodeAptAction(action.config);
      return '';
    case 'proxmox.node-certificate.request': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.requestNodeCertificate(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-firewall-options.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.updateNodeFirewallOptions(action.config);
      return '';
    case 'proxmox.node-firewall-rule.upsert':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertNodeFirewallRule(action.config);
      return '';
    case 'proxmox.node-firewall-rule.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteNodeFirewallRule(action.node, action.id);
      return '';
    case 'proxmox.node-certificate-custom.upsert':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertNodeCustomCertificate(action.config);
      return '';
    case 'proxmox.node-certificate-custom.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteNodeCustomCertificate(action.node);
      return '';
    case 'proxmox.node-certificate-acme.upsert':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertNodeAcmeCertificate(action.config);
      return '';
    case 'proxmox.node-certificate-acme.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteNodeAcmeCertificate(action.node);
      return '';
    case 'proxmox.sdn-zone.create':
    case 'proxmox.sdn-zone.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertSdnZone(action.config);
      return '';
    case 'proxmox.sdn-zone.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteSdnZone(action.zone);
      return '';
    case 'proxmox.sdn-vnet.create':
    case 'proxmox.sdn-vnet.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertSdnVnet(action.config);
      return '';
    case 'proxmox.sdn-vnet.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteSdnVnet(action.vnet);
      return '';
    case 'proxmox.sdn-subnet.create':
    case 'proxmox.sdn-subnet.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertSdnSubnet(action.config);
      return '';
    case 'proxmox.sdn-subnet.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteSdnSubnet(action.vnet, action.subnet);
      return '';
    case 'proxmox.sdn-ipam.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertSdnIpam(action.config);
      return '';
    case 'proxmox.sdn-ipam.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteSdnIpam(action.ipam);
      return '';
    case 'proxmox.datacenter-firewall-alias.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertDatacenterFirewallAlias(action.config);
      return '';
    case 'proxmox.datacenter-firewall-alias.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteDatacenterFirewallAlias(action.name);
      return '';
    case 'proxmox.datacenter-firewall-ipset.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertDatacenterFirewallIpset(action.config);
      return '';
    case 'proxmox.datacenter-firewall-ipset.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteDatacenterFirewallIpset(action.name);
      return '';
    case 'proxmox.datacenter-firewall-rule.upsert':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertDatacenterFirewallRule(action.config);
      return '';
    case 'proxmox.datacenter-firewall-rule.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteDatacenterFirewallRule(action.id);
      return '';
    case 'proxmox.vm.migrate':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.migrateVm(action.config, taskProgress);
      return '';
    case 'proxmox.ct.migrate':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.migrateCt(action.config, taskProgress);
      return '';
    case 'proxmox.vm.backup':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.backupVm(action.config, taskProgress);
      return '';
    case 'proxmox.ct.backup':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.backupCt(action.config, taskProgress);
      return '';
    case 'proxmox.vm.restore':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.restoreVm(action.config, taskProgress);
      return '';
    case 'proxmox.ct.restore':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.restoreCt(action.config, taskProgress);
      return '';
    case 'proxmox.vm.snapshot.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createVmSnapshot(action.config, taskProgress);
      return '';
    case 'proxmox.vm.snapshot.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteVmSnapshot(action.config, taskProgress);
      return '';
    case 'proxmox.ct.snapshot.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createCtSnapshot(action.config, taskProgress);
      return '';
    case 'proxmox.ct.snapshot.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteCtSnapshot(action.config, taskProgress);
      return '';
    case 'proxmox.vm.guest-agent.command': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.runVmGuestAgentCommand(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.storage-content.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteStorageContent(action.config, taskProgress);
      return '';
    case 'proxmox.vm.disk.move':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.moveVmDisk(action.config, taskProgress);
      return '';
    case 'proxmox.vm.disk.import':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.importVmDisk(action.config, taskProgress);
      return '';
    case 'proxmox.vm.disk.clone':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.cloneVmDisk(action.config, taskProgress);
      return '';
    case 'proxmox.storage-content.copy':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.copyStorageContent(action.config, taskProgress);
      return '';
    case 'proxmox.node-disk.initialize':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.initializeNodeDisk(action.config, taskProgress);
      return '';
    case 'proxmox.node-lvm.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createNodeLvm(action.config, taskProgress);
      return '';
    case 'proxmox.node-lvmthin.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createNodeLvmThin(action.config, taskProgress);
      return '';
    case 'proxmox.node-zfs.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.createNodeZfs(action.config, taskProgress);
      return '';
    case 'proxmox.ha-group.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertHaGroup(action.config);
      return '';
    case 'proxmox.ha-group.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteHaGroup(action.group);
      return '';
    case 'proxmox.ha-resource.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertHaResource(action.config);
      return '';
    case 'proxmox.ha-resource.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteHaResource(action.sid);
      return '';
    case 'proxmox.ha-rule.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.upsertHaRule(action.config);
      return '';
    case 'proxmox.ha-rule.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.deleteHaRule(action.rule);
      return '';
    case 'proxmox.ceph-flag.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.setCephFlag(action.config);
      return '';
    case 'proxmox.ceph-flag.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.clearCephFlag(action.flag);
      return '';
    case 'proxmox.ha-status.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readHaStatus(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.ceph.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readCeph(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-ceph.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readNodeCeph(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-ceph.action': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.runNodeCephAction(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-task.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readNodeTasks(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.cluster-task.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readClusterTasks(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-task.log.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readNodeTaskLog(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node-firewall.log.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.readNodeFirewallLog(action.config);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.datacenter.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.datacenterRequest('create', action.path, action.payload);
      return '';
    case 'proxmox.datacenter.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.datacenterRequest('read', action.path, action.payload);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.datacenter.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.datacenterRequest('update', action.path, action.payload);
      return '';
    case 'proxmox.datacenter.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.datacenterRequest('delete', action.path, action.payload);
      return '';
    case 'proxmox.node.create':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.nodeRequest(action.node, 'create', action.path, action.payload);
      return '';
    case 'proxmox.node.read': {
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      const result = await deps.proxmox.nodeRequest(action.node, 'read', action.path, action.payload);
      return JSON.stringify(result ?? {});
    }
    case 'proxmox.node.update':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.nodeRequest(action.node, 'update', action.path, action.payload);
      return '';
    case 'proxmox.node.delete':
      if (!deps.proxmox) {
        throw new Error('Proxmox provider not configured');
      }
      await deps.proxmox.nodeRequest(action.node, 'delete', action.path, action.payload);
      return '';
    case 'grafana.request': {
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      const result = await deps.grafana.grafanaRequest(action.method, action.path, {
        payload: action.payload,
        query: action.query,
        body: action.body,
        headers: action.headers,
        orgId: action.orgId
      });
      return JSON.stringify(result ?? {});
    }
    case 'grafana.folder.upsert':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.upsertFolder(action.config);
      return '';
    case 'grafana.folder.delete':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.deleteFolder(action.uid);
      return '';
    case 'grafana.dashboard.upsert':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.upsertDashboard(action.config);
      return '';
    case 'grafana.dashboard.delete':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.deleteDashboard(action.uid);
      return '';
    case 'grafana.create':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.grafanaRequest('create', action.path, { payload: action.payload });
      return '';
    case 'grafana.read': {
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      const result = await deps.grafana.grafanaRequest('read', action.path, { payload: action.payload });
      return JSON.stringify(result ?? {});
    }
    case 'grafana.update':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.grafanaRequest('update', action.path, { payload: action.payload });
      return '';
    case 'grafana.delete':
      if (!deps.grafana) {
        throw new Error('Grafana provider not configured');
      }
      await deps.grafana.grafanaRequest('delete', action.path, { payload: action.payload });
      return '';
    case 'docker.compose.redeploy':
      return deps.docker.redeployCompose(action.path);
    case 'validate.grafana': {
      if (!deps.grafana) {
        return 'Grafana not configured, validation skipped';
      }
      const validation = await deps.grafana.validate();
      if (!validation.ok) {
        throw new Error(validation.details);
      }
      return validation.details;
    }
    default:
      throw new Error(`Unsupported action ${(action as { kind: string }).kind}`);
  }
}

function createTaskProgressHandler(logger: Logger, actionKind: string): (progress: ProxmoxTaskProgress) => void {
  return (progress) => {
    const details = progress.details ? ` ${progress.details}` : '';
    logger.info(`[task] ${actionKind} ${progress.operation} ${progress.node} ${progress.status} ${progress.upid}${details}`);
  };
}

function compensationForAction(action: PlanAction): PlanAction | undefined {
  switch (action.kind) {
    case 'proxmox.start':
      return {
        kind: 'proxmox.stop',
        node: action.node,
        vmid: action.vmid,
        vmType: action.vmType,
        reason: `Rollback start of ${action.vmid}`
      };
    case 'proxmox.stop':
      return {
        kind: 'proxmox.start',
        node: action.node,
        vmid: action.vmid,
        vmType: action.vmType,
        reason: `Rollback stop of ${action.vmid}`
      };
    case 'proxmox.vm.create':
    case 'proxmox.vm.clone':
      return {
        kind: 'proxmox.vm.delete',
        node: action.node,
        vmid: action.vmid,
        reason: `Rollback VM creation ${action.vmid}`
      };
    case 'proxmox.ct.create':
      return {
        kind: 'proxmox.ct.delete',
        node: action.node,
        vmid: action.vmid,
        reason: `Rollback CT creation ${action.vmid}`
      };
    case 'proxmox.vm.attach-disk':
      return {
        kind: 'proxmox.vm.detach-disk',
        node: action.node,
        vmid: action.vmid,
        disk: `${action.disk.interface}${action.disk.index}`,
        reason: `Rollback disk attach ${action.disk.interface}${action.disk.index}`
      };
    case 'proxmox.network.create':
      return {
        kind: 'proxmox.network.delete',
        node: action.node,
        name: action.name,
        reason: `Rollback network creation ${action.name}`
      };
    case 'proxmox.storage.create':
      return {
        kind: 'proxmox.storage.delete',
        name: action.name,
        reason: `Rollback storage creation ${action.name}`
      };
    case 'proxmox.user.create':
      return {
        kind: 'proxmox.user.delete',
        userId: action.config.userId,
        reason: `Rollback user creation ${action.config.userId}`
      };
    case 'proxmox.token.create':
      return {
        kind: 'proxmox.token.delete',
        userId: action.config.userId,
        tokenId: action.config.tokenId,
        reason: `Rollback token creation ${action.config.userId}!${action.config.tokenId}`
      };
    case 'proxmox.role.create':
      return {
        kind: 'proxmox.role.delete',
        roleId: action.config.roleId,
        reason: `Rollback role creation ${action.config.roleId}`
      };
    case 'proxmox.group.create':
      return {
        kind: 'proxmox.group.delete',
        groupId: action.config.groupId,
        reason: `Rollback group creation ${action.config.groupId}`
      };
    case 'proxmox.realm.create':
      return {
        kind: 'proxmox.realm.delete',
        realm: action.config.realm,
        reason: `Rollback realm creation ${action.config.realm}`
      };
    case 'proxmox.tfa.create':
      if (!action.config.id) {
        return undefined;
      }
      return {
        kind: 'proxmox.tfa.delete',
        userId: action.config.userId,
        id: action.config.id,
        reason: `Rollback TFA creation ${action.config.userId}/${action.config.id}`
      };
    case 'proxmox.pool.create':
      return {
        kind: 'proxmox.pool.delete',
        poolId: action.config.poolId,
        reason: `Rollback pool creation ${action.config.poolId}`
      };
    case 'proxmox.backup-job.create':
      return {
        kind: 'proxmox.backup-job.delete',
        id: action.config.id,
        reason: `Rollback backup job creation ${action.config.id}`
      };
    case 'proxmox.replication-job.create':
      return {
        kind: 'proxmox.replication-job.delete',
        id: action.config.id,
        reason: `Rollback replication job creation ${action.config.id}`
      };
    case 'proxmox.sdn-zone.create':
      return {
        kind: 'proxmox.sdn-zone.delete',
        zone: action.config.zone,
        reason: `Rollback SDN zone creation ${action.config.zone}`
      };
    case 'proxmox.sdn-vnet.create':
      return {
        kind: 'proxmox.sdn-vnet.delete',
        vnet: action.config.vnet,
        reason: `Rollback SDN vnet creation ${action.config.vnet}`
      };
    case 'proxmox.sdn-subnet.create':
      return {
        kind: 'proxmox.sdn-subnet.delete',
        vnet: action.config.vnet,
        subnet: action.config.subnet,
        reason: `Rollback SDN subnet creation ${action.config.vnet}/${action.config.subnet}`
      };
    case 'proxmox.vm.snapshot.create':
      return {
        kind: 'proxmox.vm.snapshot.delete',
        config: action.config,
        reason: `Rollback VM snapshot creation ${action.config.node}/${action.config.vmid}/${action.config.name}`
      };
    case 'proxmox.ct.snapshot.create':
      return {
        kind: 'proxmox.ct.snapshot.delete',
        config: action.config,
        reason: `Rollback CT snapshot creation ${action.config.node}/${action.config.vmid}/${action.config.name}`
      };
    default:
      return undefined;
  }
}

async function rollbackExecutedActions(
  results: ActionResult[],
  deps: ExecutorDeps,
  logger: Logger
): Promise<ApplyResult['rollback']> {
  const rollbackActions = results
    .filter((item) => item.success)
    .map((item) => compensationForAction(item.action))
    .filter((item): item is PlanAction => Boolean(item))
    .reverse();

  if (rollbackActions.length === 0) {
    return {
      attempted: false,
      ok: true,
      results: [],
      message: 'No compensating rollback actions available for executed steps'
    };
  }

  const rollbackResults: ActionResult[] = [];
  let rollbackOk = true;

  for (const rollbackAction of rollbackActions) {
    const startedAt = new Date().toISOString();
    logger.warn(`↩ rollback ${rollbackAction.kind}: ${rollbackAction.reason}`);

    try {
      const output = await executeAction(rollbackAction, deps);
      const finishedAt = new Date().toISOString();
      rollbackResults.push({
        action: rollbackAction,
        success: true,
        startedAt,
        finishedAt,
        message: 'Rollback completed',
        output
      });
    } catch (error) {
      rollbackOk = false;
      const finishedAt = new Date().toISOString();
      const shortMsg = error instanceof Error ? error.message : String(error);
      const message = error instanceof Error && error.stack
        ? `${error.message}\n${error.stack}`.trim()
        : shortMsg;
      logger.error(`✗ rollback ${rollbackAction.kind}: ${shortMsg}`);
      rollbackResults.push({
        action: rollbackAction,
        success: false,
        startedAt,
        finishedAt,
        message
      });
    }
  }

  return {
    attempted: true,
    ok: rollbackOk,
    results: rollbackResults,
    message: rollbackOk
      ? 'Rollback completed successfully'
      : 'Rollback completed with errors; manual intervention may be required'
  };
}
