import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import process from 'node:process';
import dotenv from 'dotenv';
import yaml from 'js-yaml';
import type { ConfigFile, EnvironmentName } from '@naas/shared';
import { ConfigError } from '../utils/errors.js';

export interface RuntimeConfig {
  env: EnvironmentName;
  profile: string;
  workspaceRoot: string;
  stateDir: string;
  configPath: string;
  config: ConfigFile;
}

function findWorkspaceRoot(): string {
  return process.cwd();
}

function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)(:-([^}]*))?\}/gi, (_match, envVar: string, _defaultClause, defaultValue: string | undefined) => {
    const resolved = process.env[envVar];
    if (resolved && resolved.length > 0) {
      return resolved;
    }
    return defaultValue ?? '';
  });
}

export async function loadRuntimeConfig(env: EnvironmentName): Promise<RuntimeConfig> {
  dotenv.config();

  const workspaceRoot = findWorkspaceRoot();
  const configPath = path.join(workspaceRoot, 'configs', `${env}.yaml`);
  const parsed = await loadConfigFileOrEnv(configPath, env);
  if (!parsed.desiredSpecPath) {
    throw new ConfigError(`Invalid runtime config for profile ${env}: missing desiredSpecPath.`);
  }

  return {
    env,
    profile: String(env),
    workspaceRoot,
    stateDir: process.env.NAAS_STATE_DIR ? path.resolve(process.env.NAAS_STATE_DIR) : path.join(workspaceRoot, 'state'),
    configPath,
    config: parsed
  };
}

async function loadConfigFileOrEnv(configPath: string, profile: string): Promise<ConfigFile> {
  try {
    await access(configPath, constants.R_OK);
    const raw = await readFile(configPath, 'utf8');
    const expanded = expandEnv(raw);
    const parsed = yaml.load(expanded) as ConfigFile;
    if (!parsed || typeof parsed !== 'object') {
      throw new ConfigError(`Invalid config file: ${configPath}`);
    }
    return parsed;
  } catch {
    const desiredSpecPath = process.env.NAAS_DESIRED_SPEC ?? `specs/${profile}.desired.yaml`;
    const proxmoxEndpoint = process.env.PROXMOX_ENDPOINT;
    const dockerHost = process.env.DOCKER_HOST;
    const grafanaEndpoint = process.env.GRAFANA_ENDPOINT;

    return {
      desiredSpecPath,
      proxmox: proxmoxEndpoint
        ? {
            endpoint: proxmoxEndpoint,
            tokenIdEnv: process.env.PROXMOX_TOKEN_ID ? 'PROXMOX_TOKEN_ID' : undefined,
            tokenSecretEnv: process.env.PROXMOX_TOKEN_SECRET ? 'PROXMOX_TOKEN_SECRET' : undefined,
            usernameEnv: process.env.PROXMOX_USERNAME ? 'PROXMOX_USERNAME' : undefined,
            passwordEnv: process.env.PROXMOX_PASSWORD ? 'PROXMOX_PASSWORD' : undefined
          }
        : undefined,
      docker: dockerHost ? { host: dockerHost } : undefined,
      grafana: grafanaEndpoint
        ? {
            endpoint: grafanaEndpoint,
            tokenEnv: process.env.GRAFANA_TOKEN ? 'GRAFANA_TOKEN' : undefined
          }
        : undefined
    };
  }
}

export function resolvePath(workspaceRoot: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.resolve(workspaceRoot, filePath);
}
