## FlockSync 0.9.0

### Guild identity, desktop setup, and remote server deployment
- The dashboard shows the guild name at the top center. The newest timestamped collector sync supplies the name and realm; guild identity is stored in SQLite so new backups retain it and restore brings it back.
- Wipe clears the stored guild identity until a fresh collector sync. Existing backups without guild metadata remain usable; sync a collector and refresh the dashboard to populate the name.
- Fixed database restore ordering for populated character records: accounts are restored before character/theme records that reference them.
- Desktop fresh installs default to `C:\Program Files (x86)\World of Warcraft\_forever_`, including the backslash before `_forever_`. Existing custom or older saved paths remain unchanged and editable.
- Deployment is hardware/vendor-neutral. Use `FlockSync_Remote_Server_Deploy.zip` and `scripts/package-remote-server-deploy.ps1` for an ARM64 or AMD64 Linux Docker host. Backup storage can be local, attached, or network-mounted.
- Existing `NAS_BACKUP_PATH` configuration values, mount locations, and persistent folder settings remain valid; no storage relocation is required.
- Database administration remains available: verified online backups, optional local downloads, latest/selected/uploaded restore, and confirmation-protected guild-data wipe with a final backup. Refresh clears old status messages; restore options show local date/time; inaccessible folders report actionable errors.

### Release channel and scope
This is a normal **Release-channel**, **pre-1.0** feature release. The new bundle is **0.9.0**, following the existing local `v0.8.0-release` tag; that tag is not modified or reused. The new release uses standard tag **v0.9.0**, without a literal `-release` suffix.

API/web and shared types advance **0.5.0 -> 0.6.0**. Desktop advances **0.5.0 -> 0.5.1**. Main addon **0.6.0** and AppHelper **0.2.2** are unchanged from the existing 0.8.0 tag. Unchanged addons are repackaged for a complete download set; already-current installations do not need reinstalling.

### Upgrade instructions
1. Preserve the remote server's `.env`, `data`, and independent backups. Extract `FlockSync_Remote_Server_Deploy.zip`; from the deployed project directory run `sh deploy/update-server.sh`. It verifies a pre-update backup before rebuilding/recreating API/web. Never use `docker compose down -v`.
2. Keep the existing `NAS_BACKUP_PATH` and mount location. Verify the backup storage is mounted and the API user can list and write it. Run `docker compose exec api id` to check the actual identity; a successful root-run scheduled backup does not prove API-user access. Do not copy example storage paths over a working configuration.
3. Startup automatically applies the guild-identity migration. Sync a collector and refresh the dashboard to populate the header. Backups made before this metadata existed need a new collector sync; they do not contain a recoverable guild name.
4. Quit desktop fully through its tray before updating to **0.5.1**, using either the installer or portable app. Preserve settings. Fresh installs use the Forever path; existing installations keep their saved path. Existing desktop 0.5.0 remains usable if the saved location is correct.
5. Keep main addon **0.6.0** and AppHelper **0.2.2** if already current; neither needs reinstalling. Older members install the main addon; older collectors install the bundle. Exit WoW before replacing files, extract into `Interface\AddOns` without an extra nested directory, and preserve SavedVariables.
6. No wipe or restore is required to upgrade. If using restore, a pre-restore safety backup is saved first; restored accounts/credentials replace current ones. Wipe requires typing its confirmation, saves a `final` backup, then clears guild records/themes while retaining accounts and backup-folder settings.
7. After an intentional wipe, use logout -> successful desktop sync -> login to load the reset marker. Updated collectors relay it to online guild members; the API rejects pre-reset data. Keep final/pre-restore backups until manually reviewed; they are not daily-retention snapshots.

### Download choices
- **FlockSync-Setup-0.5.1-x64.exe:** updated Windows installer for collectors; includes the Forever fresh-install client path.
- **FlockSync-Portable-0.5.1-x64.exe:** updated portable alternative; choose this or the installer, not both.
- **FlockSync-Raider-Only.zip:** unchanged main addon **0.6.0** for all members. Members do not need AppHelper, desktop, or a website account to broadcast data.
- **FlockSync-Addon-Bundle.zip:** unchanged main addon **0.6.0** plus AppHelper **0.2.2** for collectors. Collectors also need desktop and an authorized OFFICER/ADMIN website login.
- **FlockSync_Remote_Server_Deploy.zip:** updated **0.6.0 API/web** source, shared contracts, migrations, theme assets, and deployment/backup tooling. This replaces the old hardware-specific archive name.
- **flocksync-release.json:** generated component-version manifest; publish beside the other five assets on one public GitHub release.

### Component versions
- Desktop: **0.5.1 - updated** from 0.5.0.
- Server/API/web: **0.6.0 - updated** from 0.5.0; API/web remain aligned.
- Shared types: **0.6.0 - updated** from 0.5.0.
- Main addon: **0.6.0 - unchanged**.
- AppHelper: **0.2.2 - unchanged**.
- Root workspace: **0.2.2 - unchanged**.

