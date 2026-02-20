import { describe, expect, it } from 'vitest';
import { getPrivateIpv4Candidates, isDocumentationCidr, toHostCidr, upsertEnvVar } from '../src/utils/adminCidr.js';

describe('adminCidr utils', () => {
  it('extracts private non-internal IPv4 addresses', () => {
    const candidates = getPrivateIpv4Candidates({
      Ethernet: [
        {
          address: '10.10.10.50',
          family: 'IPv4',
          internal: false,
          netmask: '255.255.255.0',
          cidr: '10.10.10.50/24',
          mac: '00:11:22:33:44:55'
        }
      ],
      Loopback: [
        {
          address: '127.0.0.1',
          family: 'IPv4',
          internal: true,
          netmask: '255.0.0.0',
          cidr: '127.0.0.1/8',
          mac: '00:00:00:00:00:00'
        }
      ]
    });

    expect(candidates).toEqual(['10.10.10.50']);
  });

  it('detects documentation CIDR ranges', () => {
    expect(isDocumentationCidr('192.0.2.50/32')).toBe(true);
    expect(isDocumentationCidr('10.10.10.50/32')).toBe(false);
  });

  it('upserts ADMIN_PC_CIDR in env content', () => {
    const content = 'FOO=bar\nADMIN_PC_CIDR=10.10.10.10/32\n';
    const next = upsertEnvVar(content, 'ADMIN_PC_CIDR', toHostCidr('10.10.10.50'));
    expect(next).toContain('ADMIN_PC_CIDR=10.10.10.50/32');
    expect(next).not.toContain('10.10.10.10/32');
  });
});
