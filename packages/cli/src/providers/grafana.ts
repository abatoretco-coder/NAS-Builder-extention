import https from 'node:https';
import axios from 'axios';
import type { GrafanaDashboard, GrafanaDashboardConfig, GrafanaDatasource, GrafanaFolderConfig } from '@naas/shared';
import type { GrafanaAuth } from '../config/secrets.js';
import {
  evaluateGrafanaCrudPolicy,
  type GrafanaCrudMethod,
  type GrafanaPayload,
  type GrafanaRequestContext
} from './grafanaCrudPolicy.js';

export class GrafanaProvider {
  private readonly auth: GrafanaAuth;

  constructor(auth: GrafanaAuth) {
    this.auth = auth;
    if (auth.insecure) {
      console.warn(
        '[naasctl] WARNING: Grafana TLS verification is disabled (insecure: true). ' +
        'This exposes credentials to network interception. Do not use in production.'
      );
    }
  }

  private client() {
    return axios.create({
      baseURL: this.auth.endpoint,
      timeout: this.auth.timeoutMs ?? 10_000,
      httpsAgent: new https.Agent({ rejectUnauthorized: !this.auth.insecure }),
      headers: this.auth.token ? { Authorization: `Bearer ${this.auth.token}` } : undefined
    });
  }

  async scan(): Promise<{ dashboards: GrafanaDashboard[]; datasources: GrafanaDatasource[]; warnings: string[] }> {
    const warnings: string[] = [];
    const client = this.client();

    let dashboards: GrafanaDashboard[] = [];
    let datasources: GrafanaDatasource[] = [];

    try {
      const dashboardResponse = await client.get<Array<{ uid: string; title: string; url: string }>>('/api/search?type=dash-db');
      dashboards = dashboardResponse.data.map((item) => ({ uid: item.uid, title: item.title, url: item.url }));
    } catch (error) {
      warnings.push(`Grafana dashboards unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      const datasourceResponse = await client.get<Array<{ id: number; name: string; type: string; isDefault?: boolean }>>('/api/datasources');
      datasources = datasourceResponse.data.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        isDefault: item.isDefault
      }));
    } catch (error) {
      warnings.push(`Grafana datasources unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { dashboards, datasources, warnings };
  }

  async validate(): Promise<{ ok: boolean; details: string }> {
    const client = this.client();
    try {
      const health = await client.get<{ database: string; message: string; version: string }>('/api/health');
      return {
        ok: true,
        details: `Grafana healthy (${health.data.version})`
      };
    } catch (error) {
      return {
        ok: false,
        details: `Grafana validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async grafanaRequest(
    method: GrafanaCrudMethod,
    path: string,
    context?: GrafanaRequestContext | GrafanaPayload
  ): Promise<unknown> {
    const requestContext = toRequestContext(context);
    const policy = evaluateGrafanaCrudPolicy(method, path, requestContext);
    if (!policy.ok) {
      throw new Error(policy.reason ?? 'Grafana CRUD policy validation failed');
    }

    const client = this.client();
    const requestHeaders: Record<string, string> = {
      ...(policy.sanitizedHeaders ?? {})
    };
    if (typeof policy.orgId === 'number') {
      requestHeaders['X-Grafana-Org-Id'] = String(policy.orgId);
    } else if (typeof this.auth.orgId === 'number') {
      requestHeaders['X-Grafana-Org-Id'] = String(this.auth.orgId);
    }

    const response = await client.request({
      method: policy.normalizedMethod,
      url: policy.normalizedPath,
      params: policy.sanitizedQuery ?? (policy.normalizedMethod === 'get' ? policy.sanitizedPayload : undefined),
      data: policy.sanitizedBody ?? (policy.normalizedMethod !== 'get' ? policy.sanitizedPayload : undefined),
      headers: Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined
    });

    return response.data;
  }

  async upsertFolder(config: GrafanaFolderConfig): Promise<unknown> {
    return this.grafanaRequest('post', '/api/folders', {
      body: {
        uid: config.uid,
        title: config.title,
        parentUid: config.parentUid
      }
    });
  }

  async deleteFolder(uid: string): Promise<unknown> {
    return this.grafanaRequest('delete', `/api/folders/${encodeURIComponent(uid)}`, {
      payload: { confirm: 'I_UNDERSTAND' }
    });
  }

  async upsertDashboard(config: GrafanaDashboardConfig): Promise<unknown> {
    const dashboardPayload = {
      ...(config.dashboard ?? {}),
      uid: config.uid,
      ...(config.title ? { title: config.title } : {})
    };

    return this.grafanaRequest('post', '/api/dashboards/db', {
      body: {
        dashboard: dashboardPayload,
        folderUid: config.folderUid,
        overwrite: config.overwrite ?? true,
        message: config.message
      }
    });
  }

  async deleteDashboard(uid: string): Promise<unknown> {
    return this.grafanaRequest('delete', `/api/dashboards/uid/${encodeURIComponent(uid)}`);
  }
}

function toRequestContext(context?: GrafanaRequestContext | GrafanaPayload): GrafanaRequestContext {
  if (!context) {
    return {};
  }

  const asRequestContext = context as GrafanaRequestContext;
  if ('payload' in asRequestContext || 'query' in asRequestContext || 'body' in asRequestContext || 'headers' in asRequestContext) {
    return asRequestContext;
  }

  return { payload: context as GrafanaPayload };
}
