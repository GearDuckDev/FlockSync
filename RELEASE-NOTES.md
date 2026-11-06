## FlockSync 0.10.1

### Reliable character sync and refreshed application dependencies
- Fixed character uploads after a database reset so a character's main/alt link
  is preserved. Linked characters still retain their own gear, role and availability.
- Updated the Windows desktop runtime, installer tools and file watcher. Reload,
  logout and file-replacement saves retain automatic sync, with stable-write
  handling and no helper-file feedback loop in the verified scenarios.
- Updated server, website and shared validation/build dependencies while
  preserving login, guild collection permissions, saved client paths, themes,
  availability and helper data. Existing UI/background colors can remain linked
  or be configured separately; this release does not introduce another theme redesign.
- Refreshed the backup container to Alpine 3.24. Online backups, integrity
  verification, private file permissions, daily retention and preserved pre-update
  snapshots remain in place.
- Updated addon release-workflow tools and excluded project upgrade/operations
  documents from the CurseForge addon package. Main addon and AppHelper code
  are unchanged; current addon installations do not need reinstalling.

### Release channel and scope
Prepared as **v0.10.1**, a normal **Release-channel**, **pre-1.0** maintenance
release after published v0.10.0. No preview suffix or GitHub prerelease flag.
Preparation is not publication, deployment or permission to create a tag.

### Upgrade instructions
1. Server operators: preserve deployed `.env`, local SQLite data, independent
   backups, local overrides/startup units and backup storage settings. Stage
   the new server ZIP without copying examples over production configuration.
2. Verify the configured backup storage is mounted and writable with the expected
   ownership and optional `.flocksync-storage-id`. Keep the live WAL SQLite
   database on local persistent storage, not SMB/NFS; network storage is for backups.
3. From the deployed project directory run `sh deploy/update-server.sh`. It
   verifies a fresh pre-update backup before rebuilding/recreating services.
   Expect a brief interruption. Do not bypass failure guards with direct restarts
   or `docker compose down -v`. Re-enable any paused external retry automation
   only after successful checks.
4. Verify container health, `/ready`, website login, guild header, linked-character
   grouping, collector sync and backup health. No wipe or database restore is
   needed for this update. Database-reset main/alt preservation applies to fresh
   character uploads; it does not reconstruct already lost relationships without
   a valid source export.
5. Collectors: quit Desktop through its tray icon, then install **0.5.2** or use
   its portable alternative. Preserve saved settings and select the actual WoW
   client root containing `Interface` and `WTF`. Use your guild server's full URL
   without `/api`; do not use a previous local test URL.
6. Members already on main addon **0.6.0**, and collectors on AppHelper **0.2.2**,
   do not need to reinstall those unchanged components. Older addon installations
   should be updated with WoW closed, preserving SavedVariables and avoiding
   extra ZIP-named folder nesting.
7. For returned helper data, use logout/exit -> successful Desktop sync -> login.
   WoW writes SavedVariables on reload/logout/exit; Desktop cannot upload unsaved
   in-game memory. Each WoW account folder needs its own sync.

### Download choices
- **FlockSync-Setup-0.5.2-x64.exe:** updated Windows collector installer.
- **FlockSync-Portable-0.5.2-x64.exe:** updated portable alternative; choose one
  Desktop download, not both. Windows candidates are unsigned; no signing
  certificate is configured. Do not disable Windows protection to run them.
- **FlockSync-Raider-Only.zip:** unchanged main addon **0.6.0** for members.
  Members do not need Desktop, AppHelper or a website account to broadcast.
- **FlockSync-Addon-Bundle.zip:** unchanged main addon **0.6.0** and AppHelper
  **0.2.2** for collectors. Collectors also need Desktop and an authorized
  OFFICER/ADMIN website login.
- **FlockSync_Remote_Server_Deploy.zip:** updated **0.7.1 API/web** source,
  shared contracts, migrations, theme assets and deployment/backup tooling for
  AMD64 or ARM64 Linux Docker hosts. It contains source, not prebuilt images.
- **flocksync-release.json:** generated component-version manifest; attach beside
  all five payloads on one public GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Desktop | **0.5.2** | Updated from 0.5.1 |
