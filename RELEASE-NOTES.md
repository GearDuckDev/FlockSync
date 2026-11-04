## FlockSync 0.10.0

### Safer sign-in, verified backups, and server safeguards
- Sign-in and registration now limit repeated requests per visitor address. Defaults allow 10 sign-in attempts per 15 minutes and 5 registrations per hour; rejected requests include retry guidance. Administrators can disable public registration while retaining existing logins and admin-created accounts.
- Tightened private proxy networks and trusted-address handling prevent forged forwarding headers from bypassing per-visitor limits. API/web still publish no host ports; the website remains behind the operator's Cloudflare Tunnel.
- Added database readiness at `/ready`, separate from process liveness at `/health`. Admin-only health details distinguish verified, stale, failed, missing, and corrupt backup evidence without exposing diagnostics publicly.
- Backups now record verification evidence. Optional backup-storage identity markers help refuse writes to the wrong or missing destination. Failed pre-update backups continue to block server updates.
- Added configurable container memory/CPU ceilings, process and log limits, disk-space checks, and request safeguards. Concurrent restore uploads are restricted, and valid 128 MiB restores remain supported through nginx, subject to external proxy limits.
- Added an operator maintenance guide and resource/backup checks. Uptime Kuma and protected remote access are separately configured infrastructure, not automatically installed for other servers.
- Existing guild headers, themes, account data, backup locations, restore/wipe safety, collector permissions, and saved client paths are retained. No email verification, password-reset email, or notification delivery is introduced.

### Release channel and scope
This is a normal **Release-channel**, **pre-1.0** feature release, prepared as **v0.10.0** after published **v0.9.0**. It is not a preview or a declaration of 1.0 readiness. Do not reuse any earlier tag.

API/web advance **0.6.1 -> 0.7.0** and shared types **0.6.0 -> 0.7.0** from the branch's previous source versions. Desktop **0.5.1**, main addon **0.6.0**, and AppHelper **0.2.2** are unchanged. They are rebuilt/repackaged for the complete download set; already-current desktop/addon installations do not need reinstalling.

### Upgrade instructions
1. Server operators: preserve `.env`, `data`, independent backups, and any local Compose override or startup units. Stage and inspect `FlockSync_Remote_Server_Deploy.zip` before applying its source. For the NAS-managed Pi, stop **only** `flocksync-nas.timer` during updates; leave the active startup service alone. Follow [SERVER-OPERATIONS.md](./SERVER-OPERATIONS.md) for that host, not generic stop/start commands.
2. Verify the intended backup storage is actually mounted and writable by the API user, not just by root. Keep the existing `NAS_BACKUP_PATH`, folder settings, and permissions. If enabling `BACKUP_STORAGE_ID`, create the matching `.flocksync-storage-id` on the verified destination first; never copy example settings over production secrets.
3. Review new settings in `.env.example`. Public registration defaults on; set `PUBLIC_REGISTRATION_ENABLED=false` for admin-created accounts only. Review proxy subnet conflicts and resource ceilings for your host. Confirm Linux memory limits are actually enforced and leave room for the OS, other apps, and builds.
4. From the deployed project directory, run `sh deploy/update-server.sh`. It verifies a fresh pre-update backup before rebuilding/recreating API/web. Expect a brief interruption. On failure, inspect the error rather than bypassing the backup guard. Never use `docker compose down -v` or restore automatically merely because an update failed.
5. Check container health, `/ready` JSON, website login, collector sync, and fresh verified backup health. Use `/ready` rather than the SPA homepage for uptime checks; it does not itself certify backup freshness. On the NAS-managed Pi, re-enable the retry timer only after checks succeed. The ZIP does not install host-specific systemd units, Kuma, or a resource-check schedule.
6. Already on desktop **0.5.1**, addon **0.6.0**, and AppHelper **0.2.2**? Keep them; no reinstall is needed. Older collectors quit desktop fully through its tray before replacing it and preserve settings. Older addon users exit WoW, extract into `Interface\AddOns` without extra nesting, and preserve SavedVariables.
7. No wipe or restore is required. Existing databases migrate on startup. If restoring, the safety backup is retained and restored accounts/credentials replace current ones. Wipe requires confirmation and saves a `final` backup; accounts and backup-folder settings remain.
8. After an intentional wipe, use logout -> successful desktop sync -> login to load the reset marker. Keep final/pre-restore backups until manually reviewed; daily retention does not remove them. Older backups without guild metadata need a fresh collector sync to populate the guild header.

