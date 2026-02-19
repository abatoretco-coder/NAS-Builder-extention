import type { PlanOutput, UnifiedState } from '../models.js';

export interface CachedWorkspaceState {
  current?: UnifiedState;
  plan?: PlanOutput;
  lastScanAt?: string;
}

export class StateCache {
  private readonly byWorkspaceKey = new Map<string, CachedWorkspaceState>();

  get(workspaceKey: string): CachedWorkspaceState {
    return this.byWorkspaceKey.get(workspaceKey) ?? {};
  }

  setCurrent(workspaceKey: string, state: UnifiedState): void {
    const prev = this.get(workspaceKey);
    this.byWorkspaceKey.set(workspaceKey, {
      ...prev,
      current: state,
      lastScanAt: new Date().toISOString()
    });
  }

  setPlan(workspaceKey: string, plan: PlanOutput): void {
    const prev = this.get(workspaceKey);
    this.byWorkspaceKey.set(workspaceKey, {
      ...prev,
      plan
    });
  }
}
