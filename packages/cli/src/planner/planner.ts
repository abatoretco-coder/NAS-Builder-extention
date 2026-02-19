import type {
  ConfigChange,
  DesiredSpec,
  DiskConfig,
  NetworkConfig,
  Plan,
  PlanAction,
  ProxmoxCt,
  ProxmoxVm,
  StorageConfig,
  UnifiedState,
  VmProvisionConfig,
  ContainerProvisionConfig
} from '@naas/shared';

export function buildPlan(current: UnifiedState, desired: DesiredSpec): Plan {
  const desiredPowerByVmid = new Map(desired.vms.map((item) => [item.vmid, item.desiredPower] as const));
  const currentNetworks = new Map(
    (current.compute.networks ?? []).map((network) => [`${network.node}:${network.name}`, network] as const)
  );
  const currentStorage = new Map((current.compute.storage ?? []).map((storage) => [storage.name, storage] as const));
  const storageCapacityHints = buildStorageCapacityHints(current.compute.storage ?? []);

  const iam = planIamActions(desired, storageCapacityHints);
  const networks = planNetworkActions(currentNetworks, desired);
  const storage = planStorageActions(currentStorage, desired);
  const vms = planVmActions(current, desired, desiredPowerByVmid);
  const cts = planCtActions(current, desired, desiredPowerByVmid);
  const explicitDeletes = planExplicitDeletes(current, desired);
  const appActions = planAppActions(desired);
  const validationActions = planValidationActions(desired);

  const actions: PlanAction[] = [
    ...iam.access,
    ...networks.infra,
    ...storage.infra,
    ...vms.provision,
    ...vms.update,
    ...vms.disk,
    ...cts.provision,
    ...cts.update,
    ...vms.power,
    ...cts.power,
    ...appActions,
    ...iam.delete,
    ...networks.delete,
    ...storage.delete,
    ...explicitDeletes,
    ...validationActions
  ];

  return {
    generatedAt: new Date().toISOString(),
    env: current.env,
    actions
  };
}

// ---------------------------------------------------------------------------
// Sub-planners
// ---------------------------------------------------------------------------