### Download choices
- **FlockSync-Setup-0.5.1-x64.exe:** unchanged Windows collector installer, rebuilt for this download set. Already-current users do not need it again.
- **FlockSync-Portable-0.5.1-x64.exe:** unchanged portable alternative; choose this or the installer, not both.
- **FlockSync-Raider-Only.zip:** unchanged main addon **0.6.0** for all members. Members do not need AppHelper, desktop, or a website account to broadcast data.
- **FlockSync-Addon-Bundle.zip:** unchanged main addon **0.6.0** plus AppHelper **0.2.2** for collectors. Collectors also need desktop and an authorized OFFICER/ADMIN website login.
- **FlockSync_Remote_Server_Deploy.zip:** updated **0.7.0 API/web** source, shared contracts, migrations, theme assets, and deployment/backup tooling for ARM64 or AMD64 Linux Docker hosts. It contains source, not prebuilt images or host-specific monitoring configuration.
- **flocksync-release.json:** generated component-version manifest; publish beside the other five assets on one public GitHub release.

### Component versions
- Desktop: **0.5.1 - unchanged**.
- Server/API/web: **0.7.0 - updated** from 0.6.1; API/web remain aligned.
- Shared types: **0.7.0 - updated** from 0.6.0.
- Main addon: **0.6.0 - unchanged**.
- AppHelper: **0.2.2 - unchanged**.
- Root workspace: **0.2.2 - unchanged**.

### New installations
Members install the main addon and finish the walkthrough. Collectors additionally install AppHelper and one desktop download, select the client root containing `Interface` and `WTF`, and use their guild server's full URL without `/api`.

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first-time remote-server setup, storage permissions, backups, and offline recovery. Use local persistent storage for live SQLite; network storage is for backups only. Collection only works while a catcher is online and cannot recover missed broadcasts.

### Verification and publication status
Fresh release preparation passed workspace typecheck, API/web builds, Windows desktop packaging, addon/source packaging, 10 API production tests, 14 update tests, 15 web tests, and 11 Docker deployment regressions. Desktop tests passed 21 with one opt-in live-network test skipped. API/web/backup images built successfully on local x86_64 Linux Docker. A Windows-reserved test port initially prevented one API test from starting; both its isolated rerun and a subsequent full production suite passed. The generated manifest identifies 0.10.0 and the component versions above.

The operator previously built this security runtime on ARM64 and verified real proxy behavior, protected remote Kuma access/session expiry, kernel limits, backup health, normal reboot ordering, simulated failed-dependency retry/recovery, and a capped disposable workload with 501 characters and a 128 MiB restore. A temporarily adjusted cron schedule triggered a successful automatic backup and was restored to midnight UTC. These are operator-reported results, not a physical NAS outage test or a sustained-capacity guarantee.

All archived files matched final sources: 208 server files, 37 member-addon files, and 39 collector-bundle files. Archive checks verified expected paths/versions and intentional exclusions of private environments, databases, config artifacts, and links. Both EXEs match desktop packaging output and identify 0.5.1. The release directory contains exactly the six current assets; no superseded downloads remain.

No fresh in-game, packaged installer UI, physical NAS interruption, or independent total-host outage test is claimed. Lua/addon behavior is unchanged; Lua runtime tests were not rerun. The older `localCapture.test.lua` harness has a known missing `GetInventoryItemTexture` mock and is not counted as passing.

Notifications, automatic resource-alert delivery, and independent outage monitoring remain outside this branch. See [the future notification plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md). Self-hosted Kuma on the same host cannot report that host's complete loss by itself. Rate limits are process-local and are not a guarantee against distributed attacks.

This is a prepared local release, **not published or newly deployed**. No commit, push, tag, or upload is authorized by preparation alone.

### Publishing and update notices
When separately authorized, publish one GitHub release tagged **v0.10.0**, titled **FlockSync 0.10.0**, with **Set as a pre-release unchecked** and all six current assets. Do not reuse or rename any existing tag. Automatic CurseForge publishing should skip unchanged main addon **0.6.0** if already represented in an earlier published combined release; verify prior upload status before any manual upload. For older member installations, distribute addon 0.6.0 with release type **Release**.

