import type { DesiredSpec, Plan, UnifiedState } from '@naas/shared';
import { evaluateGenericCrudPolicy, type CrudPayload } from '../providers/proxmoxCrudPolicy.js';
import { evaluateGrafanaCrudPolicy, type GrafanaPayload } from '../providers/grafanaCrudPolicy.js';

export interface PreflightReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function runPreflightChecks(current: UnifiedState, desired: DesiredSpec, plan?: Plan): PreflightReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeNames = new Set(current.compute.nodes.map((node) => node.name));
  const existingVmIds = new Set(current.compute.vms.map((vm) => vm.vmid));
  const existingCtIds = new Set(current.compute.cts.map((ct) => ct.vmid));

  const seenNetworkKeys = new Set<string>();
  for (const network of desired.networks ?? []) {
    const key = `${network.node}:${network.name}`;
    if (seenNetworkKeys.has(key)) {
      errors.push(`Duplicate network declaration ${key}`);
    }
    seenNetworkKeys.add(key);

    if (!nodeNames.has(network.node)) {
      warnings.push(`Network ${network.name} targets unknown node ${network.node} (not found in current scan)`);
    }
  }

  const seenStorageNames = new Set<string>();
  for (const storage of desired.storage ?? []) {
    if (seenStorageNames.has(storage.name)) {
      errors.push(`Duplicate storage declaration ${storage.name}`);
    }
    seenStorageNames.add(storage.name);

    if (storage.node && !nodeNames.has(storage.node)) {
      warnings.push(`Storage ${storage.name} targets unknown node ${storage.node} (not found in current scan)`);
    }
  }

  const vmProvisionIds = new Set<number>();
  for (const vm of desired.vmProvision ?? []) {
    if (vmProvisionIds.has(vm.vmid)) {
      errors.push(`Duplicate vmProvision vmid ${vm.vmid}`);
    }
    vmProvisionIds.add(vm.vmid);

    if (!nodeNames.has(vm.node)) {
      warnings.push(`VM ${vm.name} targets unknown node ${vm.node} (not found in current scan)`);
    }

    const seenDiskKeys = new Set<string>();
    for (const disk of vm.disks) {
      const diskKey = `${disk.interface}${disk.index}`;
      if (seenDiskKeys.has(diskKey)) {
        errors.push(`VM ${vm.name} has duplicate disk interface/index ${diskKey}`);
      }
      seenDiskKeys.add(diskKey);
    }

    const seenNics = new Set<number>();
    for (const nic of vm.networks) {
      if (seenNics.has(nic.index)) {
        errors.push(`VM ${vm.name} has duplicate network index net${nic.index}`);
      }
      seenNics.add(nic.index);
    }
  }

  const ctProvisionIds = new Set<number>();
  for (const ct of desired.containerProvision ?? []) {
    if (ctProvisionIds.has(ct.vmid)) {
      errors.push(`Duplicate containerProvision vmid ${ct.vmid}`);
    }
    ctProvisionIds.add(ct.vmid);

    if (!nodeNames.has(ct.node)) {
      warnings.push(`Container ${ct.name} targets unknown node ${ct.node} (not found in current scan)`);
    }

    const seenNics = new Set<number>();
    for (const nic of ct.networks) {
      if (seenNics.has(nic.index)) {
        errors.push(`Container ${ct.name} has duplicate network index net${nic.index}`);
      }
      seenNics.add(nic.index);
    }
  }

  for (const vmid of vmProvisionIds) {
    if (ctProvisionIds.has(vmid)) {
      errors.push(`VMID ${vmid} is declared in both vmProvision and containerProvision`);
    }
  }

  for (const vmid of desired.deleteVms ?? []) {
    if (vmProvisionIds.has(vmid)) {
      errors.push(`VMID ${vmid} is both provisioned and deleted in same desired spec (VM)`);
    }
    if (!existingVmIds.has(vmid)) {
      warnings.push(`deleteVms includes VMID ${vmid} which does not exist in current scan`);
    }
  }

  for (const vmid of desired.deleteContainers ?? []) {
    if (ctProvisionIds.has(vmid)) {
      errors.push(`VMID ${vmid} is both provisioned and deleted in same desired spec (CT)`);
    }
    if (!existingCtIds.has(vmid)) {
      warnings.push(`deleteContainers includes VMID ${vmid} which does not exist in current scan`);
    }
  }

  for (const operation of desired.proxmoxDatacenterCrud ?? []) {
    const policy = evaluateGenericCrudPolicy(
      'datacenter',
      operation.method,
      operation.path,
      operation.payload as CrudPayload | undefined
    );

    if (!policy.ok) {
      errors.push(`Invalid proxmoxDatacenterCrud operation ${operation.method.toUpperCase()} ${operation.path}: ${policy.reason}`);
    }
  }

  for (const operation of desired.proxmoxNodeCrud ?? []) {
    const policy = evaluateGenericCrudPolicy('node', operation.method, operation.path, operation.payload as CrudPayload | undefined);

    if (!policy.ok) {
      errors.push(
        `Invalid proxmoxNodeCrud operation ${operation.method.toUpperCase()} ${operation.node}:${operation.path}: ${policy.reason}`
      );
    }
  }

  for (const operation of desired.grafanaCrud ?? []) {
    const policy = evaluateGrafanaCrudPolicy(
      operation.method,
      operation.path,
      {
        payload: operation.payload as GrafanaPayload | undefined,
        query: operation.query as GrafanaPayload | undefined,
        body: operation.body as GrafanaPayload | undefined,
        headers: operation.headers,
        orgId: operation.orgId
      }
    );

    if (!policy.ok) {
      errors.push(`Invalid grafanaCrud operation ${operation.method.toUpperCase()} ${operation.path}: ${policy.reason}`);
    }
  }

  const seenGrafanaFolderUids = new Set<string>();
  const seenGrafanaFolderTitles = new Set<string>();
  for (const folder of desired.grafanaFolders ?? []) {
    if (folder.ensure === 'absent' && !folder.uid) {
      errors.push('grafanaFolders entries with ensure=absent require uid');
    }

    if (folder.uid) {
      if (seenGrafanaFolderUids.has(folder.uid)) {
        errors.push(`Duplicate grafanaFolders uid ${folder.uid}`);
      }
      seenGrafanaFolderUids.add(folder.uid);
    }

    const normalizedTitle = folder.title.trim().toLowerCase();
    if (seenGrafanaFolderTitles.has(normalizedTitle)) {
      errors.push(`Duplicate grafanaFolders title ${folder.title}`);
    }
    seenGrafanaFolderTitles.add(normalizedTitle);
  }

  const seenGrafanaDashboardUids = new Set<string>();
  for (const dashboard of desired.grafanaDashboards ?? []) {
    if (seenGrafanaDashboardUids.has(dashboard.uid)) {
      errors.push(`Duplicate grafanaDashboards uid ${dashboard.uid}`);
    }
    seenGrafanaDashboardUids.add(dashboard.uid);
  }

  for (const dns of desired.proxmoxNodeDns ?? []) {
    if (!nodeNames.has(dns.node)) {
      warnings.push(`Node DNS config targets unknown node ${dns.node} (not found in current scan)`);
    }
  }

  for (const hosts of desired.proxmoxNodeHosts ?? []) {
    if (!nodeNames.has(hosts.node)) {
      warnings.push(`Node hosts config targets unknown node ${hosts.node} (not found in current scan)`);
    }
  }

  for (const nodeOptions of desired.proxmoxNodeOptions ?? []) {
    if (!nodeNames.has(nodeOptions.node)) {
      warnings.push(`Node options config targets unknown node ${nodeOptions.node} (not found in current scan)`);
    }
  }

  for (const nodeTime of desired.proxmoxNodeTime ?? []) {
    if (!nodeNames.has(nodeTime.node)) {
      warnings.push(`Node time config targets unknown node ${nodeTime.node} (not found in current scan)`);
    }
  }

  for (const serviceAction of desired.proxmoxNodeServices ?? []) {
    if (!nodeNames.has(serviceAction.node)) {
      warnings.push(`Node service action targets unknown node ${serviceAction.node} (not found in current scan)`);
    }
  }

  for (const aptAction of desired.proxmoxNodeApt ?? []) {
    if (!nodeNames.has(aptAction.node)) {
      warnings.push(`Node apt action targets unknown node ${aptAction.node} (not found in current scan)`);
    }
  }

  for (const certificateRequest of desired.proxmoxNodeCertificates ?? []) {
    if (!nodeNames.has(certificateRequest.node)) {
      warnings.push(`Node certificate request targets unknown node ${certificateRequest.node} (not found in current scan)`);
    }
    if (!certificateRequest.path.startsWith('/certificates')) {
      errors.push(`Invalid proxmoxNodeCertificates path ${certificateRequest.path}: must start with /certificates`);
    }
  }

  for (const firewallOptions of desired.proxmoxNodeFirewallOptions ?? []) {
    if (!nodeNames.has(firewallOptions.node)) {
      warnings.push(`Node firewall options target unknown node ${firewallOptions.node} (not found in current scan)`);
    }
  }

  for (const firewallRule of desired.proxmoxNodeFirewallRules ?? []) {
    if (!nodeNames.has(firewallRule.node)) {
      warnings.push(`Node firewall rule targets unknown node ${firewallRule.node} (not found in current scan)`);
    }
    if (firewallRule.ensure === 'absent' && !firewallRule.id) {
      errors.push('proxmoxNodeFirewallRules entries with ensure=absent require id');
    }
  }

  for (const customCert of desired.proxmoxNodeCertificateCustom ?? []) {
    if (!nodeNames.has(customCert.node)) {
      warnings.push(`Node custom certificate request targets unknown node ${customCert.node} (not found in current scan)`);
    }
  }

  for (const acmeCert of desired.proxmoxNodeCertificateAcme ?? []) {
    if (!nodeNames.has(acmeCert.node)) {
      warnings.push(`Node ACME certificate request targets unknown node ${acmeCert.node} (not found in current scan)`);
    }
  }

  const seenZones = new Set<string>();
  for (const zone of desired.proxmoxSdnZones ?? []) {
    if (seenZones.has(zone.zone)) {
      errors.push(`Duplicate proxmoxSdnZones entry ${zone.zone}`);
    }
    seenZones.add(zone.zone);
  }

  const seenVnets = new Set<string>();
  for (const vnet of desired.proxmoxSdnVnets ?? []) {
    if (seenVnets.has(vnet.vnet)) {
      errors.push(`Duplicate proxmoxSdnVnets entry ${vnet.vnet}`);
    }
    seenVnets.add(vnet.vnet);
  }

  const seenSubnets = new Set<string>();
  for (const subnet of desired.proxmoxSdnSubnets ?? []) {
    const key = `${subnet.vnet}:${subnet.subnet}`;
    if (seenSubnets.has(key)) {
      errors.push(`Duplicate proxmoxSdnSubnets entry ${key}`);
    }
    seenSubnets.add(key);
  }

  const seenIpams = new Set<string>();
  for (const ipam of desired.proxmoxSdnIpams ?? []) {
    if (seenIpams.has(ipam.ipam)) {
      errors.push(`Duplicate proxmoxSdnIpams entry ${ipam.ipam}`);
    }
    seenIpams.add(ipam.ipam);
  }

  const seenFirewallAliases = new Set<string>();
  for (const alias of desired.proxmoxDatacenterFirewallAliases ?? []) {
    if (seenFirewallAliases.has(alias.name)) {
      errors.push(`Duplicate proxmoxDatacenterFirewallAliases entry ${alias.name}`);
    }
    seenFirewallAliases.add(alias.name);
  }

  const seenFirewallIpsets = new Set<string>();
  for (const ipset of desired.proxmoxDatacenterFirewallIpsets ?? []) {
    if (seenFirewallIpsets.has(ipset.name)) {
      errors.push(`Duplicate proxmoxDatacenterFirewallIpsets entry ${ipset.name}`);
    }
    seenFirewallIpsets.add(ipset.name);
  }

  for (const rule of desired.proxmoxDatacenterFirewallRules ?? []) {
    if (rule.ensure === 'absent' && !rule.id) {
      errors.push('proxmoxDatacenterFirewallRules entries with ensure=absent require id');
    }
  }

  const seenVmSnapshotKeys = new Set<string>();
  for (const snapshot of desired.proxmoxVmSnapshots ?? []) {
    if (!nodeNames.has(snapshot.node)) {
      warnings.push(`VM snapshot policy targets unknown node ${snapshot.node} (not found in current scan)`);
    }
    const key = `${snapshot.node}:${snapshot.vmid}:${snapshot.name}`;
    if (seenVmSnapshotKeys.has(key)) {
      errors.push(`Duplicate proxmoxVmSnapshots entry ${key}`);
    }
    seenVmSnapshotKeys.add(key);
  }

  const seenCtSnapshotKeys = new Set<string>();
  for (const snapshot of desired.proxmoxCtSnapshots ?? []) {
    if (!nodeNames.has(snapshot.node)) {
      warnings.push(`CT snapshot policy targets unknown node ${snapshot.node} (not found in current scan)`);
    }
    const key = `${snapshot.node}:${snapshot.vmid}:${snapshot.name}`;
    if (seenCtSnapshotKeys.has(key)) {
      errors.push(`Duplicate proxmoxCtSnapshots entry ${key}`);
    }
    seenCtSnapshotKeys.add(key);
  }

  for (const migration of desired.proxmoxVmMigrations ?? []) {
    if (!nodeNames.has(migration.node)) {
      warnings.push(`VM migration source node ${migration.node} not found in current scan`);
    }
    if (!nodeNames.has(migration.target)) {
      warnings.push(`VM migration target node ${migration.target} not found in current scan`);
    }
    if (migration.node === migration.target) {
      errors.push(`VM migration for ${migration.vmid} has identical source/target node ${migration.node}`);
    }
  }

  for (const migration of desired.proxmoxCtMigrations ?? []) {
    if (!nodeNames.has(migration.node)) {
      warnings.push(`CT migration source node ${migration.node} not found in current scan`);
    }
    if (!nodeNames.has(migration.target)) {
      warnings.push(`CT migration target node ${migration.target} not found in current scan`);
    }
    if (migration.node === migration.target) {
      errors.push(`CT migration for ${migration.vmid} has identical source/target node ${migration.node}`);
    }
  }

  for (const backup of desired.proxmoxVmBackups ?? []) {
    if (!nodeNames.has(backup.node)) {
      warnings.push(`VM backup targets unknown node ${backup.node} (not found in current scan)`);
    }
  }

  for (const backup of desired.proxmoxCtBackups ?? []) {
    if (!nodeNames.has(backup.node)) {
      warnings.push(`CT backup targets unknown node ${backup.node} (not found in current scan)`);
    }
  }

  for (const restore of desired.proxmoxVmRestores ?? []) {
    if (!nodeNames.has(restore.node)) {
      warnings.push(`VM restore targets unknown node ${restore.node} (not found in current scan)`);
    }
  }

  for (const restore of desired.proxmoxCtRestores ?? []) {
    if (!nodeNames.has(restore.node)) {
      warnings.push(`CT restore targets unknown node ${restore.node} (not found in current scan)`);
    }
  }

  for (const command of desired.proxmoxVmGuestAgent ?? []) {
    if (!nodeNames.has(command.node)) {
      warnings.push(`VM guest-agent command targets unknown node ${command.node} (not found in current scan)`);
    }
  }

  const seenStorageContentKeys = new Set<string>();
  for (const content of desired.proxmoxStorageContent ?? []) {
    if (!nodeNames.has(content.node)) {
      warnings.push(`Storage content operation targets unknown node ${content.node} (not found in current scan)`);
    }

    const key = `${content.node}:${content.storage}:${content.volume}`;
    if (seenStorageContentKeys.has(key)) {
      errors.push(`Duplicate proxmoxStorageContent entry ${key}`);
    }
    seenStorageContentKeys.add(key);
  }

  for (const move of desired.proxmoxVmDiskMoves ?? []) {
    if (!nodeNames.has(move.node)) {
      warnings.push(`VM disk move targets unknown node ${move.node} (not found in current scan)`);
    }
  }

  for (const clone of desired.proxmoxVmDiskClones ?? []) {
    if (!nodeNames.has(clone.node)) {
      warnings.push(`VM disk clone targets unknown node ${clone.node} (not found in current scan)`);
    }
  }

  for (const diskImport of desired.proxmoxVmDiskImports ?? []) {
    if (!nodeNames.has(diskImport.node)) {
      warnings.push(`VM disk import targets unknown node ${diskImport.node} (not found in current scan)`);
    }
  }

  for (const contentCopy of desired.proxmoxStorageContentCopy ?? []) {
    if (!nodeNames.has(contentCopy.node)) {
      warnings.push(`Storage content copy targets unknown node ${contentCopy.node} (not found in current scan)`);
    }
  }

  for (const request of desired.proxmoxNodeDiskInitialize ?? []) {
    if (!nodeNames.has(request.node)) {
      warnings.push(`Node disk initialize targets unknown node ${request.node} (not found in current scan)`);
    }
  }

  for (const request of desired.proxmoxNodeLvmCreate ?? []) {
    if (!nodeNames.has(request.node)) {
      warnings.push(`Node LVM create targets unknown node ${request.node} (not found in current scan)`);
    }
  }

  for (const request of desired.proxmoxNodeLvmThinCreate ?? []) {
    if (!nodeNames.has(request.node)) {
      warnings.push(`Node LVM-thin create targets unknown node ${request.node} (not found in current scan)`);
    }
  }

  for (const request of desired.proxmoxNodeZfsCreate ?? []) {
    if (!nodeNames.has(request.node)) {
      warnings.push(`Node ZFS create targets unknown node ${request.node} (not found in current scan)`);
    }
  }

  const seenHaGroups = new Set<string>();
  for (const group of desired.proxmoxHaGroups ?? []) {
    if (seenHaGroups.has(group.group)) {
      errors.push(`Duplicate proxmoxHaGroups entry ${group.group}`);
    }
    seenHaGroups.add(group.group);

    for (const node of group.nodes ?? []) {
      if (!nodeNames.has(node)) {
        warnings.push(`HA group ${group.group} references unknown node ${node} (not found in current scan)`);
      }
    }
  }

  const seenHaResources = new Set<string>();
  for (const resource of desired.proxmoxHaResources ?? []) {
    if (seenHaResources.has(resource.sid)) {
      errors.push(`Duplicate proxmoxHaResources entry ${resource.sid}`);
    }
    seenHaResources.add(resource.sid);
  }

  const seenHaRules = new Set<string>();
  for (const rule of desired.proxmoxHaRules ?? []) {
    if (seenHaRules.has(rule.rule)) {
      errors.push(`Duplicate proxmoxHaRules entry ${rule.rule}`);
    }
    seenHaRules.add(rule.rule);
  }

  const seenCephFlags = new Set<string>();
  for (const flag of desired.proxmoxCephFlags ?? []) {
    if (seenCephFlags.has(flag.flag)) {
      errors.push(`Duplicate proxmoxCephFlags entry ${flag.flag}`);
    }
    seenCephFlags.add(flag.flag);
  }

  const seenHaStatus = new Set<string>();
  for (const query of desired.proxmoxHaStatus ?? []) {
    const key = query.section ?? 'status';
    if (seenHaStatus.has(key)) {
      errors.push(`Duplicate proxmoxHaStatus entry ${key}`);
    }
    seenHaStatus.add(key);
  }

  const seenCephRead = new Set<string>();
  for (const query of desired.proxmoxCephRead ?? []) {
    if (seenCephRead.has(query.section)) {
      errors.push(`Duplicate proxmoxCephRead entry ${query.section}`);
    }
    seenCephRead.add(query.section);
  }

  const seenNodeCephRead = new Set<string>();
  for (const query of desired.proxmoxNodeCephRead ?? []) {
    if (!nodeNames.has(query.node)) {
      warnings.push(`Node ceph query targets unknown node ${query.node} (not found in current scan)`);
    }
    const key = `${query.node}:${query.section ?? 'overview'}`;
    if (seenNodeCephRead.has(key)) {
      errors.push(`Duplicate proxmoxNodeCephRead entry ${key}`);
    }
    seenNodeCephRead.add(key);
  }

  const seenNodeCephActions = new Set<string>();
  for (const action of desired.proxmoxNodeCephActions ?? []) {
    if (!nodeNames.has(action.node)) {
      warnings.push(`Node ceph action targets unknown node ${action.node} (not found in current scan)`);
    }
    const key = `${action.node}:${action.method}:${action.section ?? 'overview'}`;
    if (seenNodeCephActions.has(key)) {
      errors.push(`Duplicate proxmoxNodeCephActions entry ${key}`);
    }
    seenNodeCephActions.add(key);

    if (action.confirm !== 'I_UNDERSTAND') {
      errors.push(`High-risk proxmoxNodeCephActions requires confirm=I_UNDERSTAND for ${key}`);
    }
  }

  for (const query of desired.proxmoxNodeTasks ?? []) {
    if (!nodeNames.has(query.node)) {
      warnings.push(`Node task query targets unknown node ${query.node} (not found in current scan)`);
    }
  }

  const seenNodeTaskLogs = new Set<string>();
  for (const query of desired.proxmoxNodeTaskLogs ?? []) {
    if (!nodeNames.has(query.node)) {
      warnings.push(`Node task log query targets unknown node ${query.node} (not found in current scan)`);
    }
    const key = `${query.node}:${query.upid}`;
    if (seenNodeTaskLogs.has(key)) {
      errors.push(`Duplicate proxmoxNodeTaskLogs entry ${key}`);
    }
    seenNodeTaskLogs.add(key);
  }

  for (const query of desired.proxmoxNodeFirewallLogs ?? []) {
    if (!nodeNames.has(query.node)) {
      warnings.push(`Node firewall log query targets unknown node ${query.node} (not found in current scan)`);
    }
  }

  if (plan && plan.actions.length === 0) {
    warnings.push('Plan contains no actions');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
