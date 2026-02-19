import type { UnifiedState } from '@naas/shared';
import type { EnvironmentName } from '@naas/shared';
import { DockerProvider, GrafanaProvider, ProxmoxProvider } from '../providers/index.js';
import type { GrafanaAuth, ProxmoxAuth } from '../config/secrets.js';

export interface ScanDeps {
  env: EnvironmentName;
  proxmoxAuth?: ProxmoxAuth;
  dockerHost?: string;
  grafanaAuth?: GrafanaAuth;
}

export async function scanInfrastructure(deps: ScanDeps): Promise<UnifiedState> {
  const warnings: string[] = [];

  let nodes: UnifiedState['compute']['nodes'] = [];
  let vms: UnifiedState['compute']['vms'] = [];
  let cts: UnifiedState['compute']['cts'] = [];
  let networks: NonNullable<UnifiedState['compute']['networks']> = [];
  let storage: NonNullable<UnifiedState['compute']['storage']> = [];
  let datacenter: UnifiedState['datacenter'] = undefined;
  let nodeAdmin: UnifiedState['nodeAdmin'] = undefined;

  if (deps.proxmoxAuth) {
    try {
      const proxmox = new ProxmoxProvider(deps.proxmoxAuth);
      await proxmox.initialize();
      const proxmoxState = await proxmox.scan();
      nodes = proxmoxState.nodes;
      vms = proxmoxState.vms;
      cts = proxmoxState.cts;
      networks = proxmoxState.networks;
      storage = proxmoxState.storage;
      datacenter = proxmoxState.datacenter;
      nodeAdmin = proxmoxState.nodeAdmin;
      warnings.push(...proxmoxState.warnings);
    } catch (error) {
      warnings.push(`Proxmox scan skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const docker = new DockerProvider({ host: deps.dockerHost });
  const dockerHostState = await docker.scan().catch((error) => {
    warnings.push(`Docker scan failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      host: deps.dockerHost ?? 'local',
      containers: [],
      images: [],
      networks: [],
      volumes: [],
      composeProjects: []
    };
  });

  let dashboards: UnifiedState['observability']['grafanaDashboards'] = [];
  let datasources: UnifiedState['observability']['grafanaDatasources'] = [];

  if (deps.grafanaAuth) {
    const grafana = new GrafanaProvider(deps.grafanaAuth);
    const grafanaState = await grafana.scan();
    dashboards = grafanaState.dashboards;
    datasources = grafanaState.datasources;
    warnings.push(...grafanaState.warnings);
  }

  return {
    generatedAt: new Date().toISOString(),
    env: deps.env,
    compute: { nodes, vms, cts, networks, storage },
    apps: { dockerHosts: [dockerHostState] },
    observability: {
      grafanaDashboards: dashboards,
      grafanaDatasources: datasources
    },
    datacenter,
    nodeAdmin,
    warnings
  };
}
