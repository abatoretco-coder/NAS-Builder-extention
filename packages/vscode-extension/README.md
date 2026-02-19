# NAAS Toolkit (VS Code Extension)

NAAS Toolkit is a standalone VS Code extension (AWS Toolkit style) for managing Proxmox + Docker + Grafana infrastructure via `naasctl`.

It is installable once (`.vsix` or Marketplace) and works across any workspace, including empty windows.

## Features

- Global Activity Bar container: **NAAS**
- Tree View sections:
  - Profiles
  - Proxmox (Nodes → VMs → CTs)
  - Docker (Hosts → Compose Projects → Containers)
  - Observability (Dashboards)
- Profile system:
  - Global file: `~/.naas/profiles.yaml`
  - Optional workspace overrides: `.vscode/naas.yaml`
  - Optional workspace settings overrides: `.vscode/settings.json` via `naas.*`
- Secret handling:
  - Credentials stored in VS Code `SecretStorage`
  - Commands for Add/Update and Delete
- CLI integration:
  - Uses configured `naas.cliPath`, bundled CLI, or `naasctl` from `PATH`
  - Runs `scan/plan/apply/validate` with `--profile`
  - Timeout + cancellation + JSON parsing + structured logs
- Status bar:
  - Active profile + last scan time

## Commands

- `NAAS: Select Profile`
- `NAAS: Add/Update Credentials`
- `NAAS: Setup Proxmox/NAS Parameters` (guides inputs, saves `specs/nas.desired.yaml`, and runs a Proxmox pre-check before immediate plan)
- `NAAS: Delete Credentials`
- `NAAS: Scan Infrastructure`
- `NAAS: Show Plan`
- `NAAS: Apply Plan`
- `NAAS: Validate (Grafana/Prometheus)`
- `NAAS: Open Logs`

## Configuration

Settings namespace: `naas`

- `naas.activeProfile`: active profile name (global/workspace/folder)
- `naas.cliPath`: optional explicit path to `naasctl`
- `naas.cliTimeoutMs`: process timeout (default `120000`)
- `naas.workspaceFolder`: multi-root folder name selector
- `naas.profilesPath`: global profiles file path (default `~/.naas/profiles.yaml`)
- `naas.profileOverrides`: workspace-level profile overrides

## Profiles file (`~/.naas/profiles.yaml`)

```yaml
defaultProfile: preprod
profiles:
  - name: preprod
    proxmox:
      endpoint: https://proxmox-preprod.local:8006
      authRef: proxmox-preprod
    docker:
      host: unix:///var/run/docker.sock
    grafana:
      endpoint: https://grafana-preprod.local
      authRef: grafana-preprod
    stateDir: ~/.naas/state/preprod

  - name: prod
    proxmox:
      endpoint: https://proxmox-prod.local:8006
      authRef: proxmox-prod
    docker:
      host: tcp://10.0.0.12:2375
    grafana:
      endpoint: https://grafana-prod.local
      authRef: grafana-prod
```

## Workspace overrides (`.vscode/naas.yaml`)

```yaml
activeProfile: preprod
profileOverrides:
  preprod:
    docker:
      host: tcp://127.0.0.1:2375
```

## Development

From repository root:

```powershell
pnpm install
pnpm --filter naas-toolkit build
pnpm --filter naas-toolkit lint
pnpm --filter naas-toolkit test
```

Debug in VS Code:

1. Open `packages/vscode-extension` as the launch target.
2. Press `F5` to open Extension Development Host.
3. Run NAAS commands from Command Palette.

Package VSIX:

```powershell
pnpm --filter naas-toolkit package
```

## Notes

- The extension never modifies project code.
- If no folder is open, only global profiles/settings are used.
- Logs are written under the extension global storage directory.
