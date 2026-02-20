---
description: Target homelab architecture and hard constraints for this repo.
---

# Homelab Target Architecture (Jarvis) — Always-on Constraints

Use this as the **single source of truth** when generating specs, plans, code, or runbooks in this repository.

## Hard constraints (non-negotiable)

- **Remote access MUST be Tailscale-only.**
  - No public inbound exposure, no port-forwarding, no DMZ.
  - Any “remote” access should be via Tailscale overlay or via a LAN-only service reached through Tailscale.
- **Single Proxmox node**: `proxmox`.
- **Phase 0 runs on a single SSD** (no HDDs yet).
- **No managed switch / no VLAN trunking**.
  - Segmentation must be achievable via **internal-only bridges** and a router VM (Phase 2).

## Deployment phases

### Phase 0 (now) — SSD-only MVP

Goal: everything works on SSD with minimal blast-radius.

Required QEMU VMs:
- **VM 100**: `edge-gateway`
  - Purpose: Tailscale entry point; optional reverse-proxy later.
  - 1–2 vCPU, 1–2 GB RAM, 16–32 GB disk.
  - 1 NIC on `vmbr0` (LAN).
  - Install Tailscale in-guest and join tailnet.

- **VM 300**: `app-host`
  - Purpose: Docker host (Plex + Jarvis + Monitoring + Kargo-preprod).
  - 4 vCPU, ~8 GB RAM, 64–128 GB disk.
  - 1 NIC on `vmbr0` (LAN).
  - In-guest: install Docker + Compose.
  - Standard layout under `/opt/naas`:
    - `/opt/naas/stacks/<name>`
    - `/opt/naas/appdata/<name>`
    - `/opt/naas/logs`

- **VM 400**: `home-assistant`
  - Purpose: stable Home Assistant.
  - Prefer HAOS for reliability, otherwise Debian + supervised if explicitly chosen.
  - 2 vCPU, 2–4 GB RAM, 32–64 GB disk.
  - 1 NIC on `vmbr0`.
  - Prefer in-guest Tailscale in Phase 0 for simplicity.

Phase 0 safety requirements:
- Do not change host networking unless explicitly enabled.
- Snapshots before risky actions.
- Backups: placeholder schedule allowed on SSD, but warn about space.

### Phase 1 (later) — 2 HDDs arrive

Goal: durable storage + protection.

- Create ZFS mirror pool: `tank`.
- Create datasets:
  - `tank/media`
  - `tank/appdata`
  - `tank/backups`
  - `tank/ha` (optional)
- Migrate:
  - Plex media → `tank/media`
  - Docker volumes/appdata → `tank/appdata`
  - Proxmox backups target → `tank/backups`
- Enable daily ZFS snapshots for `tank/media` and `tank/appdata`.
- Backups:
  - Use scheduled Proxmox backups (vzdump) with retention (e.g. 7 daily / 4 weekly / 6 monthly).
  - Prefer PBS later if enabled; keep vzdump fallback.

### Phase 2 (optional but recommended) — hardened segmentation (no managed switch)

Goal: internal segmentation without VLAN trunking.

Networks:
- `vmbr0`: LAN bridge (physical uplink)
- `vmbr1`: SERVICES internal-only bridge
- `vmbr2`: IOT internal-only bridge

Router VM:
- **VM 150**: `firewall-router` (OPNsense preferred)
  - NICs: `vmbr0` + `vmbr1` + `vmbr2`
  - Routes/NAT + strict firewall flows

Reattachments:
- `app-host` → `vmbr1`
- `home-assistant` → `vmbr2` (or dual NIC if required)
- `edge-gateway` stays on `vmbr0` (optional additional NIC later)

Tailscale in Phase 2:
- Install on `edge-gateway` and/or `firewall-router`.
- Optionally advertise routes for SERVICES/IOT to remote devices via Tailscale.

Firewall matrix (intent)
- Default deny between segments.
- Allow IOT → Home Assistant only (`8123`, and `1883` if MQTT).
- Block SERVICES/IOT → Proxmox mgmt by default.
- Allow admin LAN/Tailscale device(s) to management ports as needed.

## Proxmox build standards

- VirtIO NIC.
- VirtIO SCSI controller.
- Disk cache: `none`.
- Enable QEMU Guest Agent where applicable.
- Stable VMIDs: `100`, `150`, `300`, `400` (optional `200` monitoring, `700` PBS).

Tags: Proxmox tag format must be valid (avoid `=`). Prefer:
- `env-lab`
- `role-edge-gateway` / `role-app-host` / `role-home-assistant` / `role-firewall-router`
- `tier-lan` / `tier-services` / `tier-iot`
- `owner-loic`

## Firewall safety (host / datacenter)

- Host/datacenter firewall changes are **high risk**.
- When enabling restrictive inbound policy (e.g. `policy_in=DROP`):
  - Always include explicit `ACCEPT` rules for admin management sources (`safetyGuards.managementAccessCidrs`) to ports `22` and `8006`.
  - Include explicit Tailscale allow (e.g. `100.64.0.0/10`) when Tailscale mgmt is expected.
- Use CIDR in firewall `source` fields; never `IP:port`.

## Builder lifecycle expectations

Always operate as: **scan → plan → (dry-run) → apply → validate**.

- Plans should have an enriched, human-auditable artifact when possible (id/type/target/risk/preSnapshot/rollbackHint/expectedDowntime).
- Never log secrets/tokens in outputs.

## Canonical spec files

- Execution-safe bootstrap spec: `specs/nas.desired.yaml`
- Full reference architecture: `specs/jarvis-homelab.desired.yaml`
- Dedicated firewall-only wave (when needed): `specs/preprod.firewall.desired.yaml`
