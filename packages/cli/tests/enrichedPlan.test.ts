import { describe, expect, it } from 'vitest';
import type { Plan } from '@naas/shared';
import { buildEnrichedPlan } from '../src/planner/enrichedPlan.js';

describe('buildEnrichedPlan', () => {
  it('maps plan actions to enriched metadata format', () => {
    const plan: Plan = {
      generatedAt: '2026-02-20T00:00:00.000Z',
      env: 'preprod',
      actions: [
        {
          kind: 'proxmox.vm.update',
          node: 'proxmox',
          vmid: 100,
          changes: [],
          reason: 'Update VM'
        },
        {
          kind: 'proxmox.network.update',
          node: 'proxmox',
          name: 'vmbr0',
          config: { name: 'vmbr0', node: 'proxmox', type: 'bridge' },
          reason: 'Update bridge'
        },
        {
          kind: 'proxmox.start',
          node: 'proxmox',
          vmid: 100,
          vmType: 'qemu',
          reason: 'Start VM'
        }
      ]
    };

    const enriched = buildEnrichedPlan(plan);
    expect(enriched.actions).toHaveLength(3);
    expect(enriched.actions[0]).toMatchObject({
      id: 'A001',
      type: 'proxmox.vm.update',
      target: 'proxmox/vmid:100',
      risk: 'medium',
      preSnapshot: true
    });
    expect(enriched.actions[1]).toMatchObject({
      id: 'A002',
      type: 'proxmox.network.update',
      risk: 'high',
      preSnapshot: false
    });
    expect(enriched.actions[2]).toMatchObject({
      id: 'A003',
      type: 'proxmox.start',
      expectedDowntime: 'short service interruption'
    });
  });
});
