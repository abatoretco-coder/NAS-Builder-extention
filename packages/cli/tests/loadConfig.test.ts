import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePath } from '../src/config/loadConfig.js';

describe('resolvePath', () => {
  it('resolves relative paths against the workspace root', () => {
    const result = resolvePath('/workspace', 'configs/spec.yaml');
    expect(result).toBe(path.resolve('/workspace', 'configs/spec.yaml'));
  });

  it('returns normalized absolute paths unchanged', () => {
    const result = resolvePath('/workspace', '/etc/naas/spec.yaml');
    expect([path.normalize('/etc/naas/spec.yaml'), path.posix.normalize('/etc/naas/spec.yaml')]).toContain(result);
  });

  it('normalizes absolute paths that contain redundant segments', () => {
    const result = resolvePath('/workspace', '/etc//naas/../spec.yaml');
    expect([path.normalize('/etc//naas/../spec.yaml'), path.posix.normalize('/etc//naas/../spec.yaml')]).toContain(result);
  });

  it('resolves relative traversal paths against the workspace', () => {
    const result = resolvePath('/home/user/project', '../other/spec.yaml');
    expect(result).toBe(path.resolve('/home/user/project', '../other/spec.yaml'));
  });

  it('handles a dot-relative path correctly', () => {
    const result = resolvePath('/workspace', './subdir/spec.yaml');
    expect(result).toBe(path.resolve('/workspace', './subdir/spec.yaml'));
  });

  it('handles a filename-only input', () => {
    const result = resolvePath('/workspace', 'spec.yaml');
    expect(result).toBe(path.resolve('/workspace', 'spec.yaml'));
  });
});
