import { describe, expect, it, vi } from 'vitest';
import { DockerProvider } from '../src/providers/docker.js';

vi.mock('dockerode', () => ({
  default: vi.fn().mockImplementation(() => ({
    listContainers: vi.fn().mockResolvedValue([]),
    listImages: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listVolumes: vi.fn().mockResolvedValue({ Volumes: [] })
  }))
}));

vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ all: 'ok', stdout: 'ok' })
}));

function makeProvider(): DockerProvider {
  return new DockerProvider();
}

describe('DockerProvider path validation', () => {
  describe('redeployCompose', () => {
    it('throws for empty path', async () => {
      await expect(makeProvider().redeployCompose('')).rejects.toThrow(
        'non-empty string'
      );
    });

    it('throws for path containing null byte', async () => {
      await expect(makeProvider().redeployCompose('/some\0path')).rejects.toThrow(
        'non-empty string'
      );
    });

    it('throws for relative path with parent traversal', async () => {
      // './a/../b' normalizes to 'b', which differs from the original input
      await expect(makeProvider().redeployCompose('./a/../b')).rejects.toThrow(
        'invalid traversal sequences'
      );
    });

    it('accepts a valid absolute path', async () => {
      // process.cwd() is always an absolute, already-normalized path
      const result = await makeProvider().redeployCompose(process.cwd());
      expect(result).toBe('ok');
    });
  });

  describe('fetchComposeLogs', () => {
    it('throws for empty path', async () => {
      await expect(makeProvider().fetchComposeLogs('')).rejects.toThrow(
        'non-empty string'
      );
    });

    it('throws for path containing null byte', async () => {
      await expect(makeProvider().fetchComposeLogs('/some\0path')).rejects.toThrow(
        'non-empty string'
      );
    });

    it('throws for relative path with parent traversal', async () => {
      await expect(makeProvider().fetchComposeLogs('./a/../b')).rejects.toThrow(
        'invalid traversal sequences'
      );
    });

    it('accepts a valid absolute path', async () => {
      const result = await makeProvider().fetchComposeLogs(process.cwd());
      expect(result).toBe('ok');
    });
  });
});