| Server/API/web | **0.7.1** | Updated from 0.7.0; API/web aligned |
| Shared types | **0.7.1** | Updated from 0.7.0 |
| Main addon | **0.6.0** | Unchanged; no reinstall needed |
| AppHelper | **0.2.2** | Unchanged; no reinstall needed |
| Root workspace metadata | **0.2.2** | Unchanged; not the bundle version |

### New installations
Members install the main addon and finish the walkthrough. Collectors also
install AppHelper and one Desktop download, select their actual client folder
and log in with an authorized website account.

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first-time server setup and offline
recovery; [SERVER-OPERATIONS.md](./SERVER-OPERATIONS.md) covers maintenance.
Collection requires an online authorized collector and cannot recover missed
broadcasts. Server operators supply their own environment, tunnel, domain and
backup location; the package does not install host-specific monitoring.

### Verification and publication status
W01-W11 upgrade evidence and scoped maintainer acceptance are recorded in
[UPGRADE-PLAN.md](./UPGRADE-PLAN.md) and [UPGRADE-TESTS.md](./UPGRADE-TESTS.md).
The pre-version-bump candidates passed offline regressions and applicable
portable/installed/game tests, including reload equipment removal/restoration,
logout/sync/login, helper loading, upload-failure recovery and tray/relaunch.
Original helper files and startup entries were restored and verified; normal
Desktop settings were unchanged. All local test services are stopped.

