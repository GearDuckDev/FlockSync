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
   Confirm update notices obey channel/version rules. Record reload behavior;
   the maintainer accepts either repetition or suppression on reload.
8. Never manually replace helper files while WoW is running.
   Missing Lua, game access, required guild partner or account coverage is a
   blocked check, not a pass. Record exactly what was and was not exercised.

### Maintainer evidence - November 4-5, 2026

These are maintainer-reported observations, not agent-executed game tests.
The installed/deployed candidates were not independently identified by version,
source revision or checksum. Do not treat this evidence as acceptance of later
dependency migrations or newly packaged installers.

| Check | Reported result |
| --- | --- |
| Setup, role detection and role window | Passed; no reported Lua errors |
| Own gear and availability to website | Passed, including equipment changes |
| Main/alt grouping | Passed after the post-reset linkage fix |
| Helper round trip | File exists; login after desktop sync produced no reported Lua error |
| Guild availability collection | Passed after allowing the sender to remain online before collector reload |
| Automatic availability broadcast | Passed for multiple characters without Force Scan |
| Automatic remote equipment broadcast | Removal and restoration reached website; no reported errors |
| Guild-rank collector | Passed |
| Low-ranked website-authorized collector | Passed; status identified website Admin authorization |
| Same-account officer alt | Status identified Account Officer (Same Guild), not unauthorized access |
| Guild officer without website Officer/Admin role | Server upload rejected |
| Different guild/realm, including same-account cases | Upload rejected |
| Guildless alts | Upload rejected |
| Returned data to non-collector characters/accounts | Reported working; individual snapshot fields not inventoried |
| Update notices | No notice when current; newer-version notice worked on another installation |
| Alpha/beta update behavior | Reported working; exact version/channel pairs not recorded |
| Reload-notice repetition | Maintainer accepts either behavior; non-repetition requirement waived |

Coverage limits and remaining evidence:

- The maintainer uses one WoW account. Additional account-folder testing is
  unavailable, not a pass for multi-account watching.
- Rejection of server uploads does not independently prove that an unauthorized
  addon never aggregates guild data locally. That separate boundary was not
  demonstrated by the reported account-officer alt.
- Stale-write rejection was not demonstrated live. Retain automated epoch tests;
  never replay stale data against production to fill this gap.
- Lua 5.1 regression execution and exact installed/deployed candidate identities
  are not established by these game reports.
- Snapshot relay was reported working, but individual crafters, raids, goals,
  guild identity and metadata fields were not separately enumerated.
- Known UX issue: Force Scan prints the reload suggestion when broadcast chunks
  are queued, not when delivery completes. Reloading the sender can interrupt
  delivery. The successful controlled check kept the sender online for two
  minutes, then reloaded the collector and waited for Desktop SUCCESS. Two
  minutes is a test procedure, not a guaranteed maximum transfer time. No fix
  was made as part of this evidence update.

Repository checkpoint inspected November 5: `c45dd76`, with a pre-existing
uncommitted VS Code settings change. Declared versions at that checkpoint:
API/web/shared-types `0.7.0`, desktop `0.5.1`, addon `0.6.0`, AppHelper `0.2.2`.
The local release manifest declares bundle `0.10.0`; root package version is
`0.2.2`, not the bundle version. These are repository declarations, not proof
of the binaries installed or sources deployed during testing. Release notes,
artifact contents and checksums must be reconciled before distribution.

### W08 candidate handoff - November 5, 2026

