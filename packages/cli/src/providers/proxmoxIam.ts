import axios, { type AxiosInstance } from 'axios';
import type {
  ProxmoxUserConfig,
  ProxmoxTokenConfig,
  ProxmoxAclConfig,
  ProxmoxRoleConfig,
  ProxmoxGroupConfig,
  ProxmoxRealmConfig,
  ProxmoxTfaConfig
} from '@naas/shared';
import { withRetry } from '../utils/retry.js';

/**
 * Handles Proxmox IAM operations: users, tokens, ACLs, roles, groups, realms, and TFA.
 * Extracted to keep ProxmoxProvider focused on compute/infrastructure operations.
 */
export class ProxmoxIamApi {
  constructor(private readonly client: AxiosInstance) {}

  async upsertUser(config: ProxmoxUserConfig): Promise<void> {
    const payload = toUserPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/access/users', payload);
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateUser(config);
    }
  }

  async updateUser(config: ProxmoxUserConfig): Promise<void> {
    const payload = toUserPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/access/users/${encodeURIComponent(config.userId)}`, payload);
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/users/${encodeURIComponent(userId)}`);
    });
  }

  async upsertToken(config: ProxmoxTokenConfig): Promise<void> {
    const payload = toTokenPayload(config);
    const tokenPath = `/access/users/${encodeURIComponent(config.userId)}/token/${encodeURIComponent(config.tokenId)}`;

    try {
      await withRetry(async () => {
        await this.client.post(tokenPath, payload);
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateToken(config);
    }
  }

  async updateToken(config: ProxmoxTokenConfig): Promise<void> {
    const payload = toTokenPayload(config);
    await withRetry(async () => {
      await this.client.put(
        `/access/users/${encodeURIComponent(config.userId)}/token/${encodeURIComponent(config.tokenId)}`,
        payload
      );
    });
  }

  async deleteToken(userId: string, tokenId: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/users/${encodeURIComponent(userId)}/token/${encodeURIComponent(tokenId)}`);
    });
  }

  async upsertAcl(config: ProxmoxAclConfig): Promise<void> {
    const payload = toAclPayload(config);
    await withRetry(async () => {
      await this.client.put('/access/acl', payload);
    });
  }

  async deleteAcl(config: ProxmoxAclConfig): Promise<void> {
    const payload = toAclPayload(config);
    await withRetry(async () => {
      await this.client.delete('/access/acl', { data: payload });
    });
  }

  async upsertRole(config: ProxmoxRoleConfig): Promise<void> {
    const payload = {
      roleid: config.roleId,
      privs: config.privs.join(' ')
    };
    try {
      await withRetry(async () => {
        await this.client.post('/access/roles', payload);
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateRole(config);
    }
  }

  async updateRole(config: ProxmoxRoleConfig): Promise<void> {
    await withRetry(async () => {
      await this.client.put(`/access/roles/${encodeURIComponent(config.roleId)}`, {
        privs: config.privs.join(' ')
      });
    });
  }

  async deleteRole(roleId: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/roles/${encodeURIComponent(roleId)}`);
    });
  }

  async upsertGroup(config: ProxmoxGroupConfig): Promise<void> {
    const payload = toGroupPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/access/groups', payload);
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateGroup(config);
    }
  }

  async updateGroup(config: ProxmoxGroupConfig): Promise<void> {
    const payload = toGroupPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/access/groups/${encodeURIComponent(config.groupId)}`, payload);
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/groups/${encodeURIComponent(groupId)}`);
    });
  }

  async upsertRealm(config: ProxmoxRealmConfig): Promise<void> {
    const payload = toRealmPayload(config, true);
    try {
      await withRetry(async () => {
        await this.client.post('/access/domains', payload);
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      await this.updateRealm(config);
    }
  }

  async updateRealm(config: ProxmoxRealmConfig): Promise<void> {
    const payload = toRealmPayload(config, false);
    await withRetry(async () => {
      await this.client.put(`/access/domains/${encodeURIComponent(config.realm)}`, payload);
    });
  }

  async deleteRealm(realm: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/domains/${encodeURIComponent(realm)}`);
    });
  }

  async createTfa(config: ProxmoxTfaConfig): Promise<void> {
    const payload = toTfaCreatePayload(config);
    await withRetry(async () => {
      await this.client.post(`/access/tfa/${encodeURIComponent(config.userId)}`, payload);
    });
  }

  async updateTfa(config: ProxmoxTfaConfig): Promise<void> {
    if (!config.id) {
      throw new Error(`TFA update requires id for user ${config.userId}`);
    }
    const payload = toTfaUpdatePayload(config);
    await withRetry(async () => {
      await this.client.put(
        `/access/tfa/${encodeURIComponent(config.userId)}/${encodeURIComponent(config.id ?? '')}`,
        payload
      );
    });
  }

  async deleteTfa(userId: string, id: string): Promise<void> {
    await withRetry(async () => {
      await this.client.delete(`/access/tfa/${encodeURIComponent(userId)}/${encodeURIComponent(id)}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Internal payload builders
// ---------------------------------------------------------------------------

function isAlreadyExistsError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  const data = error.response?.data as { errors?: unknown; message?: unknown } | undefined;
  const message = typeof data?.message === 'string' ? data.message.toLowerCase() : '';
  if (status === 409) {
    return true;
  }
  if (status === 400 && message.includes('exist')) {
    return true;
  }
  return false;
}

function toUserPayload(config: ProxmoxUserConfig, includeUserId: boolean): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (includeUserId) {
    payload.userid = config.userId;
  }
  if (config.email) {
    payload.email = config.email;
  }
  if (config.firstName) {
    payload.firstname = config.firstName;
  }
  if (config.lastName) {
    payload.lastname = config.lastName;
  }
  if (config.comment) {
    payload.comment = config.comment;
  }
  if (config.enabled !== undefined) {
    payload.enable = config.enabled ? 1 : 0;
  }
  if (config.expire !== undefined) {
    payload.expire = config.expire;
  }
  if (config.groups?.length) {
    payload.groups = config.groups.join(',');
  }
  if (config.password) {
    payload.password = config.password;
  }
  if (config.keys) {
    payload.keys = config.keys;
  }
  return payload;
}

function toTokenPayload(config: ProxmoxTokenConfig): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (config.comment) {
    payload.comment = config.comment;
  }
  if (config.expire !== undefined) {
    payload.expire = config.expire;
  }
  if (config.enabled !== undefined) {
    payload.enable = config.enabled ? 1 : 0;
  }
  if (config.privilegeSeparation !== undefined) {
    payload['privsep'] = config.privilegeSeparation ? 1 : 0;
  }
  return payload;
}

