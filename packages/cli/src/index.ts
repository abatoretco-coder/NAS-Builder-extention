#!/usr/bin/env node
import { Command } from 'commander';
import type { EnvironmentName } from '@naas/shared';
import { runScan } from './commands/scan.js';
import { runPlan } from './commands/plan.js';
import { runApply } from './commands/apply.js';
import { runValidate } from './commands/validate.js';
import { ConfigError } from './utils/errors.js';

interface CommonCliOptions {
  profile?: string;
  env?: string;
  json?: boolean;
  verbose?: boolean;
}

const program = new Command();

program.name('naasctl').description('NAS assistant CLI').version('0.1.0');

program
  .command('scan')
  .option('--profile <name>', 'Profile name')
  .option('--env <env>', 'Deprecated alias for profile')
  .option('--json', 'Print structured JSON output', false)
  .option('--verbose', 'Print additional details', false)
  .action(async (options: CommonCliOptions) => {
    const profile = resolveProfile(options);
    const result = await runScan(profile);
    renderOutput(result, options);
  });

program
  .command('plan')
  .option('--profile <name>', 'Profile name')
  .option('--env <env>', 'Deprecated alias for profile')
  .option('--json', 'Print structured JSON output', false)
  .option('--verbose', 'Print additional details', false)
  .action(async (options: CommonCliOptions) => {
    const profile = resolveProfile(options);
    const result = await runPlan(profile);
    renderOutput(result, options);
  });

program
  .command('apply')
  .option('--profile <name>', 'Profile name')
  .option('--env <env>', 'Deprecated alias for profile')
  .option('--dry-run', 'Do not execute actions', false)
  .option('--yes', 'Skip confirmation prompt', false)
  .option('--json', 'Print structured JSON output', false)
  .option('--verbose', 'Print additional details', false)
  .action(async (options: CommonCliOptions & { dryRun: boolean; yes: boolean }) => {
    const profile = resolveProfile(options);
    const result = await runApply(profile, {
      dryRun: options.dryRun,
      yes: options.yes
    });
    renderOutput(result, options);
    if (!result.ok) {
      process.exitCode = 1;
    }
  });

program
  .command('validate')
  .option('--profile <name>', 'Profile name')
  .option('--env <env>', 'Deprecated alias for profile')
  .option('--json', 'Print structured JSON output', false)
  .option('--verbose', 'Print additional details', false)
  .action(async (options: CommonCliOptions) => {
    const profile = resolveProfile(options);
    const result = await runValidate(profile);
    renderOutput(result, options);
    if (!result.ok) {
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`naasctl failed: ${message}`);
  if (error instanceof ConfigError) {
    process.exit(2);
  }
  process.exit(1);
});

function resolveProfile(options: CommonCliOptions): EnvironmentName {
  const profile = options.profile?.trim() || options.env?.trim() || process.env.NAAS_PROFILE?.trim();
  if (!profile) {
    throw new ConfigError('Missing profile. Use --profile <name> (or --env <name> for backward compatibility).');
  }
  return profile;
}

function renderOutput(result: { ok?: boolean; command?: string; profile?: string } & object, options: CommonCliOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result));
    return;
  }

  const command = typeof result.command === 'string' ? result.command : 'command';
  const profile = typeof result.profile === 'string' ? result.profile : 'unknown';
  const ok = result.ok === true ? 'ok' : 'failed';
  console.log(`${command} (${profile}): ${ok}`);

  if (options.verbose) {
    console.log(JSON.stringify(result, null, 2));
  }
}
