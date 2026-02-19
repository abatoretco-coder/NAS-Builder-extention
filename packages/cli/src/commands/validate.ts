import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { EnvironmentName, Plan, UnifiedState } from '@naas/shared';
import { loadRuntimeConfig } from '../config/loadConfig.js';
import { getGrafanaAuth } from '../config/secrets.js';
import { runPreflightChecks } from '../planner/preflight.js';
import { GrafanaProvider } from '../providers/grafana.js';

export interface ValidateCommandResult {
  ok: boolean;
  command: 'validate';
  profile: string;
  preflight: {
    ok: boolean;
    warnings: string[];
    errors: string[];
  };
  grafana?: {
    ok: boolean;
    details: string;
  };
}

export async function runValidate(env: EnvironmentName): Promise<ValidateCommandResult> {
  const runtime = await loadRuntimeConfig(env);
  const currentPath = path.join(runtime.stateDir, 'current.json');
  const planPath = path.join(runtime.stateDir, 'plan.json');

  const current = JSON.parse(await readFile(currentPath, 'utf8')) as UnifiedState;
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as Plan;

  const preflight = runPreflightChecks(current, { vms: [], composeProjects: [] }, plan);

  let grafanaResult: { ok: boolean; details: string } | undefined;
  const grafanaAuth = getGrafanaAuth(runtime.config);
  if (grafanaAuth) {
    const grafana = new GrafanaProvider(grafanaAuth);
    grafanaResult = await grafana.validate();
  }

  return {
    ok: preflight.ok && (grafanaResult ? grafanaResult.ok : true),
    command: 'validate',
    profile: runtime.profile,
    preflight: {
      ok: preflight.ok,
      warnings: preflight.warnings,
      errors: preflight.errors
    },
    grafana: grafanaResult
  };
}