function toAclPayload(config: ProxmoxAclConfig): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {
    path: config.path,
    roles: config.roleId
  };
  if (config.userId) {
    payload.users = config.userId;
  }
  if (config.groupId) {
    payload.groups = config.groupId;
  }
  if (config.tokenId) {
    payload.tokens = config.tokenId;
  }
  if (config.propagate !== undefined) {
    payload.propagate = config.propagate ? 1 : 0;
  }
  return payload;
}

function toGroupPayload(config: ProxmoxGroupConfig, includeGroupId: boolean): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (includeGroupId) {
    payload.groupid = config.groupId;
  }
  if (config.comment) {
    payload.comment = config.comment;
  }
  if (config.users?.length) {
    payload.users = config.users.join(',');
  }
  return payload;
}

function toRealmPayload(config: ProxmoxRealmConfig, includeRealm: boolean): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (includeRealm) {
    payload.realm = config.realm;
  }
  if (config.type) {
    payload.type = config.type;
  }
  if (config.comment) {
    payload.comment = config.comment;
  }
  if (config.default !== undefined) {
    payload.default = config.default ? 1 : 0;
  }
  if (config.options) {
    Object.assign(payload, config.options);
  }
  return payload;
}

function toTfaCreatePayload(config: ProxmoxTfaConfig): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (config.type) {
    payload.type = config.type;
  }
  if (config.description) {
    payload.description = config.description;
  }
  if (config.value) {
    payload.value = config.value;
  }
  return payload;
}

function toTfaUpdatePayload(config: ProxmoxTfaConfig): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (config.description) {
    payload.description = config.description;
  }
  if (config.enabled !== undefined) {
    payload.enable = config.enabled ? 1 : 0;
  }
  return payload;
}
