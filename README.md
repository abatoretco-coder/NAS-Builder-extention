# NAAS Toolkit + naasctl

Standalone AWS-Toolkit-like infrastructure management for Proxmox + Docker + Grafana.

- VS Code extension: `NAAS Toolkit` (`packages/vscode-extension`)
- Companion CLI: `naasctl` (`packages/cli`)
- No project code changes required in target workspaces

## README Quickstart

For the full guide, read [docs/SETUP.md](docs/SETUP.md).

### 1) Install the extension

- Build VSIX locally:

```powershell
pnpm --filter naas-toolkit package
```

- Install in VS Code:
   - `Extensions` panel → `...` menu → `Install from VSIX...` → select generated `.vsix`

Expected output:
- You see a `NAAS` icon in the Activity Bar.

### 2) Create global profiles file

Create `~/.naas/profiles.yaml`:

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
      stateDir: ~/.naas/state/prod
```

Expected output:
- `NAAS: Select Profile` shows `preprod` and `prod`.

### 3) Add credentials securely

Run Command Palette:

```text
NAAS: Add/Update Credentials
```

Store tokens/passwords in VS Code SecretStorage only.

Expected output:
- Notification: credentials updated for selected profile.

### 4) Run first scan

Run:

```text
NAAS: Scan Infrastructure
```

Expected output:
- Tree View populates `Profiles`, `Proxmox`, `Docker`, `Observability`.
- Status bar shows active profile and last scan time.

### 5) Plan and apply

Run:

```text
NAAS: Show Plan
NAAS: Apply Plan
```

Expected output:
- Plan opens in a Webview table.
- Apply prompts confirmation and shows success/error notifications.

## Extension docs

- Full setup and operations: [docs/SETUP.md](docs/SETUP.md)
- Extension package details: [packages/vscode-extension/README.md](packages/vscode-extension/README.md)

## Monorepo developer commands

```powershell
pnpm install
pnpm build
pnpm lint
pnpm test
pnpm package
```

## Local secrets (.env)

For local CLI runs, copy `.env.example` to `.env` and fill your Proxmox token secret.

```powershell
Copy-Item .env.example .env
```

Then run:

```powershell
node .\packages\cli\dist\src\index.js scan --profile preprod --json
node .\packages\cli\dist\src\index.js plan --profile preprod --json
node .\packages\cli\dist\src\index.js apply --profile preprod --dry-run --yes --json
node .\packages\cli\dist\src\index.js validate --profile preprod --json
```
