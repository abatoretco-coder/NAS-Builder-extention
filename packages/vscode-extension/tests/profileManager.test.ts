import { describe, expect, it } from 'vitest';
import { mergeProfile } from '../src/core/profileManager.js';
import type { NaaSProfile } from '../src/models.js';

describe('mergeProfile', () => {
  it('applies workspace override over base profile', () => {
    const base: NaaSProfile = {
      name: 'preprod',
      proxmox: {
        endpoint: 'https://proxmox-a.local:8006',
        authRef: 'pve-a'
      },
      docker: {
        host: 'unix:///var/run/docker.sock'
      },
      grafana: {
        endpoint: 'https://grafana-a.local',
        authRef: 'grafana-a'
      }
    };

    const merged = mergeProfile(base, {
      docker: { host: 'tcp://10.0.0.5:2375' }
    });

    expect(merged.docker?.host).toBe('tcp://10.0.0.5:2375');
    expect(merged.proxmox?.endpoint).toBe('https://proxmox-a.local:8006');
  });

  it('applies settings override over workspace override', () => {
    const base: NaaSProfile = {
      name: 'prod',
      proxmox: {
        endpoint: 'https://proxmox-prod.local:8006',
        authRef: 'prod-auth'
      }
    };

    const merged = mergeProfile(
      base,
      {
        proxmox: {
          endpoint: 'https://workspace-override.local:8006'
        }
      },
      {
        proxmox: {
          endpoint: 'https://settings-override.local:8006'
        }
      }
    );

    expect(merged.proxmox?.endpoint).toBe('https://settings-override.local:8006');
  });
});
