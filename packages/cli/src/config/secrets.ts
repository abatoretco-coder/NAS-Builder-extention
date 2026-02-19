import type { ConfigFile } from '@naas/shared';

export interface ProxmoxAuth {
  endpoint: string;
  insecure?: boolean;
  timeoutMs?: number;
  tokenId?: string;
  tokenSecret?: string;
  username?: string;
  password?: string;
  realm?: string;
}

export interface GrafanaAuth {
  endpoint: string;
  token?: string;
  insecure?: boolean;
  timeoutMs?: number;
  orgId?: number;
}

export function getProxmoxAuth(config: ConfigFile): ProxmoxAuth | undefined {
  if (!config.proxmox) {
    return undefined;
  }

  const tokenId = config.proxmox.tokenIdEnv ? process.env[config.proxmox.tokenIdEnv] : undefined;
  const tokenSecret = config.proxmox.tokenSecretEnv ? process.env[config.proxmox.tokenSecretEnv] : undefined;
  const username = config.proxmox.usernameEnv ? process.env[config.proxmox.usernameEnv] : undefined;
  const password = config.proxmox.passwordEnv ? process.env[config.proxmox.passwordEnv] : undefined;

  return {
    endpoint: config.proxmox.endpoint,
    insecure: config.proxmox.insecure,
    timeoutMs: config.proxmox.timeoutMs,
    tokenId,
    tokenSecret,
    username,
    password,
    realm: config.proxmox.realm
  };
}

export function getGrafanaAuth(config: ConfigFile): GrafanaAuth | undefined {
  if (!config.grafana?.endpoint) {
    return undefined;
  }

  const token = config.grafana.tokenEnv ? process.env[config.grafana.tokenEnv] : undefined;

  return {
    endpoint: config.grafana.endpoint,
    token,
    insecure: config.grafana.insecure,
    timeoutMs: config.grafana.timeoutMs,
    orgId: config.grafana.orgId
  };
}
