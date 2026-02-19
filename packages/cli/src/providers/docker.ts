import path from 'node:path';
import Docker from 'dockerode';
import { execa } from 'execa';
import type { DockerHostState } from '@naas/shared';
import { withRetry } from '../utils/retry.js';

export interface DockerProviderOptions {
  host?: string;
}

export class DockerProvider {
  private readonly docker: Docker;
  private readonly hostDisplay: string;

  constructor(options?: DockerProviderOptions) {
    const host = options?.host ?? process.env.DOCKER_HOST;
    this.hostDisplay = host ?? 'local';

    if (host) {
      this.docker = this.fromDockerHost(host);
    } else {
      this.docker = new Docker();
    }
  }

  private fromDockerHost(host: string): Docker {
    if (host.startsWith('unix://')) {
      return new Docker({ socketPath: host.replace('unix://', '') });
    }

    if (host.startsWith('npipe://')) {
      return new Docker({ socketPath: host.replace('npipe://', '') });
    }

    const parsed = new URL(host);
    const protocol = parsed.protocol.replace(':', '');
    const normalizedProtocol = protocol === 'https' ? 'https' : protocol === 'ssh' ? 'ssh' : 'http';
    return new Docker({
      protocol: normalizedProtocol,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined
    });
  }

  async scan(): Promise<DockerHostState> {
    const [containersRaw, imagesRaw, networksRaw, volumesRaw] = await Promise.all([
      withRetry(() => this.docker.listContainers({ all: true })),
      withRetry(() => this.docker.listImages()),
      withRetry(() => this.docker.listNetworks()),
      withRetry(() => this.docker.listVolumes().then((v) => v.Volumes ?? []))
    ]);

    const containers = containersRaw.map((container) => {
      const labels = container.Labels ?? {};
      const composeProject = labels['com.docker.compose.project'];
      return {
        id: container.Id,
        name: container.Names?.[0]?.replace(/^\//, '') ?? container.Id.slice(0, 12),
        image: container.Image,
        state: container.State ?? 'unknown',
        status: container.Status ?? 'unknown',
        composeProject
      };
    });

    const composeMap = new Map<string, { name: string; path?: string; containerIds: string[] }>();
    for (const container of containers) {
      if (!container.composeProject) {
        continue;
      }
      const key = container.composeProject;
      const existing = composeMap.get(key);
      if (existing) {
        existing.containerIds.push(container.id);
      } else {
        composeMap.set(key, {
          name: key,
          path: undefined,
          containerIds: [container.id]
        });
      }
    }

    return {
      host: this.hostDisplay,
      containers,
      images: imagesRaw.map((image) => image.RepoTags?.[0] ?? image.Id),
      networks: networksRaw.map((network) => network.Name),
      volumes: volumesRaw.map((volume) => volume.Name),
      composeProjects: Array.from(composeMap.values())
    };
  }

  async redeployCompose(composePath: string): Promise<string> {
    validateComposePath(composePath);
    const result = await execa('docker', ['compose', 'up', '-d'], {
      cwd: composePath,
      all: true
    });

    return result.all ?? result.stdout;
  }

  async fetchComposeLogs(composePath: string, tail = 100): Promise<string> {
    validateComposePath(composePath);
    const result = await execa('docker', ['compose', 'logs', '--tail', String(tail)], {
      cwd: composePath,
      all: true
    });

    return result.all ?? result.stdout;
  }
}

function validateComposePath(composePath: string): void {
  if (!composePath || typeof composePath !== 'string' || composePath.includes('\0')) {
    throw new Error('Compose path must be a non-empty string without null bytes.');
  }
  const normalized = path.normalize(composePath);
  if (normalized !== composePath && !path.isAbsolute(composePath)) {
    throw new Error(`Compose path contains invalid traversal sequences: ${composePath}`);
  }
}
