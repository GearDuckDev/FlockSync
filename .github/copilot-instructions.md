# Project Context: FlockSync (by GearDuckDev)

You are an expert Full-Stack TypeScript and World of Warcraft Lua developer building **FlockSync**, a hybrid guild management platform for **WoW Forever (Interface 16001)** under the **GearDuckDev** organization.

## System Architecture & Tech Stack
1. **`/packages/shared-types`**: Pure TypeScript & Zod schemas shared across the API, Desktop Sync App, and Web Frontend.
2. **`/apps/api`**: Fastify (Node.js + TypeScript) REST API using **SQLite (`better-sqlite3` in WAL mode) + Drizzle ORM**. Runs in Docker on a Raspberry Pi 5 (NVMe storage) with automated file backups to a Synology NAS. Uses standard JWT authentication (email/username + password via `bcrypt` / `@fastify/jwt`) shared between the Desktop App and Web Frontend.
3. **`/apps/desktop`**: Standalone Windows `.exe` built with **Electron (`electron-vite` + React + TypeScript)**. 
   - Provides a clean Login UI (authenticating against `/apps/api` to obtain a JWT) and a configurable WoW path setting (defaulting to `C:\Program Files (x86)\World of Warcraft\_classic_beta_`).
   - Uses `chokidar` in the Electron main process to watch `WTF/Account/*/SavedVariables/FlockSync.lua`, parses Lua tables to JSON, POSTs to `/apps/api`, and writes server return payloads to `FlockSync_AppHelper.lua`.
4. **`/apps/addon/FlockSync` & `/apps/addon/FlockSync_AppHelper`**:
   - `FlockSync`: Main Lua addon (Interface `16001`). Captures player gear (`GetInventoryItemLink`), roles, and broadcasts hidden updates via `C_ChatInfo.SendAddonMessage` on the `GUILD` channel. Authorized collectors aggregate broadcasts into `FlockSyncDB`; preserve rank-based and website-granted same-guild/realm collection checks.
   - `FlockSync_AppHelper`: Bridge addon (`FlockSyncHelperDB`) ingests server updates written to its SavedVariables by the desktop app. Prefer logout -> desktop sync -> login for loading returned data safely.
5. **`/apps/web`**: Implemented React SPA using Vite, Tailwind CSS, and the same JWT auth endpoints/shared types. This is **not Next.js**. Production nginx serves the SPA and proxies `/api` to Fastify.

---

## Strict Coding & Architectural Rules

### 1. Modularity & File Granularity
- **Small, Focused Files:** Never generate monolithic files. Keep files under ~200 lines. Split routes, controllers, database services, Lua event handlers, and UI components into single-purpose modules.
- **Explicit Named Exports:** Use named exports (`export const ...` / `export interface ...`) across all TypeScript packages. Avoid default exports unless required by a framework.
- **Strict Monorepo Boundaries:** Never import across `/apps/*`. All shared contracts, DTOs, and Zod validators MUST live in `@flocksync/shared-types`.

### 2. TypeScript & Validation Standards
- **Strict TypeScript:** `strict: true`, `noImplicitAny: true`, and `exactOptionalPropertyTypes: true` must be respected everywhere.
- **Zero `any` Policy:** Never use `any`. Use `unknown` combined with Zod parsing for external or untrusted inputs.
- **Boundary Validation:** Every API request body, JWT payload, and Lua-to-JSON parser output must be validated with a Zod schema from `@flocksync/shared-types`.

### 3. Security, Conflict Resolution & Reliability
- **Epoch Conflict Resolution:** Every mutable record (gear, role, character status) carries a WoW server epoch timestamp (`GetServerTime()`). Database upserts MUST only overwrite existing records when `incoming.updatedAt > existing.updatedAt`.
- **Database Safety:** Use Drizzle ORM parameterized queries exclusively. Enable SQLite `PRAGMA journal_mode = WAL;` on connection startup.
- **Secrets Management:** Never hardcode secrets, JWT signing keys, or database paths. Read from `process.env` and validate environment variables with Zod on startup.
- **Defensive Error Handling:** Wrap all file I/O and network operations in `try/catch` blocks with structured logging. Return standard HTTP status codes (`400`, `401`, `403`, `409`, `500`).