Checkers compare component versions, not the bundle tag: older servers can discover server 0.7.0 after publication. Already-current desktop/addon/AppHelper should not receive unnecessary prompts. Release/Beta/Alpha channels include eligible stable updates; no component moves to 1.0.

---

### Maintainer / next-agent handoff (release preparation November 4, 2026)

This section is an operational snapshot, not an additional release or proof of
publication. Start with [.github/copilot-instructions.md](./.github/copilot-instructions.md)
for coding/build rules, [RELEASES.md](./RELEASES.md) for packaging/publication, and
[DEPLOYMENT.md](./DEPLOYMENT.md) for first install, backup/restore, and remote server updates.
Do not read secrets into an agent transcript to reconstruct the environment.

#### Current checkpoint and pending work
- Branch `security-and-health-controls`, runtime checkpoint `54baa09`;
  release versions/docs remain uncommitted. Re-check Git status before resuming.
  Published GitHub latest was `v0.9.0`; no `v0.10.0` remote tag was found during
  preparation. Re-check before publication; no tag was created.
- The local manifest identifies 0.10.0 with server 0.7.0, desktop 0.5.1,
  addon 0.6.0, and helper 0.2.2. Shared types are 0.7.0. All six downloads
  were regenerated, including unchanged components, rather than reused by name.
- The Pi previously deployed the security runtime under old component versions.
  The final versioned release has not been applied there. Preserve `.env`,
  data, the Pi-local override, startup units, NAS marker, and independent backups.
  See [SERVER-OPERATIONS.md](./SERVER-OPERATIONS.md) and
  [SECURITY-HEALTH-PLAN.md](./SECURITY-HEALTH-PLAN.md) for acceptance evidence.
- Windows chat-diff Keep ownership errors do not mean files are unsaved.
  Do not discard documents or alter editor session databases to clear them.
- Current functionality includes linked/separate UI/background theme colors,
  admin defaults/personal overrides, grouped attunement alts, tray preferences,
  indexed Lua equipment parsing, and logout/character-switch gear preservation.
  Preserve these behaviors and their regression coverage.

#### Build and versioning preferences
1. After completing changes, run targeted regressions and **`pnpm run typecheck`**.
   Build only the package(s) affected by the change; do not rebuild unchanged
   apps or components. Use the whole-workspace build only when a change crosses
   package boundaries or requires validation of shared build dependencies.
   Report missing tools or failing checks explicitly. Root build builds shared
   types, API, web and desktop; it is not a substitute for installer/ZIP packaging.
2. **When ready to commit**, increment changed components and the overall bundle:
   small changes/bug fixes **+0.0.1**, significant changes/features **+0.1.0**.
   Keep API/web aligned; don't bump unchanged components for a rebuild, or
   repeatedly bump versions during editing. Explicit user-requested exceptions
   take precedence. Documentation alone does not require a runtime version bump.
3. Only when preparing an explicitly requested release, run
   `.\scripts\package-release.ps1 -ReleaseVersion <new-version>` and inspect all
   six outputs and the generated manifest. This full packager rebuilds unchanged
   components to assemble the complete release; do not run it for ordinary
   changes or commits. Build changed Docker definitions too.
   Never package or publish a failed build or a mixture of old/new artifacts.
4. Reserve **1.0.0** for a genuinely ready, primetime release when the game goes
   live. **November 4, 2026 is the hoped-for launch, not confirmed or an automatic
   release trigger.** Pre-1.0 releases without alpha/beta suffix remain normal
   Release-channel builds. Preparing builds does not authorize git/publication.

#### Development environment and installed tooling
The Windows checkout is `C:\Users\johnn\Coding Projects\FlockSync`;
use PowerShell, quote paths containing spaces, and use Windows path separators
locally. server/container commands use Linux paths and `sh`.

Tool versions below were inventoried October 27 unless noted; re-check mutable
tools when resuming. Docker was started and used successfully for this release.

