# Upgrade test recipes

Companion to [UPGRADE-PLAN.md](./UPGRADE-PLAN.md). Run from the repository root
in PowerShell. These are acceptance requirements, not claims that tests have passed.
Add missing wave-specific coverage before declaring a migration safe.

## Required maintainer handoff

Whenever maintainer testing is needed, the agent must output numbered, executable
instructions in its response, not only mention that tests remain. Include the
exact candidate/command/URL, safe setup, expected results, cleanup/rollback and
what evidence to report. Separate immediately runnable checks from game-required
checks; state whether test services are stopped. Keep acceptance pending until
the maintainer reports results. See the [W01 checklist](./UPGRADE-W01.md#maintainer-checklist).

## T01 - Build contract

1. After manifest changes install with the selected, pinned pnpm; review lockfile
   changes and then verify `pnpm install --frozen-lockfile`.
2. After each implementation change set run relevant regression tests and
   `pnpm run typecheck`.
3. Build affected packages: `pnpm --filter <package-name> build`.
   Cross-package migrations require `pnpm run build`.
4. Preserve strict typing and validation; do not suppress diagnostics to pass.

## T02 - API

```powershell
pnpm --filter @flocksync/api test:production
pnpm --filter @flocksync/api test:updates
```

Use disposable databases. Add the wave's CORS, token compatibility, environment,
epoch, migration and restore cases where absent. Existing green tests alone do
not prove those migration requirements. Never test wipe/restore on production.

## T03 - Web

```powershell
node --experimental-transform-types --test .\apps\web\test\*.test.mjs
```

Browser-check production pages at phone/tablet/desktop sizes: auth, editing,
roles, themes, icons and touch tooltips. Test PWA installation, update from an
older cached shell, offline fallback, reconnect and API cache exclusion.
Offline shell availability is not offline guild-data synchronization.

## T04 - Desktop without the game

Build shared types first. Keep live-update tests opt-out for ordinary offline
runs; do not enable `FLOCKSYNC_LIVE_UPDATE_TEST` unless deliberately testing GitHub.

```powershell
pnpm --filter @flocksync/shared-types build
$loader = ([System.Uri](Resolve-Path .\apps\desktop\test\typescript-loader.mjs).Path).AbsoluteUri
node --experimental-transform-types --experimental-loader $loader --test .\apps\desktop\test\*.test.ts
```

Test synthetic account-folder SavedVariables against an isolated API: parsing,
strict epochs, retries, authorization and helper output. Exercise file creation,
atomic replacement, partial writes, missing folders and rapid saves as applicable.
Use disposable desktop settings; never overwrite actual user configuration.
Manually launch installer and portable artifacts when packaging/runtime changes;
check preload/IPC, tray, startup settings, auth, saved paths and network requests.
Mocked tests are not proof of actual game integration.
For explicitly approved live updater tests, follow [RELEASES.md](./RELEASES.md);
its beta-dependent recipe is not a mandatory offline or stable-release check.

## T05 - Containers and architecture

```powershell
docker build -f Dockerfile.api -t flocksync-api:upgrade-test .
docker build -f Dockerfile.web -t flocksync-web:upgrade-test .
```

Use a unique test project/network and disposable volumes; never the production
Compose project, real tunnel, real database or actual backup destination.
Verify non-root startup, shared-types resolution, native SQLite, health, proxy,
SPA routes, auth, persistence across restart and backup/restore.
For native/runtime changes, build AMD64 and ARM64 using a suitable builder
(native or emulated) and exercise the resulting images; an AMD64-only build
does not prove ARM64 support. Record unavailable architecture tests as blocked.
Use an isolated backup sidecar to test scheduling, permissions and retention.
Stop test helpers and remove only explicitly identified test resources afterward.

## T06 - Game acceptance: maintainer required

1. Confirm a working client and test window. Run existing Lua 5.1 regressions
   listed in [RELEASES.md](./RELEASES.md); mocked API checks do not replace play.
2. Exit WoW; install candidate addons into the actual client's `Interface\AddOns`,
   preserving SavedVariables. Use the actual client root, not an assumed path.
3. Verify gear/role/event capture, equipment changes, reload and relogin; check Lua errors.
4. With another online guild character, verify real guild broadcasts and collection.
   Test rank-based and website ADMIN/OFFICER-granted collection on low-ranked alts.
5. Verify same-guild/realm scoping; reject unauthorized, wrong-guild, wrong-realm
   and guildless cases without weakening API authorization.
6. Exercise each relevant WoW account folder. Confirm real logout/reload writes
   trigger desktop sync, final records reach the website and stale writes cannot win.
7. Verify logout -> successful desktop sync -> login loads returned helper data.
   Check snapshots, guild identity, gear, collector grants and update metadata.
   Confirm update notices obey channel/version rules and do not spam on reload.
8. Never manually replace helper files while WoW is running.
   Missing Lua, game access, required guild partner or account coverage is a
   blocked check, not a pass. Record exactly what was and was not exercised.
