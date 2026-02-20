import os from 'node:os';

const DOC_CIDR_PATTERNS = [/^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./];

export function isPrivateIpv4(ip: string): boolean {
  if (/^10\./.test(ip)) {
    return true;
  }
  if (/^192\.168\./.test(ip)) {
    return true;
  }
  const octets = ip.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) {
    return false;
  }
  return first === 172 && second >= 16 && second <= 31;
}

export function toHostCidr(ip: string): string {
  return `${ip}/32`;
}

export function getPrivateIpv4Candidates(networkInterfaces: ReturnType<typeof os.networkInterfaces>): string[] {
  const candidates = new Set<string>();
  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }
      if (isPrivateIpv4(entry.address)) {
        candidates.add(entry.address);
      }
    }
  }
  return Array.from(candidates);
}

export function isDocumentationCidr(cidr: string): boolean {
  const [ip = ''] = cidr.split('/', 1);
  return DOC_CIDR_PATTERNS.some((pattern) => pattern.test(ip));
}

export function upsertEnvVar(content: string, key: string, value: string): string {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const prefix = `${key}=`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index >= 0) {
    lines[index] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  return `${lines.filter((line, lineIndex) => line.length > 0 || lineIndex < lines.length - 1).join('\n')}\n`;
}