### 4. WoW Lua (Interface 16001) Standards
- **Lua 5.1 Environment:** WoW uses a sandboxed Lua 5.1 runtime. Do not use Lua 5.2+ features or standard OS/IO libraries (`io.*`, `os.*`).
- **Namespace Isolation:** Never pollute `_G`. Capture the addon name and private table at the top of every Lua file: `local addonName, ns = ...`. Only `FlockSyncDB` and `FlockSyncHelperDB` are permitted as globals.
- **Modern `C_` APIs:** Interface `16001` enforces modern namespaces. Always use `C_ChatInfo.SendAddonMessage`, `C_ChatInfo.RegisterAddonMessagePrefix`, `C_Timer.After`, and `C_Item`.
- **Message Throttling & 255-Byte Limit:** Addon messages are strictly limited to 255 bytes. Payloads exceeding 250 bytes must be chunked and throttled before broadcasting.
- **Event-Driven Execution:** Never run polling loops in `OnUpdate`. Trigger scans strictly on game events (`PLAYER_ENTERING_WORLD`, `PLAYER_EQUIPMENT_CHANGED`, `PLAYER_LEVEL_UP`).

### 5. Agent Execution Protocol
- **Step-by-Step Scope:** Only execute the specific phase or step requested by the user. Do not scaffold unrequested apps.
- **Self-Verification:** After generating or editing TypeScript files, always run `pnpm run typecheck` in the terminal to verify zero compiler errors before completing your response.
- **Build after changes:** After each completed change set, run relevant regression tests and `pnpm run typecheck`. Build only the package(s) affected by the change; do not rebuild unchanged apps or components. Use the whole-workspace build only when changes cross package boundaries or require it to validate shared build dependencies. Refresh the relevant user-testable artifact after each change so it is ready to test: for API/web source changes, rebuild `release\FlockSync_Pi_Deploy.zip` with `.\scripts\package-pi-deploy.ps1`; for other components, rebuild their corresponding testable artifact when one is used for testing. Do not claim completion with failed builds. Run the complete release packager only when preparing an explicitly requested release, so its Windows executables, addon ZIPs, deployment ZIP, and manifest match the final sources. Validate changed Dockerfiles/Compose with container builds as well; do not restart a live deployment just to validate changes.
- **Versioning when ready to commit:** Wait until the user is ready to commit, then increment only changed components: small changes/bug fixes by **0.0.1** (patch), significant changes/new features by **0.1.0** (minor). Keep API/web aligned and apply the same rule to the overall release bundle. A specific user-requested increment overrides the default. Do not increment on every edit/build or bump unchanged components for rebuilding. Documentation-only updates do not require a runtime version bump.
- **1.0 gate:** Reserve **1.0.0** for the full, primetime FlockSync release when the game goes live and the product is actually ready. The hoped-for game launch is **November 4, 2026**, not a confirmed deadline or permission to automatically release 1.0. Keep pre-1.0 stable builds on the normal Release channel unless a preview is explicitly intended.
- **Commit Messages:** When generating commit messages, describe the user-visible changes in concise, plain language suitable for display in the CurseForge changelog. Avoid internal implementation details and include the main addon improvements users will notice.
- **Release Notes Style:** Always match the established detailed, copy-ready Markdown release-note style; do not replace it with a short summary paragraph. Start with `## FlockSync <overall-version>`, then include user-visible fixes/features, numbered upgrade instructions for affected components, download choices explaining all six combined-release assets and member/officer requirements, component versions explicitly marked updated/unchanged, and update-channel guidance. Include first-install guidance or a link to `DEPLOYMENT.md`. State when unchanged components do not need reinstalling. Preserve applicable safety/migration instructions and accurately describe what was built, tested, and published. Use the previous release notes as the formatting reference and adapt the content to the current release.
- **Addon Versioning at Final Commit:** Before preparing a final commit for addon changes, identify every affected addon and increment its `## Version` in its `.toc` file(s). Use a patch increment (`0.0.1`, e.g. `0.2.0` to `0.2.1`) for a fix and a minor increment (`0.1`, e.g. `0.2.0` to `0.3.0`) for a new feature. Preserve any existing prerelease suffix while iterating alpha builds. Do not move to `1.0.0` or a later major version until the release is live and ready for general use; after that, choose the appropriate semantic version increment. Do not bump unrelated addon versions.
- **Release Checklist:** Follow `RELEASES.md`. Publish ONE GitHub Release tagged `v<overall-release-version>` with all downloads and generated `flocksync-release.json`. Run `.\scripts\package-release.ps1 -ReleaseVersion <version>` to build/package and generate the manifest from component versions. Checkers compare each component's own version, not the overall tag: bump changed components, leave unchanged components alone unless the user explicitly requests otherwise. Keep API/web versions aligned. Match GitHub's prerelease flag to the overall alpha/beta suffix. Never attach secrets, local configuration, or stale artifacts. Checkers require publicly readable releases/downloads. Publish the member addon ZIP separately on CurseForge using its addon version and matching release type.

