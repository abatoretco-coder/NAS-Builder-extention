export type GrafanaCrudMethod =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'head'
  | 'options';

export type GrafanaPayload = Record<string, unknown>;

export interface GrafanaRequestContext {
  payload?: GrafanaPayload;
  query?: GrafanaPayload;
  body?: GrafanaPayload;
  headers?: Record<string, string>;
  orgId?: number;
}

export interface GrafanaCrudPolicyResult {
  ok: boolean;
  normalizedMethod: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';
  normalizedPath: string;
  sanitizedPayload?: GrafanaPayload;
  sanitizedQuery?: GrafanaPayload;
  sanitizedBody?: GrafanaPayload;
  sanitizedHeaders?: Record<string, string>;
  orgId?: number;
  highRisk: boolean;
  reason?: string;
}

const ALLOWED_PREFIXES = [
  '/api',
  '/apis'
];

const DENY_SEGMENTS = [
  '/admin/provisioning',
  '/admin/settings'
];

const HIGH_RISK = [
  /^\/api\/v1\/provisioning\/policies(\/|$)/i,
  /^\/api\/folders\//i,
  /^\/apis\/folder\.grafana\.app\//i,
  /^\/api\/serviceaccounts\//i
];

export function evaluateGrafanaCrudPolicy(
  method: GrafanaCrudMethod,
  rawPath: string,
  context?: GrafanaRequestContext
): GrafanaCrudPolicyResult {
  const normalizedMethod = normalizeMethod(method);
  const normalizedPath = normalizePath(rawPath);
  if (!normalizedPath) {
    return {
      ok: false,
      normalizedMethod,
      normalizedPath: '/',
      highRisk: false,
      reason: 'Grafana CRUD path is required'
    };
  }

  if (normalizedPath.includes('..')) {
    return {
      ok: false,
      normalizedMethod,
      normalizedPath,
      highRisk: false,
      reason: `Path traversal is not allowed: ${normalizedPath}`
    };
  }

  if (!ALLOWED_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return {
      ok: false,
      normalizedMethod,
      normalizedPath,
      highRisk: false,
      reason: `Grafana CRUD path is not allowlisted: ${normalizedPath}`
    };
  }

  if (DENY_SEGMENTS.some((segment) => normalizedPath.toLowerCase().includes(segment))) {
    return {
      ok: false,
      normalizedMethod,
      normalizedPath,
      highRisk: false,
      reason: `Path is blocked for Grafana CRUD: ${normalizedPath}`
    };
  }

  const highRisk = HIGH_RISK.some((matcher) => matcher.test(normalizedPath));
  const sanitizedPayload = sanitizePayload(context?.payload);
  const sanitizedQuery = sanitizePayload(context?.query);
  const sanitizedBody = sanitizePayload(context?.body);
  const sanitizedHeaders = sanitizeHeaders(context?.headers);

  if (highRisk && isWriteMethod(normalizedMethod)) {
    const payloadConfirm = context?.payload && typeof context.payload.confirm === 'string' ? context.payload.confirm : undefined;
    const bodyConfirm = context?.body && typeof context.body.confirm === 'string' ? context.body.confirm : undefined;
    const confirmation = payloadConfirm ?? bodyConfirm;
    if (confirmation !== 'I_UNDERSTAND') {
      return {
        ok: false,
        normalizedMethod,
        normalizedPath,
        sanitizedPayload,
        sanitizedQuery,
        sanitizedBody,
        sanitizedHeaders,
        orgId: context?.orgId,
        highRisk,
        reason: `High-risk grafana ${normalizedMethod.toUpperCase()} requires payload/body confirm=I_UNDERSTAND for ${normalizedPath}`
      };
    }
  }

  return {
    ok: true,
    normalizedMethod,
    normalizedPath,
    sanitizedPayload,
    sanitizedQuery,
    sanitizedBody,
    sanitizedHeaders,
    orgId: context?.orgId,
    highRisk
  };
}

function normalizeMethod(method: GrafanaCrudMethod): 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' {
  switch (method) {
    case 'create':
      return 'post';
    case 'read':
      return 'get';
    case 'update':
      return 'put';
    case 'delete':
      return 'delete';
    case 'get':
    case 'post':
    case 'put':
    case 'patch':
    case 'head':
    case 'options':
      return method;
    default:
      return 'get';
  }
}

function isWriteMethod(method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'): boolean {
  return method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function sanitizePayload(payload?: GrafanaPayload): GrafanaPayload | undefined {
  if (!payload) {
    return undefined;
  }

  const clone: GrafanaPayload = { ...payload };
  delete clone.confirm;
  return Object.keys(clone).length > 0 ? clone : undefined;
}

function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  const clone: Record<string, string> = { ...headers };

  return Object.keys(clone).length > 0 ? clone : undefined;
}
