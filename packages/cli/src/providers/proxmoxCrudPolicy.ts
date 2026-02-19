export type GenericCrudMethod = 'create' | 'read' | 'update' | 'delete';
export type GenericCrudScope = 'datacenter' | 'node';

export type CrudPayload = Record<string, string | number | boolean | undefined>;

export interface CrudPolicyResult {
  ok: boolean;
  normalizedPath: string;
  sanitizedPayload?: CrudPayload;
  highRisk: boolean;
  reason?: string;
}

const DATACENTER_ALLOWED_PREFIXES = ['/access', '/cluster', '/storage', '/pools', '/version'];
const NODE_ALLOWED_PREFIXES = ['/network', '/dns', '/hosts', '/config', '/time', '/syslog', '/apt', '/firewall', '/disks', '/status'];

const GENERIC_DENY_SEGMENTS = ['/qemu', '/lxc', '/vncproxy', '/termproxy', '/spiceproxy', '/agent', '/migrate'];

const DATACENTER_HIGH_RISK = [/^\/access\//i, /^\/storage(\/|$)/i, /^\/cluster\/(ceph|firewall|backup|replication)/i];
const NODE_HIGH_RISK = [/^\/network(\/|$)/i, /^\/firewall(\/|$)/i, /^\/disks(\/|$)/i, /^\/apt(\/|$)/i, /^\/config(\/|$)/i];

const WRITE_METHODS: GenericCrudMethod[] = ['create', 'update', 'delete'];

export function evaluateGenericCrudPolicy(
  scope: GenericCrudScope,
  method: GenericCrudMethod,
  rawPath: string,
  payload?: CrudPayload
): CrudPolicyResult {
  const normalizedPath = normalizePath(rawPath);
  if (!normalizedPath) {
    return {
      ok: false,
      normalizedPath: '/',
      highRisk: false,
      reason: 'Generic CRUD path is required'
    };
  }

  if (normalizedPath.includes('..')) {
    return {
      ok: false,
      normalizedPath,
      highRisk: false,
      reason: `Path traversal is not allowed: ${normalizedPath}`
    };
  }

  const allowedPrefixes = scope === 'datacenter' ? DATACENTER_ALLOWED_PREFIXES : NODE_ALLOWED_PREFIXES;
  if (!allowedPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
    return {
      ok: false,
      normalizedPath,
      highRisk: false,
      reason: `${scope} generic CRUD path is not allowlisted: ${normalizedPath}`
    };
  }

  if (GENERIC_DENY_SEGMENTS.some((segment) => normalizedPath.toLowerCase().includes(segment))) {
    return {
      ok: false,
      normalizedPath,
      highRisk: false,
      reason: `Path is blocked for generic CRUD (use typed action): ${normalizedPath}`
    };
  }

  const highRiskMatchers = scope === 'datacenter' ? DATACENTER_HIGH_RISK : NODE_HIGH_RISK;
  const highRisk = highRiskMatchers.some((matcher) => matcher.test(normalizedPath));

  const sanitizedPayload = sanitizePayload(payload);
  if (highRisk && WRITE_METHODS.includes(method)) {
    const confirmation = payload?.confirm;
    if (confirmation !== 'I_UNDERSTAND') {
      return {
        ok: false,
        normalizedPath,
        sanitizedPayload,
        highRisk,
        reason: `High-risk ${scope} ${method} requires payload.confirm=I_UNDERSTAND for ${normalizedPath}`
      };
    }
  }

  return {
    ok: true,
    normalizedPath,
    sanitizedPayload,
    highRisk
  };
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function sanitizePayload(payload?: CrudPayload): CrudPayload | undefined {
  if (!payload) {
    return undefined;
  }

  const clone: CrudPayload = { ...payload };
  delete clone.confirm;
  return Object.keys(clone).length > 0 ? clone : undefined;
}
