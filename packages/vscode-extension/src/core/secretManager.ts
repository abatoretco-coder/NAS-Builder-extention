import * as vscode from 'vscode';
import type { CredentialsPayload, NaaSProfile } from '../models.js';

const KEY_PREFIX = 'naas.credentials';

export function secretKeyForProfile(profileName: string, authRef?: string): string {
  return `${KEY_PREFIX}.${authRef ?? profileName}`;
}

export async function getCredentials(
  secrets: vscode.SecretStorage,
  profile: NaaSProfile
): Promise<CredentialsPayload | undefined> {
  const proxmoxRef = profile.proxmox?.authRef;
  const grafanaRef = profile.grafana?.authRef;

  const merged: CredentialsPayload = {};

  if (proxmoxRef || profile.proxmox) {
    const raw = await secrets.get(secretKeyForProfile(profile.name, proxmoxRef));
    if (raw) {
      const parsed = JSON.parse(raw) as CredentialsPayload;
      if (parsed.proxmoxTokenId) merged.proxmoxTokenId = parsed.proxmoxTokenId;
      if (parsed.proxmoxTokenSecret) merged.proxmoxTokenSecret = parsed.proxmoxTokenSecret;
      if (parsed.proxmoxUsername) merged.proxmoxUsername = parsed.proxmoxUsername;
      if (parsed.proxmoxPassword) merged.proxmoxPassword = parsed.proxmoxPassword;
    }
  }

  if (grafanaRef || profile.grafana) {
    const raw = await secrets.get(secretKeyForProfile(profile.name, grafanaRef));
    if (raw) {
      const parsed = JSON.parse(raw) as CredentialsPayload;
      if (parsed.grafanaToken) merged.grafanaToken = parsed.grafanaToken;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export async function saveCredentials(
  secrets: vscode.SecretStorage,
  profile: NaaSProfile,
  payload: CredentialsPayload
): Promise<void> {
  const proxmoxRef = profile.proxmox?.authRef;
  const grafanaRef = profile.grafana?.authRef;

  const proxmoxPayload: CredentialsPayload = {
    proxmoxTokenId: payload.proxmoxTokenId,
    proxmoxTokenSecret: payload.proxmoxTokenSecret,
    proxmoxUsername: payload.proxmoxUsername,
    proxmoxPassword: payload.proxmoxPassword
  };

  const grafanaPayload: CredentialsPayload = {
    grafanaToken: payload.grafanaToken
  };

  if (profile.proxmox) {
    await secrets.store(secretKeyForProfile(profile.name, proxmoxRef), JSON.stringify(proxmoxPayload));
  }

  if (profile.grafana) {
    await secrets.store(secretKeyForProfile(profile.name, grafanaRef), JSON.stringify(grafanaPayload));
  }
}

export async function deleteCredentials(secrets: vscode.SecretStorage, profile: NaaSProfile): Promise<void> {
  await secrets.delete(secretKeyForProfile(profile.name, profile.proxmox?.authRef));
  await secrets.delete(secretKeyForProfile(profile.name, profile.grafana?.authRef));
}
