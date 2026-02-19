import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { EnvironmentName, Plan, UnifiedState } from '@naas/shared';
import { loadRuntimeConfig, resolvePath } from '../config/loadConfig.js';
import { getGrafanaAuth, getProxmoxAuth } from '../config/secrets.js';
import { DockerProvider, GrafanaProvider, ProxmoxProvider } from '../providers/index.js';
import { executePlan } from '../planner/executor.js';
import { runPreflightChecks } from '../planner/preflight.js';
import { loadDesiredSpec } from '../state/desired.js';
import { consoleLogger } from '../utils/logger.js';
import { writeJsonFile } from '../utils/fs.js';

export interface ApplyCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export interface ApplyCommandResult {
  ok: boolean;
  command: 'apply';
  profile: string;
  dryRun: boolean;
  outputPath: string;
  logPath: string;
  auditPath: string;
  result: Awaited<ReturnType<typeof executePlan>>;
}

export async function runApply(env: EnvironmentName, options: ApplyCommandOptions): Promise<ApplyCommandResult> {
  const runtime = await loadRuntimeConfig(env);
  const currentPath = path.join(runtime.stateDir, 'current.json');
  const planPath = path.join(runtime.stateDir, 'plan.json');
  const current = JSON.parse(await readFile(currentPath, 'utf8')) as UnifiedState;
  const desiredPath = resolvePath(runtime.workspaceRoot, runtime.config.desiredSpecPath);
  const desired = await loadDesiredSpec(desiredPath);
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as Plan;

  const preflight = runPreflightChecks(current, desired, plan);
  for (const warning of preflight.warnings) {
    console.warn(`[preflight][warning] ${warning}`);
  }
  if (!preflight.ok) {
    for (const error of preflight.errors) {
      console.error(`[preflight][error] ${error}`);
    }
    throw new Error('Preflight checks failed. Apply aborted.');
  }

  const proxmoxAuth = getProxmoxAuth(runtime.config);
  const grafanaAuth = getGrafanaAuth(runtime.config);

  let proxmox: ProxmoxProvider | undefined;
  if (proxmoxAuth) {
    proxmox = new ProxmoxProvider(proxmoxAuth);
    await proxmox.initialize();
  }

  const docker = new DockerProvider({ host: runtime.config.docker?.host });
  const grafana = grafanaAuth ? new GrafanaProvider(grafanaAuth) : undefined;

  const result = await executePlan(
    plan,
    {
      proxmox,
      docker,
      grafana,
      logger: consoleLogger
    },
    {
      dryRun: Boolean(options.dryRun),
      yes: Boolean(options.yes)
    }
  );

  await mkdir(runtime.stateDir, { recursive: true });
  const logPath = path.join(runtime.stateDir, `apply-${Date.now()}.log.json`);
  await writeFile(logPath, JSON.stringify(result.results, null, 2), 'utf8');

  const auditPath = path.join(runtime.stateDir, 'audit.jsonl');
  const auditLines = result.results.map((item) => {
    const record = {
      timestamp: item.finishedAt,
      profile: runtime.profile,
      action: item.action.kind,
      endpoint: endpointForAction(item.action),
      success: item.success,
      message: item.message
    };
    return JSON.stringify(record);
  });
  if (auditLines.length > 0) {
    await writeFile(auditPath, `${auditLines.join('\n')}\n`, { encoding: 'utf8', flag: 'a' });
  }

  const outputPath = path.join(runtime.stateDir, 'result.json');
  await writeJsonFile(outputPath, result);

  return {
    ok: result.ok,
    command: 'apply',
    profile: runtime.profile,
    dryRun: Boolean(options.dryRun),
    outputPath,
    logPath,
    auditPath,
    result
  };
}

function endpointForAction(action: Plan['actions'][number]): string {
  if ('path' in action && typeof action.path === 'string') {
    return action.path;
  }

  if ('node' in action && 'vmid' in action && typeof action.node === 'string' && typeof action.vmid === 'number') {
    return `/nodes/${action.node}/${action.vmid}`;
  }

  if ('config' in action && action.config && typeof action.config === 'object') {
    const value = action.config as Record<string, unknown>;
    const node = typeof value.node === 'string' ? value.node : undefined;
    const vmid = typeof value.vmid === 'number' ? value.vmid : undefined;
    if (node && vmid !== undefined) {
      return `/nodes/${node}/${vmid}`;
    }
  }

  return action.kind;
}
