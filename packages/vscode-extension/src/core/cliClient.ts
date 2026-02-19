import path from 'node:path';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execa } from 'execa';
import * as vscode from 'vscode';
import type { CliExecutionResult, CredentialsPayload, NaaSProfile, PlanOutput, UnifiedState } from '../models.js';
import type { Logger } from './logger.js';

interface CliArgs {
  profile: NaaSProfile;
  credentials?: CredentialsPayload;
  timeoutMs: number;
  cancellationToken?: vscode.CancellationToken;
  workspaceFolder?: vscode.WorkspaceFolder;
}

const CREDENTIAL_KEYS: ReadonlyArray<keyof CredentialsPayload> = [
  'proxmoxTokenId',
  'proxmoxTokenSecret',
  'proxmoxUsername',
  'proxmoxPassword',
  'grafanaToken'
];

export class CliClient {
  constructor(private readonly context: vscode.ExtensionContext, private readonly logger: Logger) {}

  async scan(args: CliArgs): Promise<CliExecutionResult<UnifiedState>> {
    return this.runJsonCommand<UnifiedState>('scan', args);
  }

  async plan(args: CliArgs): Promise<CliExecutionResult<PlanOutput>> {
    return this.runJsonCommand<PlanOutput>('plan', args);
  }

  async apply(args: CliArgs): Promise<CliExecutionResult<Record<string, unknown>>> {
    return this.runJsonCommand<Record<string, unknown>>('apply', args);
  }

  async validate(args: CliArgs): Promise<CliExecutionResult<Record<string, unknown>>> {
    return this.runJsonCommand<Record<string, unknown>>('validate', args);
  }

  private async runJsonCommand<T>(
    action: 'scan' | 'plan' | 'apply' | 'validate',
    args: CliArgs
  ): Promise<CliExecutionResult<T>> {
    const start = Date.now();
    const { command, commandArgs } = await this.resolveCommand(action, args.profile.name);
    const env = this.buildEnv(args.profile, args.credentials);

    const abortController = new AbortController();
    args.cancellationToken?.onCancellationRequested(() => abortController.abort());

    const result = await execa(command, commandArgs, {
      cwd: args.workspaceFolder?.uri.fsPath,
      env,
      all: true,
      timeout: args.timeoutMs,
      reject: false,
      cancelSignal: abortController.signal
    });

    const durationMs = Date.now() - start;
    const logPath = await this.logger.write(`naasctl-${action}`, {
      timestamp: new Date().toISOString(),
      command,
      args: commandArgs,
      cwd: args.workspaceFolder?.uri.fsPath,
      exitCode: result.exitCode,
      stdout: scrubSecrets(result.stdout, args.credentials),
      stderr: scrubSecrets(result.stderr, args.credentials),
      all: scrubSecrets(result.all, args.credentials),
      durationMs
    });

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || result.all || `naasctl ${action} failed`);
    }

    const parsed = parseJsonOutput<T>(result.stdout || result.all || '');

    return {
      data: parsed,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs,
      logPath
    };
  }

  private buildEnv(profile: NaaSProfile, credentials?: CredentialsPayload): Record<string, string> {
    const env: Record<string, string> = {
      ...process.env,
      NAAS_PROFILE: profile.name,
      ...(profile.proxmox?.endpoint ? { PROXMOX_ENDPOINT: profile.proxmox.endpoint } : {}),
      ...(profile.docker?.host ? { DOCKER_HOST: profile.docker.host } : {}),
      ...(profile.grafana?.endpoint ? { GRAFANA_ENDPOINT: profile.grafana.endpoint } : {}),
      ...(profile.stateDir ? { NAAS_STATE_DIR: profile.stateDir } : {})
    } as Record<string, string>;

    if (credentials) {
      if (credentials.proxmoxTokenId) env.PROXMOX_TOKEN_ID = credentials.proxmoxTokenId;
      if (credentials.proxmoxTokenSecret) env.PROXMOX_TOKEN_SECRET = credentials.proxmoxTokenSecret;
      if (credentials.proxmoxUsername) env.PROXMOX_USERNAME = credentials.proxmoxUsername;
      if (credentials.proxmoxPassword) env.PROXMOX_PASSWORD = credentials.proxmoxPassword;
      if (credentials.grafanaToken) env.GRAFANA_TOKEN = credentials.grafanaToken;
    }

    return env;
  }

  private async resolveCommand(action: string, profileName: string): Promise<{ command: string; commandArgs: string[] }> {
    const cfg = vscode.workspace.getConfiguration('naas');
    const configuredPath = cfg.get<string>('cliPath', '').trim();

    if (configuredPath) {
      return {
        command: configuredPath,
        commandArgs: [action, '--profile', profileName, '--json']
      };
    }

    const bundled = this.context.asAbsolutePath(path.join('bin', platformSubdir(), binaryName()));
    if (await exists(bundled)) {
      return {
        command: bundled,
        commandArgs: [action, '--profile', profileName, '--json']
      };
    }

    return {
      command: 'naasctl',
      commandArgs: [action, '--profile', profileName, '--json']
    };
  }
}

function scrubSecrets(text: string | undefined, credentials?: CredentialsPayload): string | undefined {
  if (!text || !credentials) {
    return text;
  }
  let scrubbed = text;
  for (const key of CREDENTIAL_KEYS) {
    const value = credentials[key];
    if (value && typeof value === 'string' && value.length >= 8) {
      scrubbed = scrubbed.replaceAll(value, '[REDACTED]');
    }
  }
  return scrubbed;
}

function parseJsonOutput<T>(output: string): T {
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error('naasctl returned empty output; expected JSON on stdout.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reverse();

    for (const line of lines) {
      try {
        parsed = JSON.parse(line);
        break;
      } catch {
        continue;
      }
    }

    if (parsed === undefined) {
      throw new Error('Unable to parse JSON from naasctl output.');
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('naasctl returned unexpected output: expected a JSON object.');
  }

  return parsed as T;
}

function platformSubdir(): string {
  if (process.platform === 'win32') {
    return 'win32';
  }
  if (process.platform === 'darwin') {
    return 'darwin';
  }
  return 'linux';
}

function binaryName(): string {
  return process.platform === 'win32' ? 'naasctl.exe' : 'naasctl';
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
