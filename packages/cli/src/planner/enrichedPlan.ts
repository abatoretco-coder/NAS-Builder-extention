import type { Plan, PlanAction } from '@naas/shared';

export interface EnrichedPlanAction {
  id: string;
  type: string;
  target: string;
  risk: 'low' | 'medium' | 'high';
  preSnapshot: boolean;
  rollbackHint: string;
  expectedDowntime: string;
  naasAction: string;
  reason: string;
}

export interface EnrichedPlan {
  name: string;
  mode: 'dry-run';
  generatedAt: string;
  env: string;
  actions: EnrichedPlanAction[];
}

export function buildEnrichedPlan(plan: Plan): EnrichedPlan {
  return {
    name: `${plan.env}-phase0-safe-plan`,
    mode: 'dry-run',
    generatedAt: plan.generatedAt,
    env: plan.env,
    actions: plan.actions.map((action, index) => mapAction(action, index + 1))
  };
}

function mapAction(action: PlanAction, index: number): EnrichedPlanAction {
  return {
    id: `A${String(index).padStart(3, '0')}`,
    type: action.kind,
    target: getTarget(action),
    risk: getRisk(action),
    preSnapshot: needsSnapshot(action),
    rollbackHint: getRollbackHint(action),
    expectedDowntime: getExpectedDowntime(action),
    naasAction: action.kind,
    reason: action.reason
  };
}

function getTarget(action: PlanAction): string {
  if ('node' in action && 'vmid' in action) {
    return `${action.node}/vmid:${action.vmid}`;
  }
  if ('node' in action && 'name' in action) {
    return `${action.node}/${action.name}`;
  }
  if ('path' in action && typeof action.path === 'string') {
    return action.path;
  }
  if ('config' in action && action.config && typeof action.config === 'object') {
    const config = action.config as Record<string, unknown>;
    if (typeof config.node === 'string' && typeof config.vmid === 'number') {
      return `${config.node}/vmid:${config.vmid}`;
    }
    if (typeof config.name === 'string') {
      return config.name;
    }
    if (typeof config.id === 'string') {
      return config.id;
    }
  }
  return action.kind;
}

function getRisk(action: PlanAction): 'low' | 'medium' | 'high' {
  const kind = action.kind;
  if (
    kind.includes('firewall') ||
    kind.includes('network') ||
    kind.includes('backup-job') ||
    kind.includes('.delete') ||
    kind.includes('resize-disk')
  ) {
    return 'high';
  }
  if (kind.includes('.create') || kind.includes('.update') || kind.includes('.start') || kind.includes('.stop')) {
    return 'medium';
  }
  return 'low';
}

function needsSnapshot(action: PlanAction): boolean {
  const risk = getRisk(action);
  if (risk === 'low') {
    return false;
  }
  const kind = action.kind;
  if (kind.includes('firewall') || kind.includes('network') || kind.includes('backup-job')) {
    return false;
  }
  return kind.startsWith('proxmox.vm.') || kind.startsWith('proxmox.ct.');
}

function getRollbackHint(action: PlanAction): string {
  const kind = action.kind;
  if (kind.startsWith('proxmox.vm.') || kind.startsWith('proxmox.ct.')) {
    return 'Restore latest snapshot or revert VM/CT config and power state.';
  }
  if (kind.includes('firewall')) {
    return 'Restore previous firewall options/rules export before re-enabling restrictive policy.';
  }
  if (kind.includes('network')) {
    return 'Restore previous node network config and reload network stack from console.';
  }
  if (kind.includes('backup-job')) {
    return 'Disable or revert backup job schedule/retention to previous values.';
  }
  return 'Revert action manually using previous state and run scan/plan again.';
}

function getExpectedDowntime(action: PlanAction): string {
  const kind = action.kind;
  if (kind.includes('.create')) {
    return 'none';
  }
  if (kind.includes('.start') || kind.includes('.stop') || kind.includes('.reboot')) {
    return 'short service interruption';
  }
  if (kind.includes('resize-disk') || kind.includes('network') || kind.includes('firewall')) {
    return 'possible brief interruption';
  }
  if (kind.includes('.update')) {
    return 'none to short interruption';
  }
  return 'none';
}
