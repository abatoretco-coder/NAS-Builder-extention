import path from 'node:path';
import type { EnvironmentName } from '@naas/shared';
import { loadRuntimeConfig } from '../config/loadConfig.js';
import { getGrafanaAuth, getProxmoxAuth } from '../config/secrets.js';
import { scanInfrastructure } from '../scan/scanInfrastructure.js';
import { writeJsonFile } from '../utils/fs.js';

export interface ScanCommandResult {
  ok: boolean;
  command: 'scan';
  profile: string;
  outputPath: string;
  warnings: string[];
}

export async function runScan(env: EnvironmentName): Promise<ScanCommandResult> {
  const runtime = await loadRuntimeConfig(env);
  const state = await scanInfrastructure({
    env,
    proxmoxAuth: getProxmoxAuth(runtime.config),
    dockerHost: runtime.config.docker?.host,
    grafanaAuth: getGrafanaAuth(runtime.config)
  });

  const outputPath = path.join(runtime.stateDir, 'current.json');
  await writeJsonFile(outputPath, state);

  return {
    ok: true,
    command: 'scan',
    profile: runtime.profile,
    outputPath,
    warnings: state.warnings
  };
}
