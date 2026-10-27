# Notes

A personal notes app: notes organised into folders and subfolders, shown as a
file tree. Open, write, close. Notes are markdown (bold, lists, checklists,
headings, tables…) or plain text. "Recent" and "Most viewed" sit above the
search. No accounts, no sync. It runs on your own machine or home server,
serves on **http://localhost:8009**, and installs as an app on your phone.

It's the sibling of the bookmarks app (same stack, same keyboard shortcuts;
that one runs on 8008).

Stack: TanStack Start (React 19) on Nitro/Node, SQLite via Drizzle, shadcn/ui
and Tailwind. See [`CLAUDE.md`](./CLAUDE.md) for architecture and
conventions and [`TASKS.md`](./TASKS.md) for the work log.

There's nothing to configure and no database server: the data is one SQLite
file, created with its tables the first time the server starts. Optional
settings (see `.env.example`): `DATABASE_PATH` (where the file lives,
default `data/notes.db`) and `VITE_APP_NAME` (the name shown in the app;
build-time).

> **No login.** The server listens on all interfaces, so anyone who can reach
> port 8009 can read and edit your notes. Keep it on your LAN (or behind
> something like Tailscale); don't forward the port to the internet.

## Deploy

Pick one:

| Where              | How                                        |
| ------------------ | ------------------------------------------ |
| Any OS with Docker | [Docker](#docker-any-os)                   |
| Windows, no Docker | [Windows](#windows-native-starts-at-logon) |
| Linux, no Docker   | [Linux](#linux-native-systemd)             |
| macOS, no Docker   | [macOS](#macos-native-launchd)             |
| NixOS server       | [NixOS](#nixos)                            |

The native options need **Node.js 22.9+** (https://nodejs.org), **pnpm**
(`npm install -g pnpm`, or `corepack enable`) and **Git**. Always build on
the machine that runs it: `pnpm build` bundles the SQLite binary for the
current OS, so a build from one OS won't run on another.

### Docker (any OS)

Works the same on Linux, macOS (Docker Desktop / OrbStack) and Windows
(Docker Desktop).

**Build from source** (needs only Git and Docker):

```bash
git clone <repo-url> notes
cd notes
docker compose up -d --build        # http://localhost:8009
```

**Or use the published image** (built by GitHub Actions for every version
tag, for `linux/amd64` and `linux/arm64`):

```bash
docker run -d --name notes --restart unless-stopped \
  -p 8009:8009 -v notes-data:/data \
  ghcr.io/liteblusky/notes:latest
```

The data lives in the `notes-data` volume (`/data/notes.db` inside
the container), never in the image, so rebuilding or updating keeps it.

| Task                     | Command                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| Update (from source)     | `git pull; docker compose up -d --build`                                   |
| Update (published image) | `docker pull ghcr.io/liteblusky/notes:latest`, then recreate the container |
| Logs                     | `docker compose logs -f`                                                   |
| Stop / start             | `docker compose stop` / `docker compose start`                             |
| Copy the database out    | `docker compose cp notes:/data/notes.db ./notes.db`                        |

To change the app name, build with
`VITE_APP_NAME="My notes" docker compose up -d --build`.

### Windows (native, starts at logon)

```powershell
git clone <repo-url> notes
cd notes
pnpm install
pnpm build
.\scripts\install-startup.ps1
```

`install-startup.ps1` registers a Scheduled Task called **Notes** that
runs `scripts\start.ps1` each time you log on, and starts it straight away.
It runs under `conhost --headless`, so there is **no window** to close by
accident. No admin rights needed; if PowerShell refuses to run the script,
use `powershell -ExecutionPolicy Bypass -File .\scripts\install-startup.ps1`.

How it runs:

- `start.ps1` sets `PORT=8009`, kills any server a previous run left behind,
  and runs `.output\server\index.mjs` with `.env.local` loaded. If the server
  exits it restarts it after 5 seconds, so ending `node.exe` in Task Manager
  just restarts it; to really stop it, use `scripts\stop.ps1`.
- Output goes to `logs\server.log`, cleared each time the task starts.
- Don't use plain `powershell -WindowStyle Hidden` as the task action: when
  Windows Terminal is the default terminal it opens a visible window anyway,
  and closing that window kills the server.
- For other devices on the network, allow Node.js at the firewall prompt, or
  (admin PowerShell)
  `New-NetFirewallRule -DisplayName 'Notes 8009' -Direction Inbound -Protocol TCP -LocalPort 8009 -Action Allow`.
  To keep it to this machine only, add `$env:HOST = '127.0.0.1'` next to
  `PORT` in `start.ps1`.

| Task                              | Command                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Deploy changes (after `git pull`) | `pnpm install; .\scripts\stop.ps1; pnpm build; .\scripts\install-startup.ps1` |
| Restart the server                | `.\scripts\install-startup.ps1`                                               |
| Check it's running                | `Get-ScheduledTask Notes` / open `logs\server.log`                            |
| Stop until next logon             | `.\scripts\stop.ps1`                                                          |
| Start again after `stop.ps1`      | `Start-ScheduledTask Notes`                                                   |
| Stop and remove from startup      | `.\scripts\uninstall-startup.ps1`                                             |

Stop the server before `pnpm build`: while it runs, Windows keeps the SQLite
library in `.output` locked and the build fails with `EPERM`.
`Stop-ScheduledTask` alone doesn't stop the server (it only ends the
`conhost` wrapper); use `stop.ps1`.

If you use Claude Code here, link its copy of the shadcn skill (a junction
holds an absolute path, so it isn't committed):

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
New-Item -ItemType Junction -Path .claude\skills\shadcn -Target (Resolve-Path .agents\skills\shadcn).Path
```

### Linux (native, systemd)

```bash
git clone <repo-url> ~/notes
cd ~/notes
pnpm install
pnpm build
```

Create `~/.config/systemd/user/notes.service` (adjust the paths;
`which node` shows the node path):

```ini
[Unit]
Description=Notes
After=network.target

[Service]
WorkingDirectory=%h/notes
Environment=NODE_ENV=production PORT=8009
ExecStart=/usr/bin/node --env-file-if-exists=.env.local .output/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now notes
loginctl enable-linger "$USER"   # keep it running when you're logged out
```

Update: `git pull && pnpm install && pnpm build && systemctl --user restart notes`.
Logs: `journalctl --user -u notes -f`.

### macOS (native, launchd)

```bash
git clone <repo-url> ~/notes
cd ~/notes
pnpm install
pnpm build
```

Create `~/Library/LaunchAgents/local.notes.plist` (replace `YOU`, and
use the node path from `which node` — `/opt/homebrew/bin/node` on Apple
Silicon with Homebrew):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.notes</string>
  <key>WorkingDirectory</key><string>/Users/YOU/notes</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>--env-file-if-exists=.env.local</string>
    <string>.output/server/index.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>8009</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/notes/logs/server.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/notes/logs/server.log</string>
</dict>
</plist>
```

```bash
mkdir -p ~/notes/logs
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.notes.plist
```

It starts at login and restarts if it exits. Update:
`git pull && pnpm install && pnpm build && launchctl kickstart -k gui/$(id -u)/local.notes`.
Remove: `launchctl bootout gui/$(id -u)/local.notes`.

### NixOS

Run the published image declaratively with `virtualisation.oci-containers`
(Podman by default). In `configuration.nix`:

```nix
{
  virtualisation.oci-containers.containers.notes = {
    image = "ghcr.io/liteblusky/notes:latest"; # or pin, e.g. ":1.1.0"
    ports = [ "8009:8009" ];
    volumes = [ "/var/lib/notes:/data" ];
    # Only if the image on GHCR is private:
    # login = {
    #   registry = "ghcr.io";
    #   username = "<github-user>";
    #   passwordFile = "/run/secrets/ghcr-token"; # a PAT with read:packages
    # };
  };

  # The container runs as the image's `node` user (uid 1000).
  systemd.tmpfiles.rules = [ "d /var/lib/notes 0750 1000 1000 -" ];

  # Reach it from other devices on the LAN.
  networking.firewall.allowedTCPPorts = [ 8009 ];
}
```

Then `sudo nixos-rebuild switch`. The data is `/var/lib/notes/notes.db`.

- **Update**: with a pinned tag, bump it and rebuild. With `:latest`,
  `sudo podman pull ghcr.io/liteblusky/notes:latest && sudo systemctl restart podman-notes`.
- **Logs**: `journalctl -u podman-notes -f`.
- New GHCR packages start out **private**. Either make it public (GitHub →
  your profile → Packages → notes → Package settings → Change
  visibility) or use the `login` block above.

## Install as an app (phone / desktop)

The app ships a web manifest and a service worker, so it can be installed
and opened like a native app. Once it has loaded, it also opens **offline**,
showing your notes as they were last loaded (read-only: saving needs the
server).

- **Android (Chrome)**: ⋮ menu in the app → **Install app…**, or the
  browser's own menu → _Install app_ / _Add to Home screen_.
- **iPhone / iPad (Safari)**: Share → **Add to Home Screen** (the app's
  _Install app…_ item shows the same hint; iOS has no install prompt).
- **Desktop Chrome / Edge**: ⋮ menu → **Install app…**, or the install icon
  in the address bar.

Browsers only allow installing (and the offline service worker) on a
**secure origin**: `https://…` or `http://localhost`. Opening
`http://192.168.x.x:8009` from your phone works as a normal page but won't
install or work offline. To install it on a phone, put it behind HTTPS, for
example with Tailscale (`tailscale serve --bg 8009`, then open the
`https://<machine>.<tailnet>.ts.net` address it prints) or a reverse proxy
with a certificate (Caddy, nginx…).

## Data: backup and moving machines

- **Backup**: ⋮ menu → **Export JSON** (works everywhere, while running), or
  copy `notes.db` while the server is stopped.
- **Restore / move**: ⋮ menu → **Import JSON** on the new instance (adds to
  what's there), or put `notes.db` in place before its first start
  (Docker: the `/data` volume; NixOS: `/var/lib/notes/`, owned by uid
  1000).

Schema changes are applied automatically when the server starts, so an
update never needs a separate database step.

## Development

```bash
pnpm dev          # http://localhost:3000, hot reload (separate from the 8009 instance)
pnpm typecheck
pnpm lint
pnpm format
pnpm db:studio    # browse the data
pnpm db:generate  # after editing src/db/schema.ts: write a migration (commit it)
```

After any nontrivial change: `pnpm typecheck && pnpm lint && pnpm build`.

### Releasing a version

With a clean working tree:

```bash
pnpm version:patch   # 0.1.0 -> 0.1.1  (fixes)
pnpm version:minor   # 0.1.0 -> 0.2.0  (new features)
pnpm version:major   # 0.1.0 -> 1.0.0  (breaking changes)
git push --follow-tags
```

Each bumps `version` in `package.json`, commits it as `Release vX.Y.Z` and
tags it `vX.Y.Z`. Pushing the tag runs `.github/workflows/docker.yml`, which
publishes `ghcr.io/liteblusky/notes:X.Y.Z` (plus `X.Y`, `X` and
`latest`).
