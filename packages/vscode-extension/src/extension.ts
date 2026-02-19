import * as vscode from 'vscode';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { COMMANDS, VIEW_ID } from './constants.js';
import { CliClient } from './core/cliClient.js';
import { Logger } from './core/logger.js';
import { ProfileManager } from './core/profileManager.js';
import { deleteCredentials, getCredentials, saveCredentials } from './core/secretManager.js';
import { StateCache } from './core/stateCache.js';
import { resolveWorkspaceFolder } from './core/workspaceResolver.js';
import type { CredentialsPayload, ResolvedProfile } from './models.js';
import { showPlanWebview } from './ui/planWebview.js';
import { StatusBarController } from './ui/statusBar.js';
import { InfrastructureTreeProvider } from './ui/treeProvider.js';

interface NasSetupInputs {
  node: string;
  bridge: string;
  interfaceName: string;
  storage: string;
  vmId: number;
  ctId: number;
  sshPublicKey?: string;
}

interface SetupPrecheckResult {
  errors: string[];
  warnings: string[];
}

const NAS_CT_OSTEMPLATE = 'local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst';

function parseStorageFromOstemplate(ostemplate: string): string | undefined {
  const idx = ostemplate.indexOf(':');
  if (idx <= 0) {
    return undefined;
  }
  return ostemplate.slice(0, idx);
}

function storageSupportsVztmpl(content: unknown): boolean {
  if (Array.isArray(content)) {
    return content.some((entry: unknown) => typeof entry === 'string' && entry.trim().toLowerCase() === 'vztmpl');
  }

  if (typeof content === 'string') {
    return content
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .includes('vztmpl');
  }

  return false;
}

function hasProxmoxCredentials(credentials: CredentialsPayload | undefined): boolean {
  if (!credentials) {
    return false;
  }

  const hasToken = Boolean(credentials.proxmoxTokenId && credentials.proxmoxTokenSecret);
  const hasUserPass = Boolean(credentials.proxmoxUsername && credentials.proxmoxPassword);
  return hasToken || hasUserPass;
}