| Tool | Inventoried local version / availability |
| --- | --- |
| Node / pnpm / Git | `24.22.0` / `12.11.2` / `2.56.0.windows.3` |
| VS Code | `1.143.1` x64 |
| Docker Desktop Linux engine / CLI | responsive / `29.9.2`, context `desktop-linux`, x86_64 |
| Compose / Buildx | `5.6.1` / `0.38.1` |
| VS Code Container Tools | `ms-azuretools.vscode-containers@2.5.3` |
| VS Code Dev Containers | `ms-vscode-remote.remote-containers@0.469.0` |
| ESLint / Prettier / GitHub Actions extensions | `3.0.34` / `12.4.0` / `0.32.3` |
| Python | `3.14.7` at `C:\Python314\python.exe` |
| Visual Studio Build Tools | MSBuild `18.11.1`, installed outside PATH |
| .NET | Host `10.0.13`, no SDK; not required for the app |
| Lua 5.1 / LuaJIT / make / g++ | Not found on PATH; do not report addon runtime tests as passed without an interpreter |

MSBuild exists under
`C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Current\Bin`;
this does not establish that C++ workloads are installed. WoW annotation paths
in [.vscode/settings.json](./.vscode/settings.json) are editor libraries, not
an interpreter. No `.devcontainer` configuration exists: Container Tools and
Dev Containers are installed extensions, not evidence that the workspace is
containerized. Docker inventory showed no local running containers; it is not
the production remote server. Re-check installed versions and engine health before use.

#### Packages and build definitions
Use the committed [lockfile](./pnpm-lock.yaml), format **9.0**, with pnpm
**12.11.2**; [workspace configuration](./pnpm-workspace.yaml) covers `apps/*` and
`packages/*` and allows native builds for `better-sqlite3`, `esbuild`, `electron`,
and `electron-winstaller`. Root declares Node `>=20`; Docker builds use Node 22,
while local Node is 24. Do not assume those versions are interchangeable for
native binaries. Restore only missing dependencies with
`pnpm install --frozen-lockfile`, not npm/yarn or unsolicited package upgrades.

| Package area | Verified lockfile versions; manifests are authoritative for ranges/scripts |
| --- | --- |
| [API](./apps/api/package.json) | Fastify `5.12.7`, CORS `10.1.0`, JWT `9.1.0`, bcryptjs `3.0.3`, better-sqlite3 `12.11.1`, dotenv `16.6.1`, Drizzle ORM `0.44.7`, Drizzle Kit `0.31.11`, tsx `4.23.15` |
| [Web](./apps/web/package.json) | React / React DOM `19.3.1`, lucide-react `1.58.0`, Vite `8.3.4`, Tailwind / Tailwind Vite `4.3.3`, React Vite plugin `6.1.2` |
| [Desktop](./apps/desktop/package.json) | Electron `44.8.0`, electron-builder `26.15.3`, electron-vite `6.0.0`, chokidar `5.0.0`, React / React DOM `19.3.1` |
| [Shared contracts](./packages/shared-types/package.json) | Zod `3.25.76`; workspace imports through `@flocksync/shared-types`, never across apps |
| TypeScript | Both `5.9.3` and `7.0.2` are locked for the different packages; do not flatten them arbitrarily |

The web app is an implemented **Vite React SPA, not Next.js**. API uses
parameterized Drizzle queries and SQLite WAL. Desktop's watcher/parser/helper
writer run in Electron's main process. The addon is sandboxed Lua 5.1 for
Interface 16001; host Python and .NET do not replace that runtime.

#### Exact download destinations and local data
| Asset | Where it goes |
| --- | --- |
| `FlockSync-Raider-Only.zip` | Extract into the actual WoW client's `Interface\AddOns`; expect `FlockSync\FlockSync.toc` |
| `FlockSync-Addon-Bundle.zip` | Extract into the same AddOns folder; expect sibling `FlockSync` and `FlockSync_AppHelper` folders |
| `FlockSync-Setup-0.5.1-x64.exe` | Run on the collector's Windows PC as an installer; not inside AddOns or on the remote server |
| `FlockSync-Portable-0.5.1-x64.exe` | Keep/run on Windows as the alternative to the installer; not both |
| `FlockSync_Remote_Server_Deploy.zip` | Extract the `FlockSync` project folder onto the server; run commands from that folder; it contains source, not prebuilt images |
| `flocksync-release.json` | Upload alongside the five payloads on one publicly readable GitHub release; consumed by update checkers |

Member/officer requirements are described in Download choices above. Desktop
filenames follow the desktop component version, not the overall tag. Default
WoW root is `C:\Program Files (x86)\World of Warcraft\_forever_`; preserve saved paths and choose the
actual client containing `Interface` and `WTF`. Do not add a nested ZIP-name
directory, delete SavedVariables, or replace addons while WoW is running.

