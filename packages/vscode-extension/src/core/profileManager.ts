import path from 'node:path';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import yaml from 'js-yaml';
import * as vscode from 'vscode';
import { z } from 'zod';
import { DEFAULT_PROFILES_PATH } from '../constants.js';
import type { NaaSProfile, ProfilesFile, ResolvedProfile, WorkspaceOverridesFile } from '../models.js';
import { defaultStateDir, expandTilde } from './pathUtils.js';
import type { WorkspaceSelection } from './workspaceResolver.js';

const profileSchema = z.object({
  name: z.string().min(1),
  proxmox: z
    .object({
      endpoint: z.string().url(),
      authRef: z.string().optional()
    })
    .optional(),
  docker: z
    .object({
      host: z.string().optional()
    })
    .optional(),
  grafana: z
    .object({
      endpoint: z.string().url().optional(),
      authRef: z.string().optional()
    })
    .optional(),
  stateDir: z.string().optional()
});

const profilesFileSchema = z.object({
  defaultProfile: z.string().optional(),
  profiles: z.array(profileSchema)
});

const workspaceOverridesSchema = z.object({
  activeProfile: z.string().optional(),
  profileOverrides: z.record(z.string(), profileSchema.partial()).optional()
});

export class ProfileManager {
  private readonly profilesPath: string;

  constructor() {
    const cfg = vscode.workspace.getConfiguration('naas');
    this.profilesPath = expandTilde(cfg.get<string>('profilesPath', DEFAULT_PROFILES_PATH));
  }

  async ensureProfilesFile(): Promise<void> {
    try {
      await access(this.profilesPath, constants.R_OK);
      return;
    } catch {
      const parent = path.dirname(this.profilesPath);
      await mkdir(parent, { recursive: true });
      const starter: ProfilesFile = {
        defaultProfile: 'preprod',
        profiles: [
          {
            name: 'preprod',
            proxmox: { endpoint: 'https://proxmox-preprod.local:8006', authRef: 'proxmox-preprod' },
            docker: { host: 'unix:///var/run/docker.sock' },
            grafana: { endpoint: 'https://grafana-preprod.local', authRef: 'grafana-preprod' }
          }
        ]
      };
      await writeFile(this.profilesPath, yaml.dump(starter), 'utf8');
    }
  }

  async listProfiles(): Promise<ProfilesFile> {
    await this.ensureProfilesFile();
    const content = await readFile(this.profilesPath, 'utf8');
    const parsed = yaml.load(content);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'profiles' in parsed) {
      return profilesFileSchema.parse(parsed);
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>).map(([name, value]) => ({
        ...(typeof value === 'object' && value ? (value as object) : {}),
        name
      }));
      return profilesFileSchema.parse({ profiles: entries });
    }

    throw new Error(`Invalid profiles file at ${this.profilesPath}`);
  }

  async resolveActiveProfile(selection: WorkspaceSelection): Promise<ResolvedProfile> {
    const file = await this.listProfiles();

    const workspaceCfg = selection.folder
      ? vscode.workspace.getConfiguration('naas', selection.folder.uri)
      : vscode.workspace.getConfiguration('naas');

    const settingsActiveProfile = workspaceCfg.get<string>('activeProfile', '').trim();
    const settingsProfileOverrides = workspaceCfg.get<Record<string, Partial<NaaSProfile>>>('profileOverrides', {});

    const fileOverrides = await this.workspaceFileOverrides(selection.folder);
    const activeProfileName =
      settingsActiveProfile || fileOverrides.activeProfile || file.defaultProfile || file.profiles[0]?.name;

    if (!activeProfileName) {
      throw new Error('No profile found. Add one in ~/.naas/profiles.yaml or set naas.activeProfile.');
    }

    const baseProfile = file.profiles.find((profile) => profile.name === activeProfileName);
    if (!baseProfile) {
      throw new Error(`Profile ${activeProfileName} not found in ${this.profilesPath}`);
    }

    const merged = mergeProfile(baseProfile, fileOverrides.profileOverrides?.[activeProfileName], settingsProfileOverrides[activeProfileName]);

    return {
      profile: {
        ...merged,
        stateDir: expandTilde(merged.stateDir ?? defaultStateDir(merged.name))
      },
      activeProfileName,
      workspaceFolderName: selection.folder?.name
    };
  }

  private async workspaceFileOverrides(folder?: vscode.WorkspaceFolder): Promise<WorkspaceOverridesFile> {
    if (!folder) {
      return {};
    }

    const filePath = path.join(folder.uri.fsPath, '.vscode', 'naas.yaml');
    try {
      const content = await readFile(filePath, 'utf8');
      return workspaceOverridesSchema.parse(yaml.load(content));
    } catch {
      return {};
    }
  }
}

function mergeProfile(
  base: NaaSProfile,
  workspaceOverrides?: Partial<NaaSProfile>,
  settingsOverrides?: Partial<NaaSProfile>
): NaaSProfile {
  const proxmoxMerged = {
    ...base.proxmox,
    ...workspaceOverrides?.proxmox,
    ...settingsOverrides?.proxmox
  };

  const dockerMerged = {
    ...base.docker,
    ...workspaceOverrides?.docker,
    ...settingsOverrides?.docker
  };

  const grafanaMerged = {
    ...base.grafana,
    ...workspaceOverrides?.grafana,
    ...settingsOverrides?.grafana
  };

  return {
    ...base,
    ...workspaceOverrides,
    ...settingsOverrides,
    proxmox: proxmoxMerged.endpoint
      ? {
          endpoint: proxmoxMerged.endpoint,
          authRef: proxmoxMerged.authRef
        }
      : undefined,
    docker: Object.keys(dockerMerged).length > 0 ? dockerMerged : undefined,
    grafana: Object.keys(grafanaMerged).length > 0 ? grafanaMerged : undefined
  };
}

export { mergeProfile };
