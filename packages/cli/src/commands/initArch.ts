import path from 'node:path';
import { access, constants, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { createInterface } from 'node:readline/promises';
import type { EnvironmentName } from '@naas/shared';
import { loadRuntimeConfig } from '../config/loadConfig.js';
import { getPrivateIpv4Candidates, isDocumentationCidr, toHostCidr, upsertEnvVar } from '../utils/adminCidr.js';

export interface InitArchCommandOptions {
  adminIp?: string;
  adminCidr?: string;
  yes?: boolean;
}

export interface InitArchCommandResult {
  ok: boolean;
  command: 'init-arch';
  profile: string;
  envFilePath: string;
  adminPcCidr: string;
  candidates: string[];
}

export async function runInitArch(
  env: EnvironmentName,
  options: InitArchCommandOptions = {}
): Promise<InitArchCommandResult> {
  const runtime = await loadRuntimeConfig(env);
  const workspaceRoot = runtime.workspaceRoot;
  const envFilePath = path.join(workspaceRoot, '.env');

  const candidates = getPrivateIpv4Candidates(os.networkInterfaces());

  let adminCidr = options.adminCidr?.trim();
  if (!adminCidr && options.adminIp?.trim()) {
    adminCidr = toHostCidr(options.adminIp.trim());
  }

  if (!adminCidr) {
    adminCidr = await resolveAdminCidrInteractively(candidates, Boolean(options.yes));
  }

  if (!adminCidr || isDocumentationCidr(adminCidr)) {
    throw new Error('Invalid admin CIDR resolved. Set a real LAN host CIDR (example format: 192.0.2.50/32).');
  }

  const existingContent = await readEnvFileIfExists(envFilePath);
  const nextContent = upsertEnvVar(existingContent, 'ADMIN_PC_CIDR', adminCidr);
  await writeFile(envFilePath, nextContent, 'utf8');

  return {
    ok: true,
    command: 'init-arch',
    profile: runtime.profile,
    envFilePath,
    adminPcCidr: adminCidr,
    candidates
  };
}

async function readEnvFileIfExists(filePath: string): Promise<string> {
  try {
    await access(filePath, constants.R_OK);
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function resolveAdminCidrInteractively(candidates: string[], autoConfirm: boolean): Promise<string> {
  if (candidates.length === 0) {
    throw new Error('No private IPv4 address detected on this machine. Use --admin-ip or --admin-cidr.');
  }

  if (candidates.length === 1 || autoConfirm) {
    const firstCandidate = candidates[0];
    if (!firstCandidate) {
      throw new Error('No private IPv4 candidate available.');
    }
    return toHostCidr(firstCandidate);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const options = candidates.map((ip, index) => `${index + 1}) ${ip}`).join('\n');
    const answer = await rl.question(
      `Select your admin LAN IP for firewall safety (or type a custom IPv4):\n${options}\nChoice [1-${candidates.length}]: `
    );

    const trimmed = answer.trim();
    const choice = Number(trimmed);
    if (Number.isInteger(choice) && choice >= 1 && choice <= candidates.length) {
      const selected = candidates[choice - 1];
      if (!selected) {
        throw new Error('Selected IP is unavailable.');
      }
      return toHostCidr(selected);
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
      return toHostCidr(trimmed);
    }

    throw new Error('Invalid selection. Provide a number from the list or a valid IPv4 address.');
  } finally {
    rl.close();
  }
}