W11 backup checks passed on AMD64 and emulated ARM64, including actual accelerated
cron and restore into a fresh database. Routing, readiness, backup-health,
proxy trust, SPA and PWA serving checks passed. The hosted
[no-publish workflow preview](https://github.com/GearDuckDev/FlockSync/actions/runs/42155373845)
passed, including downloaded artifact inspection; CurseForge publication was skipped.

**W12 final-version automated builds and artifact verification passed.** The full
release packager passed workspace typecheck, API/web builds, Windows packaging
and all ZIP/manifest generation. Final tests: 11 API production, 14 API updates,
16 web and two deployment-packaging regressions; Desktop 27 passed with one
optional live-network skip. Three watcher tests passed under the final packaged
Electron runtime. Final AMD64 API/web image builds and isolated container
readiness/backup-health/proxy tests passed, including SPA/PWA serving.
All six manifest assets were inspected: copied executable hashes match, packaged
Desktop output matches its build, addon ZIPs byte-match unchanged sources, and
all 214 server ZIP source files match the workspace with required exclusions.
**Final 0.5.2 portable and installed smoke acceptance passed**, recorded in
[the W12 checklist](./UPGRADE-TESTS.md#w12-final-version-candidate-handoff).
The maintainer confirmed version, login/sync, tray reopen/Quit and portable
relaunch with retained settings. Automatic synthetic role sync reached the final
0.7.1 server without manual upload. Installed executable/ASAR match the verified
candidate. Normal settings/startup entries were preserved; all test services
stopped and disposable synthetic database removed. No real game files were used
in these final smoke checks.
No new release, tag or production deployment has been created.
Retained warnings and fresh-release-age holds are documented in the
[dependency audit](./UPGRADE-AUDIT-2026-11-04.md). This is not a zero-vulnerability
claim. Live multiple-account, reboot/startup activation, active-upload shutdown
cancellation, real NAS/overnight scheduling and independent total-host outage
checks are not established by these tests. Lua 5.1 standalone tests were not rerun;
unchanged addon runtime files do not justify claiming them passed.

### Publishing and update notices
Only when separately authorized, publish one GitHub Release tagged **v0.10.1**,
titled **FlockSync 0.10.1**, with prerelease **unchecked** and all six verified
assets. Check prior CurseForge status first: unchanged main addon 0.6.0 should
be skipped by the automatic unchanged-version guard; never manually duplicate it.
Checkers compare each component's version, not the bundle tag. Current addon/
AppHelper installs need no update; Desktop/server do after this release is published.
Release/Beta/Alpha channels all permit eligible stable updates. Nothing moves to 1.0.

---

### Maintainer / next-agent handoff
Start with [.github/copilot-instructions.md](./.github/copilot-instructions.md),
[RELEASES.md](./RELEASES.md), [DEPLOYMENT.md](./DEPLOYMENT.md) and
[README.md](./README.md). Inspect current branch/status, package/TOC versions,
manifest contents and actual publication state. v0.10.0 is published; v0.10.1
was unused at preparation. Do not reuse published tags or infer ZIP freshness
from its name. Scope/evidence/checkpoints live in the active upgrade plan.

#### Build definitions and packages
The committed lockfile is format 9.0; repository/container pnpm is **12.16.1**.
Docker API/web builds use Node 22 Bookworm; native API builds install Python 3,
make and g++. API runner includes SQLite CLI and runs as UID 1000. Web runtime is
`nginx:alpine`, observed nginx 1.31.8 / Alpine 3.24.4; backup uses Alpine 3.24.
Tags/package repositories are mutable; record actual image identities when testing.
Host editor extensions are not installed container compilers or Lua interpreters.
Machine-specific inventories and update tasks belong in local-only notes.

| Area | Tested project versions (see manifests/lockfile for full graph) |
| --- | --- |
| API | Fastify 5.12.8; CORS 11.4.0; JWT 10.2.7; rate-limit 11.2.2; bcryptjs 3.0.3; better-sqlite3 13.0.3; dotenv 18.0.9; Drizzle ORM 0.45.4 / Kit 0.31.11; tsx 4.23.15 |
| Web | React/DOM 19.3.1; lucide-react 1.67.0; Vite 8.3.5; Tailwind/plugin 4.3.4; React Vite plugin 6.2.1 |
| Desktop | Electron 45.2.3; builder 26.18.0; electron-vite 6.0.0; Chokidar 6.0.0 |
| Shared/compiler | Zod 4.6.7; TypeScript 7.0.2; runtime-aligned Node declarations retained |

The web is a Vite React SPA, not Next.js. Shared contracts stay in
`@flocksync/shared-types`; do not import between apps. API uses parameterized
Drizzle and SQLite WAL. Addons run sandboxed Lua 5.1, Interface 16001.

#### Destinations and safety
| Asset | Destination |
| --- | --- |
| Raider ZIP | Actual client `Interface\AddOns`, yielding `FlockSync\FlockSync.toc` |
| Addon bundle | Same directory, sibling `FlockSync` and `FlockSync_AppHelper` |
| Installer / portable | Windows collector; run one, never put it in AddOns/server |
| Server ZIP | Extract the `FlockSync` source folder on Linux; run updater inside it |
| Manifest | Attach unchanged to the combined release; not an addon installation file |

Default client root is `C:\Program Files (x86)\World of Warcraft\_forever_`;
preserve saved alternatives. Desktop reads
`WTF\Account\<account>\SavedVariables\FlockSync.lua`, uploads validated data and
writes sibling `FlockSync_AppHelper.lua`. Never manually replace helper files
while game/Desktop is running. Auth/settings are sensitive Electron userData
configuration: preserve, never dump/commit/package.

Compose services are `api`, `web`, `cloudflared`, `db-backup`, with no published
host ports. Tunnel -> `http://web:80` -> API `:3001`. Preserve deployed `.env` and
`data/sqlite`; validate `NAS_BACKUP_PATH` before starting. Configure names from
`.env.example`, never record actual credentials. Backups run UTC midnight with
30-day daily retention and manually retained pre-update snapshots; writable
WAL/SHM coordination access is intentional.

For final release preparation use `.\scripts\package-release.ps1 -ReleaseVersion 0.10.1`.
Ordinary changes require affected builds/tests plus `pnpm run typecheck`, not
unrequested full packaging. Bump changed components once when ready to commit:
fixes +0.0.1, significant features +0.1.0; reserve 1.0 for actual primetime readiness.
Use `sh deploy/update-server.sh` for separately authorized deployment; failed
backup must abort the update. No live restarts merely to validate changes.
Do not package credentials, databases, SavedVariables, local notes, dependencies,
caches, links or stale output. Keep all six manifest assets; remove only identified
superseded local downloads after final verification, never published releases/tags.