## Agent Handoff: Read This Before Resuming

This is the workspace-wide instruction entry point. Read the current
[release notes and environment handoff](../RELEASE-NOTES.md),
[release checklist](../RELEASES.md), [deployment guide](../DEPLOYMENT.md), and
[project overview](../README.md) before release/deployment work. Do not create a
second competing root instructions file. This inventory was checked on
**2026-10-27**; re-check mutable tools, versions, git status, and publication state.

### Current checkpoint and worktree safety

- Repository: `GearDuckDev/FlockSync`; Windows checkout
  `C:\Users\johnn\Coding Projects\FlockSync`; PowerShell terminal. Use quoted
  Windows paths locally; Linux shell paths apply only inside containers/on Pi.
- At handoff: branch `main`, commit `38e535e`, tag `v0.7.1`, aligned with
  `origin/main`. These are local observations, not proof of GitHub/CurseForge
  publication or successful production deployment.
- Component versions: desktop **0.5.0**, API/web **0.4.1**, shared types
  **0.4.1**, main addon **0.5.1**, AppHelper **0.2.2**, root **0.2.2**.
  Re-read package manifests/TOCs and `release/flocksync-release.json`.
- An existing uncommitted change in
  [AttunementFamilyRow.tsx](../apps/web/src/components/AttunementFamilyRow.tsx)
  predates this documentation task. Preserve it; it has no component version
  bump yet. Do not describe the dirty tree as the exact released v0.7.1 sources.
- Never infer ZIP freshness from filenames, tag, or timestamps alone. Inspect
  contents/manifest and rebuild from the final intended sources. Never reuse
  an already published tag for changed code, or publish a local rebuild as-is.

### Verified local tools and package source of truth

| Tool | Installed version / state |
| --- | --- |
| Node / pnpm / Git | `24.22.0` / `12.11.2` / `2.56.0.windows.3` |
| VS Code | `1.143.1`, x64 |
| Docker Desktop engine / CLI | responsive Linux x86_64 engine / `29.9.2`; context `desktop-linux` |
| Docker Compose / Buildx | `5.6.1` / `0.38.1` |
| VS Code Container Tools | `ms-azuretools.vscode-containers@2.5.3` |
| VS Code Dev Containers | `ms-vscode-remote.remote-containers@0.469.0` |
| Editor tooling | ESLint `3.0.34`, Prettier `12.4.0`, GitHub Actions `0.32.3` |
| Python / MSBuild | Python `3.14.7`; VS 18 Build Tools MSBuild `18.11.1` installed, not on PATH |
| Lua / native compiler tools | `lua`, `lua5.1`, `luajit`, `make`, `g++`, `msbuild`, `devenv` not found on PATH |
| .NET | Host `10.0.13`; no SDK installed; not a FlockSync prerequisite |

- MSBuild location:
  `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Current\Bin\MSBuild.exe`.
  This does not certify C++ workloads or a usable `cl` toolchain.
- No `.devcontainer` / `devcontainer.json` exists. Installed editor extensions
  do not mean this repo runs inside a dev container. Dockerfiles/Compose are
  the container build definitions. At inventory time Docker had no containers;
  the production Pi's installed versions/status were not remotely inspected.
- [VS Code settings](../.vscode/settings.json) configure WoW API Lua annotations;
  annotation files are not a Lua runtime. Use Lua **5.1** for addon checks, not
  the installed Python interpreter or a newer incompatible Lua runtime.
- Exact declared dependencies/scripts live in [root package.json](../package.json),
  [API](../apps/api/package.json), [web](../apps/web/package.json),
  [desktop](../apps/desktop/package.json), and
  [shared types](../packages/shared-types/package.json). The committed
  [pnpm lockfile](../pnpm-lock.yaml) (format 9.0) pins resolutions;
  [workspace configuration](../pnpm-workspace.yaml) defines package/build permissions.
  Do not replace these with npm/yarn or upgrade packages just to resume work.