async function runSetupPrecheck(
  cli: CliClient,
  resolved: ResolvedProfile,
  credentials: CredentialsPayload | undefined,
  timeoutMs: number,
  workspaceFolder: vscode.WorkspaceFolder | undefined,
  inputs: NasSetupInputs
): Promise<SetupPrecheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resolved.profile.proxmox?.endpoint) {
    errors.push('Proxmox endpoint is not configured in the active profile.');
    return { errors, warnings };
  }

  if (!hasProxmoxCredentials(credentials)) {
    errors.push('Missing Proxmox credentials. Run NAAS: Add/Update Credentials first.');
    return { errors, warnings };
  }

  try {
    const scan = await cli.scan({
      profile: resolved.profile,
      credentials,
      timeoutMs: Math.min(timeoutMs, 90000),
      workspaceFolder
    });

    const dataWarnings = scan.data.warnings ?? [];
    const proxmoxWarnings = dataWarnings.filter((msg) => /proxmox|auth|401|403|connect|certificate|tls/i.test(msg));
    warnings.push(...proxmoxWarnings);

    const nodes = scan.data.compute?.nodes ?? [];
    if (nodes.length > 0 && !nodes.some((node) => node.name === inputs.node)) {
      warnings.push(`Node ${inputs.node} not found in scan results.`);
    }

    const networks = scan.data.compute?.networks ?? [];
    if (networks.length > 0 && !networks.some((net) => net.node === inputs.node && net.name === inputs.bridge)) {
      warnings.push(`Bridge ${inputs.bridge} not found on node ${inputs.node}.`);
    }

    const templateStorageName = parseStorageFromOstemplate(NAS_CT_OSTEMPLATE);
    if (templateStorageName) {
      const storages = scan.data.compute?.storage ?? [];
      const templateStorage = storages.find((storage) => storage.name === templateStorageName);
      if (!templateStorage) {
        warnings.push(`Storage ${templateStorageName} was not found; cannot verify LXC template availability.`);
      } else if (!storageSupportsVztmpl(templateStorage.config.content)) {
        warnings.push(`Storage ${templateStorageName} does not advertise vztmpl content; LXC template download may be required.`);
      }
    }
  } catch (error) {
    errors.push(`Pre-check scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { errors, warnings };
}

function validatePositiveIntegerInput(value: string): string | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 'Enter a positive integer value.';
  }
  return undefined;
}

function validateProxmoxNodeName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Node name is required.';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
    return 'Node name may only contain letters, numbers, hyphens, and underscores.';
  }
  return undefined;
}

function validateBridgeName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Bridge name is required.';
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(value.trim())) {
    return 'Bridge name may only contain letters, numbers, dots, colons, hyphens, and underscores.';
  }
  return undefined;
}

function validateInterfaceName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Interface name is required.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
    return 'Interface name may only contain letters, numbers, and underscores.';
  }
  return undefined;
}

function validateStorageName(value: string): string | undefined {
  if (!value.trim()) {
    return 'Storage name is required.';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
    return 'Storage name may only contain letters, numbers, hyphens, and underscores.';
  }
  return undefined;
}

function validateSshPublicKey(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  const validPrefixes = ['ssh-rsa ', 'ssh-ed25519 ', 'ecdsa-sha2-nistp256 ', 'ecdsa-sha2-nistp384 ', 'ecdsa-sha2-nistp521 ', 'sk-ssh-ed25519 ', 'sk-ecdsa-sha2-nistp256 '];
  if (!validPrefixes.some((prefix) => trimmed.startsWith(prefix))) {
    return 'Key must start with a valid SSH key type (e.g. ssh-ed25519, ssh-rsa, ecdsa-sha2-*).';
  }
  return undefined;
}

async function collectNasSetupInputs(): Promise<NasSetupInputs | undefined> {
  const node = await vscode.window.showInputBox({
    title: 'Proxmox node name',
    prompt: 'Example: proxmox',
    value: 'proxmox',
    ignoreFocusOut: true,
    validateInput: validateProxmoxNodeName
  });
  if (!node) {
    return undefined;
  }

  const bridge = await vscode.window.showInputBox({
    title: 'Network bridge',
    prompt: 'Example: vmbr0',
    value: 'vmbr0',
    ignoreFocusOut: true,
    validateInput: validateBridgeName
  });
  if (!bridge) {
    return undefined;
  }

  const interfaceName = await vscode.window.showInputBox({
    title: 'Bridge interface/port (for comment)',
    prompt: 'Example: nic0',
    value: 'nic0',
    ignoreFocusOut: true,
    validateInput: validateInterfaceName
  });
  if (!interfaceName) {
    return undefined;
  }

  const storage = await vscode.window.showInputBox({
    title: 'Storage target',
    prompt: 'Example: local-lvm',
    value: 'local-lvm',
    ignoreFocusOut: true,
    validateInput: validateStorageName
  });
  if (!storage) {
    return undefined;
  }

  const vmIdRaw = await vscode.window.showInputBox({
    title: 'NAS VM ID',
    prompt: 'Example: 510',
    value: '510',
    ignoreFocusOut: true,
    validateInput: validatePositiveIntegerInput
  });
  if (!vmIdRaw) {
    return undefined;
  }

  const ctIdRaw = await vscode.window.showInputBox({
    title: 'Monitoring CT ID',
    prompt: 'Example: 610',
    value: '610',
    ignoreFocusOut: true,
    validateInput: validatePositiveIntegerInput
  });
  if (!ctIdRaw) {
    return undefined;
  }

  const sshPublicKey = await vscode.window.showInputBox({
    title: 'SSH public key (optional)',
    prompt: 'Example: ssh-ed25519 AAAA... your-name',
    ignoreFocusOut: true,
    validateInput: validateSshPublicKey
  });

  return {
    node: node.trim(),
    bridge: bridge.trim(),
    interfaceName: interfaceName.trim(),
    storage: storage.trim(),
    vmId: Number(vmIdRaw),
    ctId: Number(ctIdRaw),
    sshPublicKey: sshPublicKey?.trim() || undefined
  };
}

function buildNasDesiredTemplate(inputs: NasSetupInputs): string {
  const sshKeyLine = inputs.sshPublicKey
    ? `        - ${inputs.sshPublicKey}`
    : '        - ssh-ed25519 AAAA... replace-with-your-key naas-nas';

  return `# NAS-oriented desired state for current Proxmox environment
# Generated by VS Code command: NAAS: Setup Proxmox/NAS Parameters
# - node: ${inputs.node}
# - bridge: ${inputs.bridge} (ports/slaves: ${inputs.interfaceName})
# - storage: ${inputs.storage}

vmProvision:
  - name: nas-core
    vmid: ${inputs.vmId}
    node: ${inputs.node}
    ensure: running
    cpu:
      cores: 4
      sockets: 1
      type: host
    memory:
      size: 8192
      balloon: 4096
    disks:
      - interface: scsi
        index: 0
        storage: ${inputs.storage}
        size: 80G
        format: qcow2
      - interface: scsi
        index: 1
        storage: ${inputs.storage}
        size: 200G
        format: qcow2
    networks:
      - interface: net
        index: 0
        model: virtio
        bridge: ${inputs.bridge}
    cloudInit:
      user: admin
      sshKeys:
${sshKeyLine}
      nameserver: 192.168.10.1
      searchdomain: lan
    boot:
      bios: ovmf
      order: [scsi0]
    onboot: true
    protection: true
    tags: [nas, core]
    description: NAS core VM managed by NAAS

containerProvision:
  - name: nas-monitor
    vmid: ${inputs.ctId}
    node: ${inputs.node}
    ensure: running
    ostemplate: local:vztmpl/debian-12-standard_12.0-1_amd64.tar.zst
    cpu:
      cores: 2
    memory:
      size: 2048
      swap: 1024
    rootfs:
      storage: ${inputs.storage}
      size: 12G
    networks:
      - index: 0
        bridge: ${inputs.bridge}
        ip: dhcp
    onboot: true
    tags: [nas, monitor]
    hostname: nas-monitor
    unprivileged: true

vms:
  - vmid: ${inputs.vmId}
    desiredPower: running
  - vmid: ${inputs.ctId}
    desiredPower: running

composeProjects:
  - path: ./stacks/nas-observability
    ensure: running

validation:
  enabled: true
`;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const profileManager = new ProfileManager();
  const logDir = context.globalStorageUri.fsPath;
  const logger = new Logger(logDir);
  const cli = new CliClient(context, logger);
  const cache = new StateCache();
  const tree = new InfrastructureTreeProvider();
  const statusBar = new StatusBarController();

  const getSelection = () => resolveWorkspaceFolder();

  context.subscriptions.push(statusBar, vscode.window.registerTreeDataProvider(VIEW_ID, tree));

  async function refreshProfileSection(): Promise<ResolvedProfile> {
    const workspaceSelection = getSelection();
    const profilesFile = await profileManager.listProfiles();
    const resolved = await profileManager.resolveActiveProfile(workspaceSelection);
    tree.setProfiles(profilesFile.profiles.map((item) => item.name), resolved.activeProfileName);
    tree.updateFromProfile(resolved);
    const snapshot = cache.get(workspaceSelection.key);
    statusBar.update(resolved.activeProfileName, snapshot.lastScanAt);
    return resolved;
  }

  async function withErrorActions(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const choice = await vscode.window.showErrorMessage(
        `NAAS Toolkit: ${message}`,
        'Open Settings',
        'Fix Credentials',
        'View Logs'
      );

      if (choice === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:local.naas-toolkit naas');
      }
      if (choice === 'Fix Credentials') {
        await vscode.commands.executeCommand(COMMANDS.addOrUpdateCredentials);
      }
      if (choice === 'View Logs') {
        await vscode.commands.executeCommand(COMMANDS.openLogs);
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.selectProfile, async () => {
      await withErrorActions(async () => {
        const workspaceSelection = getSelection();
        const profiles = await profileManager.listProfiles();
        const picked = await vscode.window.showQuickPick(profiles.profiles.map((item) => item.name), {
          title: 'Select active NAAS profile'
        });
        if (!picked) {
          return;
        }

        const target = workspaceSelection.folder
          ? vscode.ConfigurationTarget.WorkspaceFolder
          : vscode.ConfigurationTarget.Global;
        const config = workspaceSelection.folder
          ? vscode.workspace.getConfiguration('naas', workspaceSelection.folder.uri)
          : vscode.workspace.getConfiguration('naas');

        await config.update('activeProfile', picked, target);
        await refreshProfileSection();
      });
    }),

    vscode.commands.registerCommand(COMMANDS.addOrUpdateCredentials, async () => {
      await withErrorActions(async () => {
        const resolved = await refreshProfileSection();
        const existing = await getCredentials(context.secrets, resolved.profile);

        const proxmoxTokenId = await vscode.window.showInputBox({
          title: `Proxmox Token ID (${resolved.profile.name})`,
          value: existing?.proxmoxTokenId ?? '',
          ignoreFocusOut: true
        });
        const proxmoxTokenSecret = await vscode.window.showInputBox({
          title: `Proxmox Token Secret (${resolved.profile.name})`,
          value: existing?.proxmoxTokenSecret ?? '',
          password: true,
          ignoreFocusOut: true
        });
        const proxmoxUsername = await vscode.window.showInputBox({
          title: `Proxmox Username (${resolved.profile.name})`,
          value: existing?.proxmoxUsername ?? '',
          ignoreFocusOut: true
        });
        const proxmoxPassword = await vscode.window.showInputBox({
          title: `Proxmox Password (${resolved.profile.name})`,
          value: existing?.proxmoxPassword ?? '',
          password: true,
          ignoreFocusOut: true
        });
        const grafanaToken = await vscode.window.showInputBox({
          title: `Grafana Token (${resolved.profile.name})`,
          value: existing?.grafanaToken ?? '',
          password: true,
          ignoreFocusOut: true
        });

        const payload: CredentialsPayload = {
          proxmoxTokenId: proxmoxTokenId || undefined,
          proxmoxTokenSecret: proxmoxTokenSecret || undefined,
          proxmoxUsername: proxmoxUsername || undefined,
          proxmoxPassword: proxmoxPassword || undefined,
          grafanaToken: grafanaToken || undefined
        };

        await saveCredentials(context.secrets, resolved.profile, payload);
        vscode.window.showInformationMessage(`Credentials updated for profile ${resolved.profile.name}.`);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.setupProxmoxNasParameters, async () => {
      await withErrorActions(async () => {
        const inputs = await collectNasSetupInputs();
        if (!inputs) {
          return;
        }

        const template = buildNasDesiredTemplate(inputs);
        const workspaceSelection = getSelection();

        if (!workspaceSelection.folder) {
          const action = await vscode.window.showInformationMessage(
            'No workspace folder is open. Template generated in memory.',
            'Open Template',
            'Copy Template',
            'Open and Copy'
          );

          if (!action) {
            return;
          }

          if (action === 'Copy Template' || action === 'Open and Copy') {
            await vscode.env.clipboard.writeText(template);
          }

          if (action === 'Open Template' || action === 'Open and Copy') {
            const document = await vscode.workspace.openTextDocument({
              language: 'yaml',
              content: template
            });
            await vscode.window.showTextDocument(document, { preview: false });
          }

          return;
        }

        const workspacePath = workspaceSelection.folder.uri.fsPath;
        const specsDir = path.join(workspacePath, 'specs');
        const targetPath = path.join(specsDir, 'nas.desired.yaml');

        await mkdir(specsDir, { recursive: true });
        await writeFile(targetPath, template, 'utf8');

        const action = await vscode.window.showInformationMessage(
          'Template saved to specs/nas.desired.yaml.',
          'Open File',
          'Run Show Plan',
          'Copy Template'
        );

        if (action === 'Copy Template') {
          await vscode.env.clipboard.writeText(template);
        }

        if (action === 'Open File') {
          const document = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
          await vscode.window.showTextDocument(document, { preview: false });
        }

        if (action === 'Run Show Plan') {
          const resolved = await refreshProfileSection();
          const credentials = await getCredentials(context.secrets, resolved.profile);
          const timeoutMs = vscode.workspace.getConfiguration('naas').get<number>('cliTimeoutMs', 120000);

          const precheck = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `NAAS: Pre-check before plan (${resolved.profile.name})`,
              cancellable: false
            },
            () => runSetupPrecheck(cli, resolved, credentials, timeoutMs, workspaceSelection.folder, inputs)
          );

          if (precheck.errors.length > 0) {
            await vscode.window.showErrorMessage(`NAAS pre-check failed: ${precheck.errors.join(' | ')}`);
            return;
          }

          if (precheck.warnings.length > 0) {
            const proceed = await vscode.window.showWarningMessage(
              `NAAS pre-check warnings: ${precheck.warnings.join(' | ')}`,
              { modal: true },
              'Continue'
            );
            if (proceed !== 'Continue') {
              return;
            }
          }

          await vscode.commands.executeCommand(COMMANDS.showPlan);
        }
      });
    }),

    vscode.commands.registerCommand(COMMANDS.deleteCredentials, async () => {
      await withErrorActions(async () => {
        const resolved = await refreshProfileSection();
        await deleteCredentials(context.secrets, resolved.profile);
        vscode.window.showInformationMessage(`Credentials deleted for profile ${resolved.profile.name}.`);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.scanInfrastructure, async () => {
      await withErrorActions(async () => {
        const workspaceSelection = getSelection();
        const resolved = await refreshProfileSection();
        const credentials = await getCredentials(context.secrets, resolved.profile);
        const timeoutMs = vscode.workspace.getConfiguration('naas').get<number>('cliTimeoutMs', 120000);

        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `NAAS: Scanning ${resolved.profile.name}`,
            cancellable: true
          },
          async (_progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => cli.scan({
            profile: resolved.profile,
            credentials,
            timeoutMs,
            cancellationToken: token,
            workspaceFolder: workspaceSelection.folder
          })
        );

        cache.setCurrent(workspaceSelection.key, result.data);
        tree.setState(result.data);
        statusBar.update(resolved.activeProfileName, new Date().toISOString());
        vscode.window.showInformationMessage(`Scan completed for ${resolved.profile.name}.`);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.showPlan, async () => {
      await withErrorActions(async () => {
        const workspaceSelection = getSelection();
        const resolved = await refreshProfileSection();
        const credentials = await getCredentials(context.secrets, resolved.profile);
        const timeoutMs = vscode.workspace.getConfiguration('naas').get<number>('cliTimeoutMs', 120000);
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `NAAS: Planning ${resolved.profile.name}`,
            cancellable: true
          },
          async (_progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => cli.plan({
            profile: resolved.profile,
            credentials,
            timeoutMs,
            cancellationToken: token,
            workspaceFolder: workspaceSelection.folder
          })
        );

        cache.setPlan(workspaceSelection.key, result.data);
        showPlanWebview(result.data);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.applyPlan, async () => {
      await withErrorActions(async () => {
        const workspaceSelection = getSelection();
        const resolved = await refreshProfileSection();
        const confirmation = await vscode.window.showWarningMessage(
          `Apply plan for ${resolved.profile.name}?`,
          { modal: true },
          'Apply'
        );
        if (confirmation !== 'Apply') {
          return;
        }

        const credentials = await getCredentials(context.secrets, resolved.profile);
        const timeoutMs = vscode.workspace.getConfiguration('naas').get<number>('cliTimeoutMs', 120000);
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `NAAS: Applying ${resolved.profile.name}`,
            cancellable: true
          },
          async (_progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => cli.apply({
            profile: resolved.profile,
            credentials,
            timeoutMs,
            cancellationToken: token,
            workspaceFolder: workspaceSelection.folder
          })
        );

        vscode.window.showInformationMessage(`Apply completed for ${resolved.profile.name}.`);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.validate, async () => {
      await withErrorActions(async () => {
        const workspaceSelection = getSelection();
        const resolved = await refreshProfileSection();
        const credentials = await getCredentials(context.secrets, resolved.profile);
        const timeoutMs = vscode.workspace.getConfiguration('naas').get<number>('cliTimeoutMs', 120000);
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `NAAS: Validating ${resolved.profile.name}`,
            cancellable: true
          },
          async (_progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => cli.validate({
            profile: resolved.profile,
            credentials,
            timeoutMs,
            cancellationToken: token,
            workspaceFolder: workspaceSelection.folder
          })
        );

        vscode.window.showInformationMessage(`Validation completed for ${resolved.profile.name}.`);
      });
    }),

    vscode.commands.registerCommand(COMMANDS.openLogs, async () => {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(logger.directory));
    })
  );

  await withErrorActions(async () => {
    const workspaceSelection = getSelection();
    await refreshProfileSection();
    const cached = cache.get(workspaceSelection.key);
    tree.setState(cached.current);
  });
}

export function deactivate(): void {
}