function planIamActions(
  desired: DesiredSpec,
  storageCapacityHints: Map<string, string>
): { access: PlanAction[]; delete: PlanAction[] } {
  const access: PlanAction[] = [];
  const deleteActions: PlanAction[] = [];

  for (const role of desired.proxmoxRoles ?? []) {
    if (role.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.role.delete', roleId: role.roleId, reason: `Ensure Proxmox role ${role.roleId} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.role.update', config: role, reason: `Ensure Proxmox role ${role.roleId} is present and up to date` });
  }

  for (const group of desired.proxmoxGroups ?? []) {
    if (group.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.group.delete', groupId: group.groupId, reason: `Ensure Proxmox group ${group.groupId} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.group.update', config: group, reason: `Ensure Proxmox group ${group.groupId} is present and up to date` });
  }

  for (const realm of desired.proxmoxRealms ?? []) {
    if (realm.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.realm.delete', realm: realm.realm, reason: `Ensure Proxmox realm ${realm.realm} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.realm.update', config: realm, reason: `Ensure Proxmox realm ${realm.realm} is present and up to date` });
  }

  for (const tfa of desired.proxmoxTfa ?? []) {
    if (tfa.ensure === 'absent') {
      if (!tfa.id) {
        continue;
      }
      deleteActions.push({ kind: 'proxmox.tfa.delete', userId: tfa.userId, id: tfa.id, reason: `Ensure TFA ${tfa.userId}/${tfa.id} is absent` });
      continue;
    }
    if (tfa.id) {
      access.push({ kind: 'proxmox.tfa.update', config: tfa, reason: `Update TFA ${tfa.userId}/${tfa.id}` });
      continue;
    }
    access.push({ kind: 'proxmox.tfa.create', config: tfa, reason: `Create TFA for ${tfa.userId}` });
  }

  if (desired.proxmoxClusterOptions?.options && Object.keys(desired.proxmoxClusterOptions.options).length > 0) {
    access.push({
      kind: 'proxmox.cluster-options.update',
      config: desired.proxmoxClusterOptions,
      reason: 'Ensure Proxmox cluster options are up to date'
    });
  }

  for (const pool of desired.proxmoxPools ?? []) {
    if (pool.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.pool.delete',
        poolId: pool.poolId,
        reason: `Ensure pool ${pool.poolId} is absent`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.pool.update',
      config: pool,
      reason: `Ensure pool ${pool.poolId} is present and up to date`
    });
  }

  for (const backupJob of desired.proxmoxBackupJobs ?? []) {
    if (backupJob.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.backup-job.delete',
        id: backupJob.id,
        reason: `Ensure backup job ${backupJob.id} is absent`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.backup-job.update',
      config: backupJob,
      reason: `Ensure backup job ${backupJob.id} is present and up to date`
    });
  }

  for (const replicationJob of desired.proxmoxReplicationJobs ?? []) {
    if (replicationJob.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.replication-job.delete',
        id: replicationJob.id,
        reason: `Ensure replication job ${replicationJob.id} is absent`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.replication-job.update',
      config: replicationJob,
      reason: `Ensure replication job ${replicationJob.id} is present and up to date`
    });
  }

  if (desired.proxmoxDatacenterFirewallOptions?.options && Object.keys(desired.proxmoxDatacenterFirewallOptions.options).length > 0) {
    access.push({
      kind: 'proxmox.datacenter-firewall-options.update',
      config: desired.proxmoxDatacenterFirewallOptions,
      reason: 'Ensure datacenter firewall options are up to date'
    });
  }

  for (const dns of desired.proxmoxNodeDns ?? []) {
    access.push({
      kind: 'proxmox.node-dns.update',
      config: dns,
      reason: `Ensure DNS config is up to date on node ${dns.node}`
    });
  }

  for (const hosts of desired.proxmoxNodeHosts ?? []) {
    access.push({
      kind: 'proxmox.node-hosts.update',
      config: hosts,
      reason: `Ensure hosts config is up to date on node ${hosts.node}`
    });
  }

  for (const nodeOptions of desired.proxmoxNodeOptions ?? []) {
    access.push({
      kind: 'proxmox.node-options.update',
      config: nodeOptions,
      reason: `Ensure node options are up to date on node ${nodeOptions.node}`
    });
  }

  for (const nodeTime of desired.proxmoxNodeTime ?? []) {
    access.push({
      kind: 'proxmox.node-time.update',
      config: nodeTime,
      reason: `Ensure node time config is up to date on node ${nodeTime.node}`
    });
  }

  for (const serviceAction of desired.proxmoxNodeServices ?? []) {
    access.push({
      kind: 'proxmox.node-service.action',
      config: serviceAction,
      reason: `Run service action ${serviceAction.service}/${serviceAction.action} on node ${serviceAction.node}`
    });
  }

  for (const aptAction of desired.proxmoxNodeApt ?? []) {
    access.push({
      kind: 'proxmox.node-apt.action',
      config: aptAction,
      reason: `Run apt action ${aptAction.action} on node ${aptAction.node}`
    });
  }

  for (const certificateRequest of desired.proxmoxNodeCertificates ?? []) {
    access.push({
      kind: 'proxmox.node-certificate.request',
      config: certificateRequest,
      reason: `Run certificate request ${certificateRequest.method.toUpperCase()} ${certificateRequest.path} on node ${certificateRequest.node}`
    });
  }

  for (const firewallOptions of desired.proxmoxNodeFirewallOptions ?? []) {
    access.push({
      kind: 'proxmox.node-firewall-options.update',
      config: firewallOptions,
      reason: `Ensure node firewall options are up to date on node ${firewallOptions.node}`
    });
  }

  for (const firewallRule of desired.proxmoxNodeFirewallRules ?? []) {
    if (firewallRule.ensure === 'absent') {
      if (!firewallRule.id) {
        continue;
      }
      deleteActions.push({
        kind: 'proxmox.node-firewall-rule.delete',
        node: firewallRule.node,
        id: firewallRule.id,
        reason: `Ensure node firewall rule ${firewallRule.id} is absent on ${firewallRule.node}`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.node-firewall-rule.upsert',
      config: firewallRule,
      reason: `Ensure node firewall rule is present and up to date on ${firewallRule.node}`
    });
  }

  for (const customCert of desired.proxmoxNodeCertificateCustom ?? []) {
    if (customCert.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.node-certificate-custom.delete',
        node: customCert.node,
        reason: `Ensure custom certificate is absent on node ${customCert.node}`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.node-certificate-custom.upsert',
      config: customCert,
      reason: `Ensure custom certificate is present on node ${customCert.node}`
    });
  }

  for (const acmeCert of desired.proxmoxNodeCertificateAcme ?? []) {
    if (acmeCert.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.node-certificate-acme.delete',
        node: acmeCert.node,
        reason: `Ensure ACME certificate is absent on node ${acmeCert.node}`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.node-certificate-acme.upsert',
      config: acmeCert,
      reason: `Ensure ACME certificate is present on node ${acmeCert.node}`
    });
  }

  for (const zone of desired.proxmoxSdnZones ?? []) {
    if (zone.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.sdn-zone.delete', zone: zone.zone, reason: `Ensure SDN zone ${zone.zone} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.sdn-zone.update', config: zone, reason: `Ensure SDN zone ${zone.zone} is present and up to date` });
  }

  for (const vnet of desired.proxmoxSdnVnets ?? []) {
    if (vnet.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.sdn-vnet.delete', vnet: vnet.vnet, reason: `Ensure SDN vnet ${vnet.vnet} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.sdn-vnet.update', config: vnet, reason: `Ensure SDN vnet ${vnet.vnet} is present and up to date` });
  }

  for (const subnet of desired.proxmoxSdnSubnets ?? []) {
    if (subnet.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.sdn-subnet.delete',
        vnet: subnet.vnet,
        subnet: subnet.subnet,
        reason: `Ensure SDN subnet ${subnet.subnet} on ${subnet.vnet} is absent`
      });
      continue;
    }
    access.push({
      kind: 'proxmox.sdn-subnet.update',
      config: subnet,
      reason: `Ensure SDN subnet ${subnet.subnet} on ${subnet.vnet} is present and up to date`
    });
  }

  for (const ipam of desired.proxmoxSdnIpams ?? []) {
    if (ipam.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.sdn-ipam.delete', ipam: ipam.ipam, reason: `Ensure SDN IPAM ${ipam.ipam} is absent` });
      continue;
    }

    access.push({ kind: 'proxmox.sdn-ipam.update', config: ipam, reason: `Ensure SDN IPAM ${ipam.ipam} is present and up to date` });
  }

  for (const alias of desired.proxmoxDatacenterFirewallAliases ?? []) {
    if (alias.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.datacenter-firewall-alias.delete', name: alias.name, reason: `Ensure firewall alias ${alias.name} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.datacenter-firewall-alias.update', config: alias, reason: `Ensure firewall alias ${alias.name} is present and up to date` });
  }

  for (const ipset of desired.proxmoxDatacenterFirewallIpsets ?? []) {
    if (ipset.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.datacenter-firewall-ipset.delete', name: ipset.name, reason: `Ensure firewall ipset ${ipset.name} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.datacenter-firewall-ipset.update', config: ipset, reason: `Ensure firewall ipset ${ipset.name} is present and up to date` });
  }

  for (const rule of desired.proxmoxDatacenterFirewallRules ?? []) {
    if (rule.ensure === 'absent') {
      if (!rule.id) {
        continue;
      }
      deleteActions.push({ kind: 'proxmox.datacenter-firewall-rule.delete', id: rule.id, reason: `Ensure firewall rule ${rule.id} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.datacenter-firewall-rule.upsert', config: rule, reason: `Ensure datacenter firewall rule is present and up to date` });
  }

  for (const migration of desired.proxmoxVmMigrations ?? []) {
    access.push({
      kind: 'proxmox.vm.migrate',
      config: migration,
      reason: `Migrate VM ${migration.vmid} from ${migration.node} to ${migration.target}`
    });
  }

  for (const migration of desired.proxmoxCtMigrations ?? []) {
    access.push({
      kind: 'proxmox.ct.migrate',
      config: migration,
      reason: `Migrate CT ${migration.vmid} from ${migration.node} to ${migration.target}`
    });
  }

  for (const backup of desired.proxmoxVmBackups ?? []) {
    access.push({
      kind: 'proxmox.vm.backup',
      config: backup,
      reason: `Run VM backup for ${backup.node}/${backup.vmid}`
    });
  }

  for (const backup of desired.proxmoxCtBackups ?? []) {
    access.push({
      kind: 'proxmox.ct.backup',
      config: backup,
      reason: `Run CT backup for ${backup.node}/${backup.vmid}`
    });
  }

  for (const restore of desired.proxmoxVmRestores ?? []) {
    access.push({
      kind: 'proxmox.vm.restore',
      config: restore,
      reason: `Run VM restore for ${restore.node}/${restore.vmid}`
    });
  }

  for (const restore of desired.proxmoxCtRestores ?? []) {
    access.push({
      kind: 'proxmox.ct.restore',
      config: restore,
      reason: `Run CT restore for ${restore.node}/${restore.vmid}`
    });
  }

  for (const snapshot of desired.proxmoxVmSnapshots ?? []) {
    if (snapshot.ensure === 'absent') {
      access.push({
        kind: 'proxmox.vm.snapshot.delete',
        config: snapshot,
        reason: `Ensure VM snapshot ${snapshot.name} is absent on ${snapshot.node}/${snapshot.vmid}`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.vm.snapshot.create',
      config: snapshot,
      reason: `Ensure VM snapshot ${snapshot.name} is present on ${snapshot.node}/${snapshot.vmid}`
    });
  }

  for (const snapshot of desired.proxmoxCtSnapshots ?? []) {
    if (snapshot.ensure === 'absent') {
      access.push({
        kind: 'proxmox.ct.snapshot.delete',
        config: snapshot,
        reason: `Ensure CT snapshot ${snapshot.name} is absent on ${snapshot.node}/${snapshot.vmid}`
      });
      continue;
    }

    access.push({
      kind: 'proxmox.ct.snapshot.create',
      config: snapshot,
      reason: `Ensure CT snapshot ${snapshot.name} is present on ${snapshot.node}/${snapshot.vmid}`
    });
  }

  for (const agentCommand of desired.proxmoxVmGuestAgent ?? []) {
    access.push({
      kind: 'proxmox.vm.guest-agent.command',
      config: agentCommand,
      reason: `Run guest-agent command ${agentCommand.command} on ${agentCommand.node}/${agentCommand.vmid}`
    });
  }

  for (const storageContent of desired.proxmoxStorageContent ?? []) {
    deleteActions.push({
      kind: 'proxmox.storage-content.delete',
      config: storageContent,
      reason: `Ensure storage content ${storageContent.volume} is absent on ${storageContent.node}/${storageContent.storage}`
    });
  }

  for (const storageContentCopy of desired.proxmoxStorageContentCopy ?? []) {
    const capacityHint = capacityHintSuffix(storageContentCopy.targetStorage, storageCapacityHints);
    access.push({
      kind: 'proxmox.storage-content.copy',
      config: storageContentCopy,
      reason: `Copy storage content ${storageContentCopy.volume} from ${storageContentCopy.storage} to ${storageContentCopy.targetStorage} on ${storageContentCopy.node}${capacityHint}`
    });
  }

  for (const move of desired.proxmoxVmDiskMoves ?? []) {
    const capacityHint = capacityHintSuffix(move.targetStorage, storageCapacityHints);
    access.push({
      kind: 'proxmox.vm.disk.move',
      config: move,
      reason: `Move VM disk ${move.disk} on ${move.node}/${move.vmid} to storage ${move.targetStorage}${capacityHint}`
    });
  }

  for (const diskImport of desired.proxmoxVmDiskImports ?? []) {
    const capacityHint = capacityHintSuffix(diskImport.storage, storageCapacityHints);
    access.push({
      kind: 'proxmox.vm.disk.import',
      config: diskImport,
      reason: `Import VM disk from ${diskImport.source} on ${diskImport.node}/${diskImport.vmid} into ${diskImport.storage}${capacityHint}`
    });
  }

  for (const clone of desired.proxmoxVmDiskClones ?? []) {
    const capacityHint = capacityHintSuffix(clone.targetStorage, storageCapacityHints);
    access.push({
      kind: 'proxmox.vm.disk.clone',
      config: clone,
      reason: `Clone VM disk ${clone.disk} from ${clone.node}/${clone.vmid} to ${clone.targetVmid} on ${clone.targetStorage}${capacityHint}`
    });
  }

  for (const request of desired.proxmoxNodeDiskInitialize ?? []) {
    access.push({
      kind: 'proxmox.node-disk.initialize',
      config: request,
      reason: `Initialize GPT on disk ${request.disk} for node ${request.node}`
    });
  }

  for (const createLvm of desired.proxmoxNodeLvmCreate ?? []) {
    access.push({
      kind: 'proxmox.node-lvm.create',
      config: createLvm,
      reason: `Create LVM volume group ${createLvm.name} on ${createLvm.node}`
    });
  }

  for (const createLvmThin of desired.proxmoxNodeLvmThinCreate ?? []) {
    access.push({
      kind: 'proxmox.node-lvmthin.create',
      config: createLvmThin,
      reason: `Create LVM-thin pool ${createLvmThin.name} in VG ${createLvmThin.volumeGroup} on ${createLvmThin.node}`
    });
  }

  for (const createZfs of desired.proxmoxNodeZfsCreate ?? []) {
    access.push({
      kind: 'proxmox.node-zfs.create',
      config: createZfs,
      reason: `Create ZFS pool ${createZfs.name} on ${createZfs.node}`
    });
  }

  for (const group of desired.proxmoxHaGroups ?? []) {
    if (group.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.ha-group.delete',
        group: group.group,
        reason: `Ensure HA group ${group.group} is absent`
      });
      continue;
    }
    access.push({
      kind: 'proxmox.ha-group.update',
      config: group,
      reason: `Ensure HA group ${group.group} is present and up to date`
    });
  }

  for (const resource of desired.proxmoxHaResources ?? []) {
    if (resource.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.ha-resource.delete',
        sid: resource.sid,
        reason: `Ensure HA resource ${resource.sid} is absent`
      });
      continue;
    }
    access.push({
      kind: 'proxmox.ha-resource.update',
      config: resource,
      reason: `Ensure HA resource ${resource.sid} is present and up to date`
    });
  }

  for (const rule of desired.proxmoxHaRules ?? []) {
    if (rule.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.ha-rule.delete',
        rule: rule.rule,
        reason: `Ensure HA rule ${rule.rule} is absent`
      });
      continue;
    }
    access.push({
      kind: 'proxmox.ha-rule.update',
      config: rule,
      reason: `Ensure HA rule ${rule.rule} is present and up to date`
    });
  }

  for (const flag of desired.proxmoxCephFlags ?? []) {
    if (flag.ensure === 'absent') {
      deleteActions.push({
        kind: 'proxmox.ceph-flag.delete',
        flag: flag.flag,
        reason: `Ensure Ceph flag ${flag.flag} is absent`
      });
      continue;
    }
    access.push({
      kind: 'proxmox.ceph-flag.update',
      config: flag,
      reason: `Ensure Ceph flag ${flag.flag} is present`
    });
  }

  for (const query of desired.proxmoxHaStatus ?? []) {
    access.push({
      kind: 'proxmox.ha-status.read',
      config: query,
      reason: 'Read HA status'
    });
  }

  for (const query of desired.proxmoxCephRead ?? []) {
    access.push({
      kind: 'proxmox.ceph.read',
      config: query,
      reason: `Read Ceph ${query.section}`
    });
  }

  for (const query of desired.proxmoxNodeCephRead ?? []) {
    const section = query.section ?? 'overview';
    access.push({
      kind: 'proxmox.node-ceph.read',
      config: query,
      reason: `Read node Ceph ${section} on ${query.node}`
    });
  }

  for (const action of desired.proxmoxNodeCephActions ?? []) {
    const section = action.section ?? 'overview';
    access.push({
      kind: 'proxmox.node-ceph.action',
      config: action,
      reason: `Run node Ceph ${action.method.toUpperCase()} ${section} on ${action.node}`
    });
  }

  for (const query of desired.proxmoxNodeTasks ?? []) {
    access.push({
      kind: 'proxmox.node-task.read',
      config: query,
      reason: query.upid
        ? `Read node task status ${query.upid} on ${query.node}`
        : `List node tasks on ${query.node}`
    });
  }

  for (const query of desired.proxmoxClusterTasks ?? []) {
    access.push({
      kind: 'proxmox.cluster-task.read',
      config: query,
      reason: 'List cluster tasks'
    });
  }

  for (const query of desired.proxmoxNodeTaskLogs ?? []) {
    access.push({
      kind: 'proxmox.node-task.log.read',
      config: query,
      reason: `Read node task log ${query.upid} on ${query.node}`
    });
  }

  for (const query of desired.proxmoxNodeFirewallLogs ?? []) {
    access.push({
      kind: 'proxmox.node-firewall.log.read',
      config: query,
      reason: `Read node firewall log on ${query.node}`
    });
  }

  for (const user of desired.proxmoxUsers ?? []) {
    if (user.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.user.delete', userId: user.userId, reason: `Ensure Proxmox user ${user.userId} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.user.update', config: user, reason: `Ensure Proxmox user ${user.userId} is present and up to date` });
  }

  for (const token of desired.proxmoxTokens ?? []) {
    if (token.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.token.delete', userId: token.userId, tokenId: token.tokenId, reason: `Ensure Proxmox token ${token.userId}!${token.tokenId} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.token.update', config: token, reason: `Ensure Proxmox token ${token.userId}!${token.tokenId} is present and up to date` });
  }

  for (const acl of desired.proxmoxAcls ?? []) {
    if (acl.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.acl.delete', config: acl, reason: `Ensure Proxmox ACL ${acl.path}:${acl.roleId} is absent` });
      continue;
    }
    access.push({ kind: 'proxmox.acl.upsert', config: acl, reason: `Ensure Proxmox ACL ${acl.path}:${acl.roleId} is present` });
  }

  for (const operation of desired.proxmoxDatacenterCrud ?? []) {
    const reason = operation.reason ?? `${operation.method.toUpperCase()} ${operation.path}`;
    const base = { path: operation.path, payload: operation.payload, reason };
    if (operation.method === 'create') { access.push({ kind: 'proxmox.datacenter.create', ...base }); continue; }
    if (operation.method === 'read')   { access.push({ kind: 'proxmox.datacenter.read',   ...base }); continue; }
    if (operation.method === 'update') { access.push({ kind: 'proxmox.datacenter.update', ...base }); continue; }
    access.push({ kind: 'proxmox.datacenter.delete', ...base });
  }

  for (const operation of desired.proxmoxNodeCrud ?? []) {
    const reason = operation.reason ?? `${operation.method.toUpperCase()} ${operation.node}:${operation.path}`;
    const base = { node: operation.node, path: operation.path, payload: operation.payload, reason };
    if (operation.method === 'create') { access.push({ kind: 'proxmox.node.create', ...base }); continue; }
    if (operation.method === 'read')   { access.push({ kind: 'proxmox.node.read',   ...base }); continue; }
    if (operation.method === 'update') { access.push({ kind: 'proxmox.node.update', ...base }); continue; }
    access.push({ kind: 'proxmox.node.delete', ...base });
  }

  return { access, delete: deleteActions };
}

function planNetworkActions(
  currentNetworks: Map<string, { node: string; name: string; type: string; config: Record<string, string | number | boolean | undefined> }>,
  desired: DesiredSpec
): { infra: PlanAction[]; delete: PlanAction[] } {
  const infra: PlanAction[] = [];
  const deleteActions: PlanAction[] = [];

  for (const network of desired.networks ?? []) {
    if (network.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.network.delete', node: network.node, name: network.name, reason: `Ensure network ${network.name} is absent on ${network.node}` });
      continue;
    }

    const existing = currentNetworks.get(`${network.node}:${network.name}`);
    if (!existing) {
      infra.push({ kind: 'proxmox.network.create', node: network.node, name: network.name, config: network, reason: `Ensure network ${network.name} is present on ${network.node}` });
      continue;
    }

    if (needsNetworkUpdate(existing.config, network)) {
      infra.push({ kind: 'proxmox.network.update', node: network.node, name: network.name, config: network, reason: `Update network ${network.name} on ${network.node}` });
    }
  }

  return { infra, delete: deleteActions };
}

function planStorageActions(
  currentStorage: Map<string, { name: string; type: string; config: Record<string, string | number | boolean | undefined> }>,
  desired: DesiredSpec
): { infra: PlanAction[]; delete: PlanAction[] } {
  const infra: PlanAction[] = [];
  const deleteActions: PlanAction[] = [];

  for (const storage of desired.storage ?? []) {
    if (storage.ensure === 'absent') {
      deleteActions.push({ kind: 'proxmox.storage.delete', name: storage.name, reason: `Ensure storage ${storage.name} is absent` });
      continue;
    }

    const existing = currentStorage.get(storage.name);
    if (!existing) {
      infra.push({ kind: 'proxmox.storage.create', name: storage.name, config: storage, reason: `Ensure storage ${storage.name} is present` });
      continue;
    }

    if (needsStorageUpdate(existing.config, storage)) {
      infra.push({ kind: 'proxmox.storage.update', name: storage.name, config: storage, reason: `Update storage ${storage.name}` });
    }
  }

  return { infra, delete: deleteActions };
}

function planVmActions(
  current: UnifiedState,
  desired: DesiredSpec,
  desiredPowerByVmid: Map<number, string | undefined>
): { provision: PlanAction[]; update: PlanAction[]; disk: PlanAction[]; power: PlanAction[] } {
  const provision: PlanAction[] = [];
  const update: PlanAction[] = [];
  const disk: PlanAction[] = [];
  const power: PlanAction[] = [];

  for (const vmProvision of desired.vmProvision ?? []) {
    const existingVm = current.compute.vms.find((item) => item.vmid === vmProvision.vmid);
    if (!existingVm) {
      if (vmProvision.clone?.source) {
        provision.push({ kind: 'proxmox.vm.clone', node: vmProvision.node, vmid: vmProvision.vmid, sourceVmid: vmProvision.clone.source, config: vmProvision, reason: `Clone VM ${vmProvision.name} from source ${vmProvision.clone.source}` });
      } else {
        provision.push({ kind: 'proxmox.vm.create', node: vmProvision.node, vmid: vmProvision.vmid, config: vmProvision, reason: `Create VM ${vmProvision.name}` });
      }
      continue;
    }

    const vmChanges = buildVmConfigChanges(existingVm, vmProvision);
    if (vmChanges.length > 0) {
      update.push({ kind: 'proxmox.vm.update', node: existingVm.node, vmid: existingVm.vmid, changes: vmChanges, reason: `Update VM configuration for ${existingVm.name}` });

      const needsReboot = vmChanges.some((change) => change.requiresReboot);
      const desiredPower = desiredPowerByVmid.get(existingVm.vmid);
      if (needsReboot && existingVm.status === 'running' && desiredPower !== 'stopped') {
        power.push({ kind: 'proxmox.reboot', node: existingVm.node, vmid: existingVm.vmid, vmType: 'qemu', reason: `Reboot ${existingVm.name} to apply configuration changes` });
      }
    }

    disk.push(...buildVmDiskActions(existingVm, vmProvision));
  }

  for (const vmDesired of desired.vms) {
    const vm = current.compute.vms.find((item) => item.vmid === vmDesired.vmid);
    const ct = current.compute.cts.find((item) => item.vmid === vmDesired.vmid);
    const target = vm ?? ct;
    if (!target) continue;
    const vmType = vm ? 'qemu' : 'lxc';

    if (vmDesired.desiredPower === 'running' && target.status !== 'running') {
      power.push({ kind: 'proxmox.start', node: target.node, vmid: vmDesired.vmid, vmType, reason: `Ensure ${target.name} is running` });
    }

    if (vmDesired.desiredPower === 'stopped' && target.status !== 'stopped') {
      if ((vmDesired.risky || vmDesired.snapshotBeforeRisky) && vmType === 'qemu') {
        power.push({ kind: 'proxmox.snapshot', node: target.node, vmid: vmDesired.vmid, name: `naas-pre-stop-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`, reason: `Snapshot before risky stop of ${target.name}` });
      }
      power.push({ kind: 'proxmox.stop', node: target.node, vmid: vmDesired.vmid, vmType, reason: `Ensure ${target.name} is stopped` });
    }
  }

  return { provision, update, disk, power };
}

function planCtActions(
  current: UnifiedState,
  desired: DesiredSpec,
  desiredPowerByVmid: Map<number, string | undefined>
): { provision: PlanAction[]; update: PlanAction[]; power: PlanAction[] } {
  const provision: PlanAction[] = [];
  const update: PlanAction[] = [];
  const power: PlanAction[] = [];

  for (const ctProvision of desired.containerProvision ?? []) {
    const existingCt = current.compute.cts.find((item) => item.vmid === ctProvision.vmid);
    if (!existingCt) {
      provision.push({ kind: 'proxmox.ct.create', node: ctProvision.node, vmid: ctProvision.vmid, config: ctProvision, reason: `Create container ${ctProvision.name}` });
      continue;
    }

    const ctChanges = buildCtConfigChanges(existingCt, ctProvision);
    if (ctChanges.length > 0) {
      update.push({ kind: 'proxmox.ct.update', node: existingCt.node, vmid: existingCt.vmid, changes: ctChanges, reason: `Update container configuration for ${existingCt.name}` });

      const needsReboot = ctChanges.some((change) => change.requiresReboot);
      const desiredPower = desiredPowerByVmid.get(existingCt.vmid);
      if (needsReboot && existingCt.status === 'running' && desiredPower !== 'stopped') {
        power.push({ kind: 'proxmox.reboot', node: existingCt.node, vmid: existingCt.vmid, vmType: 'lxc', reason: `Reboot ${existingCt.name} to apply configuration changes` });
      }
    }
  }

  return { provision, update, power };
}

function planExplicitDeletes(current: UnifiedState, desired: DesiredSpec): PlanAction[] {
  const deleteActions: PlanAction[] = [];

  for (const vmid of desired.deleteVms ?? []) {
    const existingVm = current.compute.vms.find((item) => item.vmid === vmid);
    if (existingVm) {
      deleteActions.push({ kind: 'proxmox.vm.delete', node: existingVm.node, vmid, reason: `Delete VM ${existingVm.name}` });
    }
  }

  for (const vmid of desired.deleteContainers ?? []) {
    const existingCt = current.compute.cts.find((item) => item.vmid === vmid);
    if (existingCt) {
      deleteActions.push({ kind: 'proxmox.ct.delete', node: existingCt.node, vmid, reason: `Delete container ${existingCt.name}` });
    }
  }

  return deleteActions;
}

function planAppActions(desired: DesiredSpec): PlanAction[] {
  const actions: PlanAction[] = [];

  for (const folder of desired.grafanaFolders ?? []) {
    if (folder.ensure === 'absent') {
      if (!folder.uid) {
        continue;
      }
      actions.push({
        kind: 'grafana.folder.delete',
        uid: folder.uid,
        reason: `Ensure Grafana folder ${folder.uid} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.folder.upsert',
      config: folder,
      reason: `Ensure Grafana folder ${folder.title} is present and up to date`
    });
  }

  for (const dashboard of desired.grafanaDashboards ?? []) {
    if (dashboard.ensure === 'absent') {
      actions.push({
        kind: 'grafana.dashboard.delete',
        uid: dashboard.uid,
        reason: `Ensure Grafana dashboard ${dashboard.uid} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.dashboard.upsert',
      config: dashboard,
      reason: `Ensure Grafana dashboard ${dashboard.uid} is present and up to date`
    });
  }

  for (const alertRuleGroup of desired.grafanaAlertRuleGroups ?? []) {
    if (alertRuleGroup.ensure === 'absent') {
      actions.push({
        kind: 'grafana.alert-rule-group.delete',
        folderUid: alertRuleGroup.folderUid,
        group: alertRuleGroup.group,
        reason: `Ensure Grafana alert rule group ${alertRuleGroup.folderUid}/${alertRuleGroup.group} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.alert-rule-group.upsert',
      config: alertRuleGroup,
      reason: `Ensure Grafana alert rule group ${alertRuleGroup.folderUid}/${alertRuleGroup.group} is present`
    });
  }

  for (const contactPoint of desired.grafanaContactPoints ?? []) {
    if (contactPoint.ensure === 'absent') {
      if (!contactPoint.uid) {
        continue;
      }
      actions.push({
        kind: 'grafana.contact-point.delete',
        uid: contactPoint.uid,
        reason: `Ensure Grafana contact point ${contactPoint.uid} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.contact-point.upsert',
      config: contactPoint,
      reason: `Ensure Grafana contact point ${contactPoint.name} is present`
    });
  }

  for (const policy of desired.grafanaNotificationPolicies ?? []) {
    actions.push({
      kind: 'grafana.notification-policy.replace',
      config: policy,
      reason: 'Ensure Grafana notification policy tree is up to date'
    });
  }

  for (const datasource of desired.grafanaDatasources ?? []) {
    if (datasource.ensure === 'absent') {
      if (!datasource.uid) {
        continue;
      }
      actions.push({
        kind: 'grafana.datasource.delete',
        uid: datasource.uid,
        reason: `Ensure Grafana datasource ${datasource.uid} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.datasource.upsert',
      config: datasource,
      reason: `Ensure Grafana datasource ${datasource.name} is present`
    });
  }

  for (const team of desired.grafanaTeams ?? []) {
    if (team.ensure === 'absent') {
      if (!team.id) {
        continue;
      }
      actions.push({
        kind: 'grafana.team.delete',
        id: team.id,
        reason: `Ensure Grafana team ${team.id} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.team.upsert',
      config: team,
      reason: `Ensure Grafana team ${team.name} is present`
    });
  }

  for (const membership of desired.grafanaTeamMemberships ?? []) {
    actions.push({
      kind: 'grafana.team-membership.sync',
      config: membership,
      reason: `Ensure Grafana team membership for team ${membership.teamId} is synchronized`
    });
  }

  for (const serviceAccount of desired.grafanaServiceAccounts ?? []) {
    if (serviceAccount.ensure === 'absent') {
      if (!serviceAccount.id) {
        continue;
      }
      actions.push({
        kind: 'grafana.service-account.delete',
        id: serviceAccount.id,
        reason: `Ensure Grafana service account ${serviceAccount.id} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.service-account.upsert',
      config: serviceAccount,
      reason: `Ensure Grafana service account ${serviceAccount.name} is present`
    });
  }

  for (const token of desired.grafanaServiceAccountTokens ?? []) {
    if (token.ensure === 'absent') {
      if (!token.tokenId) {
        continue;
      }
      actions.push({
        kind: 'grafana.service-account-token.delete',
        serviceAccountId: token.serviceAccountId,
        tokenId: token.tokenId,
        reason: `Ensure Grafana service account token ${token.serviceAccountId}/${token.tokenId} is absent`
      });
      continue;
    }

    actions.push({
      kind: 'grafana.service-account-token.create',
      config: token,
      reason: `Ensure Grafana service account token ${token.serviceAccountId}/${token.name} exists`
    });
  }

  for (const operation of desired.grafanaCrud ?? []) {
    const isLegacyCrudMethod =
      operation.method === 'create' ||
      operation.method === 'read' ||
      operation.method === 'update' ||
      operation.method === 'delete';

    const usesAdvancedRequestOptions =
      !isLegacyCrudMethod ||
      operation.query !== undefined ||
      operation.body !== undefined ||
      operation.headers !== undefined ||
      operation.orgId !== undefined;

    if (usesAdvancedRequestOptions) {
      actions.push({
        kind: 'grafana.request',
        method: operation.method,
        path: operation.path,
        payload: operation.payload,
        query: operation.query,
        body: operation.body,
        headers: operation.headers,
        orgId: operation.orgId,
        reason: operation.reason ?? `Run Grafana ${operation.method.toUpperCase()} ${operation.path}`
      });
      continue;
    }

    const legacyMethod = operation.method as 'create' | 'read' | 'update' | 'delete';
    actions.push({
      kind: `grafana.${legacyMethod}`,
      path: operation.path,
      payload: operation.payload,
      reason: operation.reason ?? `Run Grafana ${operation.method.toUpperCase()} ${operation.path}`
    });
  }

  for (const composeProject of desired.composeProjects) {
    if (composeProject.ensure === 'running') {
      actions.push({ kind: 'docker.compose.redeploy', path: composeProject.path, reason: `Ensure compose project at ${composeProject.path} is running` });
    }
  }
  return actions;
}

function planValidationActions(desired: DesiredSpec): PlanAction[] {
  if (!desired.validation?.enabled) {
    return [];
  }
  return [{ kind: 'validate.grafana', reason: 'Post-apply observability validation' }];
}

// ---------------------------------------------------------------------------
// Config change builders
// ---------------------------------------------------------------------------

function buildCommonConfigChanges(
  existing: { cpuCores?: number; memoryMb?: number; tags: string[]; bridges: string[] },
  desired: { cpu?: { cores?: number }; memory?: { size?: number }; tags?: string[]; networks: Array<{ index: number; bridge: string }>; onboot?: boolean; protection?: boolean; description?: string }
): ConfigChange[] {
  const changes: ConfigChange[] = [];

  if (desired.cpu?.cores !== undefined && typeof existing.cpuCores === 'number' && existing.cpuCores !== desired.cpu.cores) {
    changes.push({ path: 'cpu.cores', oldValue: existing.cpuCores, newValue: desired.cpu.cores, requiresReboot: false });
  }

  if (desired.memory?.size !== undefined && typeof existing.memoryMb === 'number' && existing.memoryMb !== desired.memory.size) {
    changes.push({ path: 'memory.size', oldValue: existing.memoryMb, newValue: desired.memory.size, requiresReboot: false });
  }

  const desiredTags = normalizeTags(desired.tags ?? []);
  const currentTags = normalizeTags(existing.tags);
  if (!sameStringArray(desiredTags, currentTags)) {
    changes.push({ path: 'tags', oldValue: existing.tags, newValue: desired.tags ?? [], requiresReboot: false });
  }

  for (const nic of desired.networks) {
    const currentBridge = existing.bridges[nic.index];
    if (currentBridge !== nic.bridge) {
      changes.push({ path: `network.net${nic.index}`, oldValue: currentBridge, newValue: nic, requiresReboot: false });
    }
  }

  if (desired.onboot !== undefined) {
    changes.push({ path: 'onboot', oldValue: undefined, newValue: desired.onboot, requiresReboot: false });
  }
  if (desired.protection !== undefined) {
    changes.push({ path: 'protection', oldValue: undefined, newValue: desired.protection, requiresReboot: false });
  }
  if (desired.description !== undefined) {
    changes.push({ path: 'description', oldValue: undefined, newValue: desired.description, requiresReboot: false });
  }

  return changes;
}

function buildVmConfigChanges(existingVm: ProxmoxVm, desiredVm: VmProvisionConfig): ConfigChange[] {
  const changes = buildCommonConfigChanges(
    { cpuCores: existingVm.cpuCores, memoryMb: existingVm.memoryMb, tags: existingVm.tags, bridges: existingVm.bridges },
    { cpu: { cores: desiredVm.cpu.cores }, memory: { size: desiredVm.memory.size }, tags: desiredVm.tags, networks: desiredVm.networks, onboot: desiredVm.onboot, protection: desiredVm.protection, description: desiredVm.description }
  );

  if (desiredVm.cloudInit?.user !== undefined) {
    changes.push({ path: 'cloudInit.user', oldValue: undefined, newValue: desiredVm.cloudInit.user, requiresReboot: false });
  }
  if (desiredVm.cloudInit?.password !== undefined) {
    changes.push({ path: 'cloudInit.password', oldValue: undefined, newValue: desiredVm.cloudInit.password, requiresReboot: false });
  }
  if (desiredVm.cloudInit?.sshKeys !== undefined) {
    changes.push({ path: 'cloudInit.sshKeys', oldValue: undefined, newValue: desiredVm.cloudInit.sshKeys, requiresReboot: false });
  }
  if (desiredVm.cloudInit?.nameserver !== undefined) {
    changes.push({ path: 'cloudInit.nameserver', oldValue: undefined, newValue: desiredVm.cloudInit.nameserver, requiresReboot: false });
  }
  if (desiredVm.cloudInit?.searchdomain !== undefined) {
    changes.push({ path: 'cloudInit.searchdomain', oldValue: undefined, newValue: desiredVm.cloudInit.searchdomain, requiresReboot: false });
  }

  if (desiredVm.cpu.sockets !== undefined) {
    changes.push({ path: 'cpu.sockets', oldValue: undefined, newValue: desiredVm.cpu.sockets, requiresReboot: true });
  }
  if (desiredVm.cpu.type !== undefined) {
    changes.push({ path: 'cpu.type', oldValue: undefined, newValue: desiredVm.cpu.type, requiresReboot: true });
  }
  if (desiredVm.boot?.bios !== undefined) {
    changes.push({ path: 'boot.bios', oldValue: undefined, newValue: desiredVm.boot.bios, requiresReboot: true });
  }
  if (desiredVm.boot?.order?.length) {
    changes.push({ path: 'boot.order', oldValue: undefined, newValue: desiredVm.boot.order, requiresReboot: true });
  }

  return changes;
}

function buildCtConfigChanges(existingCt: ProxmoxCt, desiredCt: ContainerProvisionConfig): ConfigChange[] {
  return buildCommonConfigChanges(
    { cpuCores: existingCt.cpuCores, memoryMb: existingCt.memoryMb, tags: existingCt.tags, bridges: existingCt.bridges },
    { cpu: { cores: desiredCt.cpu?.cores }, memory: { size: desiredCt.memory?.size }, tags: desiredCt.tags, networks: desiredCt.networks, onboot: desiredCt.onboot, protection: desiredCt.protection, description: desiredCt.description }
  );
}

// ---------------------------------------------------------------------------
// Disk helpers
// ---------------------------------------------------------------------------

function buildVmDiskActions(existingVm: ProxmoxVm, desiredVm: VmProvisionConfig): PlanAction[] {
  const actions: PlanAction[] = [];
  const existingDisks = parseExistingDisks(existingVm.disks);

  for (const desiredDisk of desiredVm.disks) {
    const diskKey = `${desiredDisk.interface}${desiredDisk.index}`;
    const existing = existingDisks.get(diskKey);

    if (!existing) {
      actions.push({ kind: 'proxmox.vm.attach-disk', node: existingVm.node, vmid: existingVm.vmid, disk: desiredDisk, reason: `Attach missing disk ${diskKey} on ${existingVm.name}` });
      continue;
    }

    const desiredSizeBytes = parseSizeToBytes(desiredDisk.size);
    if (desiredSizeBytes === undefined || existing.sizeBytes === undefined) {
      continue;
    }

    if (desiredSizeBytes > existing.sizeBytes) {
      actions.push({ kind: 'proxmox.vm.resize-disk', node: existingVm.node, vmid: existingVm.vmid, disk: diskKey, newSize: desiredDisk.size, reason: `Resize disk ${diskKey} on ${existingVm.name}` });
    }
  }

  return actions;
}

function parseExistingDisks(disks: string[]): Map<string, { raw: string; sizeBytes?: number }> {
  const result = new Map<string, { raw: string; sizeBytes?: number }>();

  for (const diskEntry of disks) {
    const separatorIndex = diskEntry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = diskEntry.slice(0, separatorIndex);
    const value = diskEntry.slice(separatorIndex + 1);
    result.set(key, {
      raw: value,
      sizeBytes: extractDiskSizeBytes(value)
    });
  }

  return result;
}

function extractDiskSizeBytes(value: string): number | undefined {
  const explicitSizeMatch = value.match(/(?:^|,)size=(\d+(?:\.\d+)?)([KMGT])/i);
  if (explicitSizeMatch) {
    const quantity = explicitSizeMatch[1];
    const unit = explicitSizeMatch[2];
    if (quantity && unit) {
      return parseSizeToBytes(`${quantity}${unit.toUpperCase()}`);
    }
  }

  const trailingSizeMatch = value.match(/:(\d+(?:\.\d+)?)([KMGT])(?:$|,)/i);
  if (trailingSizeMatch) {
    const quantity = trailingSizeMatch[1];
    const unit = trailingSizeMatch[2];
    if (quantity && unit) {
      return parseSizeToBytes(`${quantity}${unit.toUpperCase()}`);
    }
  }

  return undefined;
}

function parseSizeToBytes(size: string): number | undefined {
  const match = size.trim().match(/^(\d+(?:\.\d+)?)([KMGT])$/i);
  if (!match) {
    return undefined;
  }

  const valuePart = match[1];
  const unitPart = match[2];
  if (!valuePart || !unitPart) {
    return undefined;
  }

  const value = Number(valuePart);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const unit = unitPart.toUpperCase();
  const multipliers: Record<string, number> = {
    K: 1024,
    M: 1024 ** 2,
    G: 1024 ** 3,
    T: 1024 ** 4
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    return undefined;
  }

  return value * multiplier;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function normalizeTags(tags: string[]): string[] {
  return [...tags].map((tag) => tag.trim()).filter(Boolean).sort();
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function needsNetworkUpdate(
  currentConfig: Record<string, string | number | boolean | undefined>,
  desiredConfig: NetworkConfig
): boolean {
  const desiredSnapshot = {
    type: desiredConfig.type,
    bridge_ports: desiredConfig.bridge_ports,
    bridge_vlan_aware: desiredConfig.bridge_vlan_aware,
    vlan_id: desiredConfig.vlan_id,
    vlan_raw_device: desiredConfig.vlan_raw_device,
    bond_mode: desiredConfig.bond_mode,
    slaves: desiredConfig.slaves?.join(' '),
    cidr: desiredConfig.cidr,
    gateway: desiredConfig.gateway,
    autostart: desiredConfig.autostart,
    comments: desiredConfig.comments
  };

  return hasConfigDrift(currentConfig, desiredSnapshot);
}

function needsStorageUpdate(
  currentConfig: Record<string, string | number | boolean | undefined>,
  desiredConfig: StorageConfig
): boolean {
  const desiredSnapshot = {
    type: desiredConfig.type,
    content: desiredConfig.content?.join(','),
    path: desiredConfig.path,
    server: desiredConfig.server,
    export: desiredConfig.export,
    share: desiredConfig.share,
    username: desiredConfig.username,
    domain: desiredConfig.domain,
    vgname: desiredConfig.vgname,
    pool: desiredConfig.pool,
    blocksize: desiredConfig.blocksize,
    sparse: desiredConfig.sparse,
    maxfiles: desiredConfig.maxfiles,
    'prune-backups': desiredConfig.prune_backups,
    shared: desiredConfig.shared,
    disable: desiredConfig.disable,
    nodes: desiredConfig.nodes?.join(',')
  };

  return hasConfigDrift(currentConfig, desiredSnapshot);
}

function hasConfigDrift(
  currentConfig: Record<string, string | number | boolean | undefined>,
  desiredSnapshot: Record<string, string | number | boolean | undefined>
): boolean {
  for (const [key, desiredValue] of Object.entries(desiredSnapshot)) {
    if (desiredValue === undefined) {
      continue;
    }

    const currentValue = currentConfig[key];
    if (String(currentValue) !== String(desiredValue)) {
      return true;
    }
  }

  return false;
}

function capacityHintSuffix(storageName: string, hints: Map<string, string>): string {
  const hint = hints.get(storageName);
  return hint ? ` (${hint})` : '';
}

function buildStorageCapacityHints(
  storage: Array<{ name: string; config: Record<string, string | number | boolean | undefined> }>
): Map<string, string> {
  const hints = new Map<string, string>();

  for (const item of storage) {
    const usedPercent = extractUsedPercent(item.config);
    if (usedPercent === undefined) {
      continue;
    }

    if (usedPercent >= 90) {
      hints.set(item.name, `capacity hint: ${item.name} is high usage (~${Math.round(usedPercent)}% used)`);
    } else if (usedPercent >= 75) {
      hints.set(item.name, `capacity hint: ${item.name} is elevated usage (~${Math.round(usedPercent)}% used)`);
    }
  }

  return hints;
}

function extractUsedPercent(config: Record<string, string | number | boolean | undefined>): number | undefined {
  const total = getNumericConfig(config, ['total', 'maxdisk', 'max', 'size']);
  const used = getNumericConfig(config, ['used', 'disk']);
  const avail = getNumericConfig(config, ['avail', 'available', 'free']);
  const usedFractionRaw = getNumericConfig(config, ['used_fraction', 'disk_fraction']);

  if (used !== undefined && total !== undefined && total > 0) {
    return (used / total) * 100;
  }

  if (avail !== undefined && total !== undefined && total > 0) {
    return ((total - avail) / total) * 100;
  }

  if (usedFractionRaw !== undefined) {
    if (usedFractionRaw <= 1) {
      return usedFractionRaw * 100;
    }
    return usedFractionRaw;
  }

  return undefined;
}

function getNumericConfig(
  config: Record<string, string | number | boolean | undefined>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}