Desktop reads `WTF\Account\<account>\SavedVariables\FlockSync.lua` and writes
sibling `FlockSync_AppHelper.lua`; each account folder needs its own sync.
WoW writes SavedVariables on logout/reload; use logout -> desktop success ->
login to consume returned helper data. Collector auth/settings persist in
Electron `app.getPath('userData')\config.json`, defined by
[configStore.ts](./apps/desktop/src/main/configStore.ts). It may contain tokens:
preserve it, never dump/commit/package it. Use the server URL without `/api`.

#### Container builds, deployment, and backup layout
- [Dockerfile.api](./Dockerfile.api): multi-stage `node:22-bookworm-slim`;
  build installs Python 3, make, g++ and pnpm `12.11.2` for native SQLite;
  runner includes sqlite3, runs as `node` (UID 1000), exposes internal 3001,
  and health-checks `/ready`. Images build for remote server ARM64 or AMD64.
- [Dockerfile.web](./Dockerfile.web): Node 22 Bookworm build with pnpm `12.11.2`,
  build argument `VITE_API_BASE_URL=/api`; `nginx:alpine` runtime with
  [nginx config](./deploy/nginx.conf.template), SPA fallback, and API/health/readiness proxy.
- [Compose](./docker-compose.yml): `api`, `web`, `cloudflared`, `db-backup`;
  **no published host ports**. Cloudflare's outbound tunnel targets
  `http://web:80`, nginx proxies to `api:3001`. No router port forwarding.
- API mounts host `./data/sqlite` at `/app/data`, using
  `/app/data/flocksync.db`. Keep this on the remote server's local persistent storage, not SMB/NFS.
  Production `.env` and `data` must survive source extraction/upgrades.
- Required configuration names are in [.env.example](./.env.example):
  `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`,
  `CLOUDFLARE_TUNNEL_TOKEN`, `NAS_BACKUP_PATH`, `GITHUB_REPOSITORY`.
  Real values are deliberately absent from this handoff. Compose maps the tunnel
  token to `TUNNEL_TOKEN`; API container sets its production host/port/DB path.
- `NAS_BACKUP_PATH` must already exist, be writable, and point to the mounted
  backup storage destination. Verify the backup storage is actually mounted first; otherwise
  the local mountpoint can misleadingly accept files.
- The Alpine backup container mounts DB files at `/data`, backup storage at `/backups`;
  it uses SQLite online `.backup`, `PRAGMA quick_check`, atomic publication,
  daily UTC-midnight scheduling, 30-day daily retention, and manually retained
  pre-update snapshots. The DB mount is writable for WAL/SHM coordination,
  not read-only; the live database is not moved to the backup storage.
- On the remote server, use `sh deploy/update-server.sh`: validates Compose, builds backup
  tooling, creates/verifies the pre-update backup, then rebuilds/recreates
  API/web and starts backup/tunnel services. Backup failure aborts before the
  app update. Verify `docker compose ps`, container logs, public login and sync.
  Do not bypass backup protection or use `docker compose down -v`.

#### Verification and release completion recipe
```powershell
pnpm run typecheck
pnpm run build
pnpm --filter @flocksync/api test:production
pnpm --filter @flocksync/api test:updates
# After selecting an unused release version and bumping changed components:
.\scripts\package-release.ps1 -ReleaseVersion <new-version>
```

Use [RELEASES.md](./RELEASES.md) for exact desktop, Lua 5.1, and optional
live-GitHub/Electron test commands. Run Docker builds when container definitions
change; don't start/restart a live stack for a documentation check. Windows
package/build success does not certify remote server deployment, real-game operation, or
an installer smoke test.

The packager typechecks, builds API/web, packages desktop, creates both addon
ZIPs and the source deployment ZIP, and generates the manifest from actual
package/TOC versions. Review contents and versions, not just six filenames.
Deployment packaging excludes dependencies/output, `.git`, databases/WAL/SHM,
real `.env` variants, links/junction descendants; never add secrets, desktop
config, SavedVariables, or stale artifacts to any release.

Preserve the numbered safety/upgrade instructions above. Commit/push/tag/upload
only when authorized; use one unused `v<version>` tag, all six assets, and the
matching prerelease flag. CurseForge uses its own main-addon version and release
type, requires configured `CF_API_TOKEN`, and skips unchanged versions on
automatic publication. Never upload an unchanged addon twice just because a
new server/desktop bundle exists.