### New installations
Members install the main addon and finish the walkthrough. Collectors additionally install AppHelper and one desktop download, select the client root containing `Interface` and `WTF`, and use their guild server's full URL without `/api`.

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first-time remote-server setup, storage permissions, backups, and offline recovery. Use local persistent storage for live SQLite; network storage is for backups only. Collection only works while a catcher is online and cannot recover missed broadcasts.

### Verification and publication status
Completed verification: workspace typecheck; 20 API tests; 11 web tests; four desktop configuration tests; six deployment/backup tests; six Lua 5.1 regression scripts; and API/web/backup Docker builds. The combined-release packager generated all six downloads and the 0.9.0 manifest. All 253 archived source files matched current sources, installers matched desktop packaging output, and archive checks found no real environment files, databases, or credential/config artifacts. `git diff --check` passed.

The operator reported successful backup, restore, and wipe tests in a smaller private environment; that does not certify every deployment or live-game scenario.

The older `localCapture.test.lua` harness has a known missing `GetInventoryItemTexture` mock and is not counted as passing. Dedicated gear-persistence and database-reset Lua checks are separate. No commit, push, tag, upload, or publication is performed by this preparation step.

### Publishing and update notices
Publish one GitHub release tagged **v0.9.0**, titled **FlockSync 0.9.0**, with **Set as a pre-release unchecked** and all six current assets. Do not reuse or rename the existing tag. Automatic CurseForge publishing should skip unchanged main addon **0.6.0** if already represented in an earlier published combined release; verify prior upload status before any manual upload. For older member installations, distribute addon 0.6.0 with release type **Release**.

Checkers compare component versions, not the bundle tag: server 0.5.0 and desktop 0.5.0 can discover updates after publication. Already-current main addon/AppHelper should not receive unnecessary prompts. Release/Beta/Alpha channels include eligible stable updates; no component moves to 1.0.

---

### Maintainer / next-agent handoff (verified October 27, 2026)

This section is an operational snapshot, not an additional release or proof of
publication. Start with [.github/copilot-instructions.md](./.github/copilot-instructions.md)
for coding/build rules, [RELEASES.md](./RELEASES.md) for packaging/publication, and
[DEPLOYMENT.md](./DEPLOYMENT.md) for first install, backup/restore, and remote server updates.
Do not read secrets into an agent transcript to reconstruct the environment.

#### Current checkpoint and pending work
- Local `main` / `origin/main` were aligned at `38e535e`, with local tag `v0.7.1`.
  Remote release assets, CurseForge uploads, production deployment, and live
  game behavior were **not independently verified during this handoff**.
- Before this documentation task, the worktree already contained an uncommitted
  [AttunementFamilyRow.tsx](./apps/web/src/components/AttunementFamilyRow.tsx)
  change (17 insertions / 15 deletions). Preserve it, inspect it when resuming
  that task, and do not claim it shipped in v0.7.1. No version bump exists for it.
- The local manifest identifies 0.7.1 and the component versions above.
  Artifact timestamps were mixed: deployment ZIP dated October 27, other
  payloads/manifest October 21. Timestamps alone do not prove source parity.
  Any commit/release preparation must rebuild and inspect the intended sources.
  Do not reuse the published 0.7.1 tag for new code.
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
The verified Windows checkout is `C:\Users\johnn\Coding Projects\FlockSync`;
use PowerShell, quote paths containing spaces, and use Windows path separators
locally. server/container commands use Linux paths and `sh`.

| Tool | Verified local version / availability |
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
| `FlockSync-Setup-0.5.0-x64.exe` | Run on the collector's Windows PC as an installer; not inside AddOns or on the remote server |
| `FlockSync-Portable-0.5.0-x64.exe` | Keep/run on Windows as the alternative to the installer; not both |
| `FlockSync_Remote_Server_Deploy.zip` | Extract the `FlockSync` project folder onto the server; run commands from that folder; it contains source, not prebuilt images |
| `flocksync-release.json` | Upload alongside the five payloads on one publicly readable GitHub release; consumed by update checkers |

Member/officer requirements are described in Download choices above. Desktop
filenames follow the desktop component version, not the overall tag. Default
WoW root is `C:\Program Files (x86)\World of Warcraft\_classic_beta_`; choose the
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
  and health-checks `/health`. Images build for remote server ARM64 or AMD64.
- [Dockerfile.web](./Dockerfile.web): Node 22 Bookworm build with pnpm `12.11.2`,
  build argument `VITE_API_BASE_URL=/api`; `nginx:alpine` runtime with
  [nginx config](./deploy/nginx.conf), SPA fallback, and API/health proxy.
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
