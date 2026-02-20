import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { EnvironmentName, UnifiedState } from '@naas/shared';
import { loadRuntimeConfig, resolvePath } from '../config/loadConfig.js';
import { loadDesiredSpec } from '../state/desired.js';
import { buildPlan } from '../planner/planner.js';
import { buildEnrichedPlan } from '../planner/enrichedPlan.js';
import { runPreflightChecks } from '../planner/preflight.js';
import { writeJsonFile } from '../utils/fs.js';

export interface PlanCommandResult {
  ok: boolean;
  command: 'plan';
  profile: string;
  outputPath: string;
  enrichedOutputPath: string;
  actions: number;
  preflight: {
    ok: boolean;
    warnings: string[];
    errors: string[];
  };
}

export async function runPlan(env: EnvironmentName): Promise<PlanCommandResult> {
  const runtime = await loadRuntimeConfig(env);
  const currentPath = path.join(runtime.stateDir, 'current.json');
  const current = JSON.parse(await readFile(currentPath, 'utf8')) as UnifiedState;

  const desiredPath = resolvePath(runtime.workspaceRoot, runtime.config.desiredSpecPath);
  const desired = await loadDesiredSpec(desiredPath);

  const plan = buildPlan(current, desired);
  const preflight = runPreflightChecks(current, desired, plan);

  if (!preflight.ok) {
    throw new Error('Preflight checks failed. Plan was not written.');
  }

  const outputPath = path.join(runtime.stateDir, 'plan.json');
  await writeJsonFile(outputPath, plan);
  const enrichedOutputPath = path.join(runtime.stateDir, 'plan.enriched.json');
  await writeJsonFile(enrichedOutputPath, buildEnrichedPlan(plan));

  return {
    ok: true,
    command: 'plan',
    profile: runtime.profile,
    outputPath,
    enrichedOutputPath,
    actions: plan.actions.length,
    preflight: {
      ok: preflight.ok,
      warnings: preflight.warnings,
      errors: preflight.errors
    }
  };
}