W08 automated contract, workspace, Windows packaging and isolated AMD64
container checks passed; these do not replace candidate-specific manual tests.
See [candidate hashes and results](./UPGRADE-PLAN.md#w08---shared-zod-migration-game-gate).
No temporary test services remain running. Production was not changed.

1. Identify candidates by the hashes in the plan, not their unchanged version
   numbers. The server source ZIP is `release/FlockSync_Remote_Server_Deploy.zip`;
   Windows candidates are under `apps/desktop/release`, not root `release`.
   Do not distribute these as updated same-version releases.
2. Before manual use, prepare an isolated API/web endpoint, disposable database,
   synthetic Officer/Admin login and separate desktop user-data directory.
   The environment must be explicitly prepared and checked before supplying a
   test URL; no test URL from earlier checks remains active. Never point a
   candidate at production or reuse actual desktop credentials for acceptance.
3. Check both installer and portable launch, preload/UI, login and saved-path
   handling with disposable settings. Before involving the game, confirm the
   selected server is the isolated endpoint and the collector identity is
   synthetic. Do not overwrite or inspect the normal desktop config.
4. With maintainer approval for live-game data in the isolated environment,
   repeat capture -> logout/reload -> Desktop SUCCESS -> test website gear,
   role and availability. Then fully exit WoW, sync successfully, log in and
   check returned helper data and Lua errors. Use the actual installed addons;
   this wave changes validation, not Lua source. Helper writes touch the real
   account folder: plan a safe backup/restore while WoW is closed before this
   step, or defer it. Do not silently repoint the normal collector.
5. On the isolated web candidate, check login, roster/main-alt display, and
   linked/separate theme colors. Report errors, missing fields, HTTP statuses,
   candidate hashes and whether installer/portable modes were both exercised.
6. Cleanup: quit the test desktop fully through its tray, stop only the isolated
   services and remove only their identified disposable resources/settings.
   Restore any backed-up helper only with WoW closed, then return to the normal
   approved server/sync workflow. Never reset or restore the production database.

These steps must not be run against production without separate approval.
Progress is recorded below. W08 remains in progress until the remaining gate
is completed or a limitation is explicitly accepted.

Manual progress, November 5: maintainer reported isolated browser login,
Desktop login, synthetic sync, helper-file update and the synthetic roster's
availability working at `http://127.0.0.1:18708`. Linked/separate theme colors,
built-in background image/opacity, refresh persistence and logout/login
persistence also passed by maintainer report.
The Desktop was the rebuilt application launched through a session-local
Electron harness with separate userData and a synthetic WoW folder; this does
not establish installer/portable execution.

The maintainer explicitly approved real-game use against the isolated endpoint.
With WoW closed, the original AppHelper SavedVariables and its `.bak` were copied
to a session-local backup and verified by hash without displaying contents.
The isolated Desktop was pointed at the real client; the maintainer confirmed
existing characters appeared on the test website. The maintainer then reported
all fresh-game steps passed with no errors: login/role/main check, equipment
removal and restoration via reload-triggered sync, and exit -> successful sync
-> login with the returned helper. The original equipped item was restored.

After the maintainer confirmed WoW fully closed, the isolated Desktop was
stopped. Both original helper files were restored and verified against their
backup hashes. The local manual API/web containers were stopped; no temporary
test services remain running and `http://127.0.0.1:18708` is no longer an active
test URL. Stopped containers/disposable test data and the original helper backup
are retained for follow-up; they have not been deleted. Production was not
changed. Installer and portable candidate launch/IPC/settings acceptance remains
pending; the harness test does not substitute for those launch modes.

Portable follow-up, November 5: with explicit approval, FlockSync-specific
Windows startup registry entries were backed up locally before launching the
actual `FlockSync-Portable-0.5.1-x64.exe` candidate. The launch used separate
userData/AppData directories and the synthetic WoW folder, not normal desktop
settings or real game files. Maintainer confirmed W08 Tester reached the local
test website and confirmed the portable closed completely. The wrapper exited
successfully and reported original startup entries restored and verified.
Process inspection confirmed no FlockSync processes remained. Manual API/web
containers were stopped again; the test URL is inactive.
Installer execution remains pending and is not authorized to replace the
working installation. Portable launch/upload/exit is covered, but no additional
tray/startup preference changes or packaged relaunch persistence were reported.

Portable relaunch follow-up, November 5: maintainer reported all steps passed
without errors: persisted synthetic login, retained local endpoint/synthetic
client path, successful manual sync, startup/minimized preferences still off,
enabling close-to-tray, closing/reopening through the tray and tray Quit.
The wrapper again exited successfully and reported startup restoration verified.
Process inspection found no remaining FlockSync processes, and the manual
API/web containers were stopped. Startup-at-login activation was deliberately
not tested on the normal Windows account. Installer acceptance was pending
at this point; see the completed follow-up below.

Installer follow-up, November 5: maintainer explicitly accepted replacing the
normal installation. Before installation, normal Desktop configuration was
copied locally and hash-verified without displaying its contents; FlockSync
startup entries were also backed up. Maintainer installed the candidate to
`C:\Program Files\FlockSync`, reporting no errors and leaving automatic launch
disabled. The installed ASAR hash matched the W08 packaged candidate.
The installed executable was then launched with isolated settings and the
synthetic folder. Maintainer reported saved login/settings, manual sync,
website roster, close-to-tray, tray reopen and Quit all passed.
The launch wrapper reported startup entries restored and verified; process
inspection confirmed exit. The normal Desktop configuration still matched
its pre-install backup. API/web test containers were stopped; the test URL
is inactive. The installed binary remains the unreleased W08 build at the
unchanged `0.5.1` version; do not confuse it with the previously installed build.

W08 applicable manual acceptance is complete alongside the automated checks.
Enabling Windows startup, reboot behavior, multi-account game coverage and
fresh ARM64 execution were not tested. No new claim is made for those surfaces.
No release publication or production server update was performed.