- Runtime/build inventory and exact resolved versions are in the release-notes
  handoff below. Restore missing dependencies with `pnpm install --frozen-lockfile`;
  do not reinstall a working checkout unnecessarily.

### Commands, data flow, and artifact destinations

```powershell
pnpm run typecheck
pnpm run build
pnpm --filter @flocksync/api test:production
pnpm --filter @flocksync/api test:updates
# Final commit/release only: choose an unused version after updating changed components.
.\scripts\package-release.ps1 -ReleaseVersion <new-version>
```

Use the test recipes in [RELEASES.md](../RELEASES.md) for desktop/Lua/live-update
checks; an unavailable Lua interpreter is a limitation to report, not a passed
test. Root build does not itself produce installers or addon ZIPs.

| Download in `release` | Destination and audience |
| --- | --- |
| `FlockSync-Raider-Only.zip` | Members: extract to the actual client's `Interface\AddOns`, yielding `FlockSync\FlockSync.toc` |
| `FlockSync-Addon-Bundle.zip` | Collectors: same AddOns directory, yielding sibling `FlockSync` and `FlockSync_AppHelper` folders |
| `FlockSync-Setup-0.5.0-x64.exe` | Windows collector installer; run it, do not extract into AddOns or Pi |
| `FlockSync-Portable-0.5.0-x64.exe` | Windows collector portable alternative; choose one desktop download |
| `FlockSync_Pi_Deploy.zip` | Server operator: extract `FlockSync` source folder on Pi; run deployment commands from inside it |
| `flocksync-release.json` | Attach unchanged beside the five payloads on one public GitHub release; do not put in AddOns |

- Desktop filenames track its component version, not the bundle tag.
  Members do not need desktop/AppHelper/server accounts. Collectors need both
  addons, desktop, and an authorized OFFICER/ADMIN website login.
- Default client path:
  `C:\Program Files (x86)\World of Warcraft\_classic_beta_`; select the actual
  client root containing `Interface` and `WTF`. Exit WoW to replace addons;
  avoid extra ZIP-named folder nesting and preserve SavedVariables.
- Desktop reads `WTF\Account\<account>\SavedVariables\FlockSync.lua`, POSTs
  validated records, and writes sibling `FlockSync_AppHelper.lua`. Use
  logout -> successful desktop sync -> login for server-returned helper data;
  each account folder needs its own sync. Never overwrite helper files manually
  while WoW is running. Collection cannot recover broadcasts sent while offline.
- Desktop settings/auth are in Electron `app.getPath('userData')\config.json`;
  see [configStore.ts](../apps/desktop/src/main/configStore.ts). Treat it as
  sensitive: never dump, commit, or package it. Use the full server URL without `/api`.

### Docker/Pi operations and safety

- Pi 5 / 64-bit OS: live WAL SQLite on local NVMe; Synology NAS for backups only.
  Docker builds install their own Linux tools; Windows global compilers are not
  substitutes. API/web use Node 22 Bookworm build stages and pinned pnpm;
  production web runs nginx. See the release-notes handoff for stages/packages.
- Compose services are `api`, `web`, `cloudflared`, `db-backup`. No host ports
  are published; Cloudflare Tunnel routes to `http://web:80`, and nginx
  proxies `/api` and `/health` to `api:3001`.
- Configure names from [.env.example](../.env.example), never actual values in
  documentation. Preserve deployed `.env` and `data\sqlite` when updating.
  Mount and verify an existing writable `NAS_BACKUP_PATH` before starting;
  do not let an absent NAS mount silently become a local backup destination.
- From the deployed Pi project directory run `sh deploy/update-server.sh`,
  then `docker compose ps` and `docker compose logs --tail 100 api web cloudflared`.
  The updater verifies an online SQLite backup before rebuilding/restarting.
  Do not bypass it with direct Compose restarts or `docker compose down -v`.
- Daily backups run at UTC midnight, retain daily files for 30 days, and keep
  pre-update snapshots until manual removal. Backup SQLite mounts need WAL/SHM
  coordination access; don't force a read-only mount based on a stale doc.
- Do not package `.env`, databases/WAL/SHM, credentials, SavedVariables, desktop
  config, dependencies, build caches, symlinks/junctions, or stale release output.
  GitHub release preparation does not authorize committing, tagging, pushing,
  publication, production changes, or duplicate CurseForge uploads.