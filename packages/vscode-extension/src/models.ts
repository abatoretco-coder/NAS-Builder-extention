export interface ProxmoxConfig {
  endpoint: string;
  authRef?: string;
}

export interface DockerConfig {
  host?: string;
}

export interface GrafanaConfig {
  endpoint?: string;
  authRef?: string;
}

export interface NaaSProfile {
  name: string;
  proxmox?: ProxmoxConfig;
  docker?: DockerConfig;
  grafana?: GrafanaConfig;
  stateDir?: string;
}

export interface ProfilesFile {
  defaultProfile?: string;
  profiles: NaaSProfile[];
}

export interface WorkspaceOverridesFile {
  activeProfile?: string;
  profileOverrides?: Record<string, Partial<NaaSProfile>>;
}

export interface ResolvedProfile {
  profile: NaaSProfile;
  activeProfileName: string;
  workspaceFolderName?: string;
}

export interface CredentialsPayload {
  proxmoxTokenId?: string;
  proxmoxTokenSecret?: string;
  proxmoxUsername?: string;
  proxmoxPassword?: string;
  grafanaToken?: string;
}

export interface UnifiedState {
  generatedAt: string;
  profile: string;
  compute?: {
    nodes: Array<{ name: string; status: string }>;
    vms: Array<{ vmid: number; name: string; node: string; status: string }>;
    cts: Array<{ vmid: number; name: string; node: string; status: string }>;
    networks?: Array<{
      node: string;
      name: string;
      type: string;
      config: Record<string, string | number | boolean | undefined>;
    }>;
    storage?: Array<{
      name: string;
      type: string;
      config: Record<string, string | number | boolean | undefined>;
    }>;
  };
  apps?: {
    dockerHosts: Array<{
      host: string;
      composeProjects: Array<{ name: string; path?: string; containerIds: string[] }>;
      containers: Array<{ id: string; name: string; composeProject?: string; state: string }>;
    }>;
  };
  observability?: {
    grafanaDashboards: Array<{ uid: string; title: string }>;
  };
  warnings?: string[];
}

export interface PlanOutput {
  generatedAt: string;
  profile: string;
  actions: Array<Record<string, unknown> & { kind: string; reason: string }>;
}

export interface CliExecutionResult<T> {
  data: T;
  stdout: string;
  stderr: string;
  durationMs: number;
  logPath: string;
}
