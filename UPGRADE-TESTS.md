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

### W09 Electron 45 candidate handoff

Electron `45.2.3` candidates replaced the local builder-only files under the
same `0.5.1` filenames. Hashes and actual runtime smoke results are recorded in
[Electron evidence](./UPGRADE-PLAN.md#electron-checkpoint---november-5-2026).
The installed app is still the earlier builder-only Electron `44.8.0` candidate.
No manual acceptance or installation of Electron 45 has yet occurred.

Portable follow-up November 5: maintainer reported all protected Electron 45
portable steps passed: retained synthetic login/local endpoint/path,
sync/helper output, test roster and tray close/reopen/Quit. The profile was
returned to the synthetic folder before launch; no real-game files were used.
The wrapper reported startup entries restored and verified, process inspection
confirmed exit and test containers were stopped. A fresh normal-config backup
was copied and hash-verified before the pending installer check. Installer,
fresh-game/helper and native GitHub update-fetch acceptance remain pending.

Installer follow-up: maintainer installed without auto-launch. Installed
runtime executable and ASAR hashes both matched the Electron 45 candidate;
ASAR alone was not used to identify runtime. Protected installed launch
passed synthetic login/endpoint/path, sync/helper output, test roster and
tray close/reopen/Quit by maintainer report. Startup restoration was verified
by the wrapper; normal config remained hash-identical to the fresh backup.
Test apps/API/web were stopped. Installed app is now the unreleased Electron
45.2.3 candidate, still component version `0.5.1`. Fresh-game/helper and
native GitHub update-fetch checks remain pending.

Native public-fetch follow-up: Electron 45.2.3 `net.fetch` fetched the public
GitHub releases API and redirected `flocksync-release.json` download for
`v0.10.0`, both HTTP 200; schema version and manifest/tag agreement passed.
This confirms native HTTPS/download access, not an installer update or full
updater UI acceptance. The isolated smoke exited; no settings, startup entries
or game files were changed. Fresh-game/helper acceptance remains pending.

1. Close WoW and normal Desktop before setup. Verify the new executable hashes;
   ASAR alone is insufficient because its JavaScript is unchanged.
2. Verify isolated settings point at the synthetic account folder, startup off
   and a checked local endpoint before using the protected portable launcher.
   The previous test URL is inactive until its services are restarted/verified.
3. Check saved login/path, sync/helper output, roster, tray close/reopen/Quit and
   relaunch persistence. Check updates deliberately and report any network error;
   the offline updater suite and loopback fetch smoke do not prove GitHub access.
4. With replacement approval and normal settings/startup backup, install without
   auto-launch. Verify installed executable against the packaged runtime, not
   just ASAR; repeat protected installed checks.
5. Obtain approval before real-game use, make fresh verified helper backups
   while WoW is closed, and repeat capture -> upload -> helper login.
6. Quit test apps, restore/verify startup entries and original helpers with
   WoW closed, verify normal settings, then stop identified test services.
   Report errors/candidate hashes. Keep reboot/startup and multi-account limits
   explicit; do not mark W09 done before this runtime-specific acceptance.

### W09 final acceptance - November 5

After native public-fetch acceptance, maintainer approved the Electron 45
game/helper test. Fresh helper/`.bak` backups were hash-verified before use.
Maintainer reported all steps passed: real export sync to isolated website,
normal role/main and addon loading, equipment removal/restoration through
reload-triggered uploads and exit -> sync -> helper login. Original gear was
restored and game/test Desktop fully closed.
Startup restoration was verified by the wrapper; original helpers were restored
and hash-verified, normal Desktop configuration remained unchanged, and manual
API/web containers were stopped. The local test URL is inactive.

W09 applicable acceptance is complete. Installed Desktop remains the unreleased
Electron 45.2.3 / builder 26.18.0 candidate, component version `0.5.1`.
Reboot/startup activation, multiple live account folders and updater-driven
installation remain unverified. No production server deployment occurred.

### W09 builder-only candidate handoff

November 5 portable result: maintainer reported all protected-launch steps
passed for the builder-only portable hash in W09 evidence: retained synthetic
login/local endpoint/path, sync/helper update, test roster and tray
close/reopen/Quit. Wrapper reported original startup entries restored and
verified; no FlockSync/game processes remained. Test API/web containers were
stopped. A fresh normal-config backup was copied and hash-verified without
displaying contents before the next installer check. Installer and applicable
game/helper acceptance remain pending.

Installer follow-up: maintainer installed the W09 builder-only candidate
without launching automatically. Installed ASAR matched
`774AFF548923E556AAE97EEF6E83C83E3E2BA93BE8D65347B37BA9558CB21FBF`.
Protected installed launch passed saved synthetic login/endpoint/path,
sync/helper update, test roster and tray close/reopen/Quit by maintainer report.
Wrapper reported startup restoration verified; normal config remained
hash-identical to the fresh pre-install backup. Game/Desktop were closed and
manual test containers stopped afterward. The installed binary is now the
unreleased W09 builder-only build, still version `0.5.1`/Electron `44.8.0`.
Fresh-game/helper follow-up: maintainer approved the isolated game test and
reported all steps passed, original gear restored and WoW fully closed:
real export sync, fresh equipment removal/restoration through reload saves,
and exit -> sync -> helper login. The test Desktop logout/relogin used only
the synthetic account and local endpoint. The wrapper reported startup entries
restored/verified. With game/Desktop confirmed closed, both original helper
files were restored and hash-verified against the fresh W09 backup. Normal
Desktop config remained unchanged; API/web test containers were stopped.
The local URL is inactive. Builder-only applicable manual acceptance is complete;
the separate Electron runtime upgrade and its acceptance have not started.

The builder-only candidates have new hashes in [W09 evidence](./UPGRADE-PLAN.md#w09---desktop-runtime-and-packaging-game-gate)
but unchanged `0.5.1` filenames. Electron is still `44.8.0`; these are not the
W08 candidates tested earlier. Windows reports them unsigned. No new test
services have been started for W09; the old localhost URL is inactive.

1. Keep WoW and normal Desktop closed before launch preparation. Do not launch
   the candidate directly with normal settings or disable Windows protection.
   Preserve the working installation and verify the candidate hash first.
2. Prepare isolated synthetic settings/account folder and verify an isolated
   API/web endpoint before login. Back up FlockSync-specific startup entries
   locally before each packaged launch and restore/verify on exit. Never display
   normal Desktop config or registry contents as test evidence.
3. Launch the portable using the protected wrapper; verify login, manual sync,
   helper update and test roster. Quit/relaunch to check persistence, then check
   tray close/reopen/Quit and restore startup entries. Report exact errors.
4. With explicit replacement approval and normal settings backed up, install
   the installer, disabling automatic launch. Verify installed ASAR against
   the candidate, then repeat isolated launch/IPC/sync/tray checks.
5. Before touching real game files, obtain explicit approval and verify original
   helper backups while WoW is closed. Repeat fresh capture/upload/helper login
   as applicable, restore helpers safely, and retain known-good rollback files.
6. Quit test apps, verify startup/config restoration and stop only the identified
   test services. Record manual outcomes and candidate identities before starting
   the separate Electron upgrade. Do not claim reboot/startup activation or
   unavailable multi-account coverage passed.

### W10 Chokidar 6 candidate handoff

Automated watcher migration checks passed: 27 Desktop tests, one optional
live-network skip; three filesystem watcher tests passed again under packaged
Electron's embedded Node. Frozen install, workspace typecheck and Windows
packaging passed. See [W10 evidence](./UPGRADE-PLAN.md#w10---chokidar-migration-game-gate)
for exact candidate hashes. The `0.5.1` filenames now identify new W10 builds,
not the previously accepted W09 builds. Both are unsigned.

Tests possible now, one checkpoint at a time:
1. Close WoW and normal/test Desktop. Do not launch the candidate directly.
   Verify the portable hash from W10 evidence. Prepare an isolated synthetic
   profile pointed at a disposable WoW folder, not the previously used real
   client; retain normal Desktop settings and back up targeted startup entries.
   Start only isolated local API/web services and verify readiness before sharing
   a URL. At this checkpoint all test services are stopped; old URLs are inactive.
2. Launch `apps/desktop/release/FlockSync-Portable-0.5.1-x64.exe` with the protected
   session wrapper. Save synthetic Lua exports rapidly and by rename/replacement.
   Expect successful final-state upload, correctly placed helper and no repeated
   feedback uploads. Disconnect the isolated API for one save: expect an explicit
   failure, unchanged helper, then recovery on a new save/Sync Now after restoring
   API readiness. Quit/relaunch and verify watching resumes. Report exact errors
   and whether the web roster shows the final state.
3. Only with explicit installation-replacement approval, back up normal settings,
   install `apps/desktop/release/FlockSync-Setup-0.5.1-x64.exe` without automatic
   launch, verify installed ASAR/runtime against this candidate and repeat isolated
   sync/tray/relaunch checks. Do not infer this pass from W09 installation.

Game-required/deferred:
1. Obtain fresh approval before the test Desktop touches real game files. With
   WoW closed, back up/hash-verify both existing AppHelper SavedVariables files.
   Use isolated login/local server settings; do not modify normal configuration.
2. Repeat candidate-specific reload, logout/character-switch, gear removal/restore
   and exit -> successful sync -> login helper checks. Expect current gear/role
   and correct helper data. Restore original gear before finishing. A new account
   folder requires watcher restart; live multi-account testing remains deferred
   if only one account is available.
3. With game and test Desktop closed, restore/hash-verify helper backups, verify
   normal config unchanged and startup entries restored, then stop identified test
   containers. Report sync errors, unexpected repeated uploads or stale final
   gear/helper state. Retain known-good W09 sources/install rollback until accepted.

W10 remains in progress and blocked for release/distribution acceptance by these
manual gates. Idle shutdown is covered; cancellation/draining during an active
upload is not established by these tests. No production deployment, component
version bump, installer replacement or publication was performed.

Portable preparation follow-up: maintainer confirmed WoW/all Desktop instances
closed and authorized the isolated test. Local API/web containers were restarted;
`http://127.0.0.1:18708/ready` returned 200. A fresh W10-only signed-out profile
targets the synthetic folder, not the real client. Normal config baseline hash
was captured; the portable candidate hash was reverified. Startup restoration is
handled by the protected wrapper on exit. GUI acceptance remains pending; the
local URL is available only while these identified test containers remain running.

Maintainer reported W10 portable login/manual Sync Now succeeded. Automatic
watching acceptance is next: changed only the disposable W08 Tester fixture to
HEALER with fresh timestamps while the isolated app/server were verified running.
Awaiting maintainer confirmation of automatic success and the updated web role;
manual Sync Now must not be used for this check.

Maintainer confirmed automatic watching succeeded: Desktop automatically synced
and the local web character showed HEALER. Next check replaces the synthetic save
by rename with a fresh DPS record; automatic sync/final web state and absence of
repeated feedback uploads remain to be confirmed.

Maintainer confirmed rename/replacement acceptance, including automatic sync,
the final DPS role and no idle feedback repeats. Next, only the isolated API
container was stopped and the synthetic export changed to HEALER with fresh
timestamps. Helper hash was captured before the outage; awaiting the explicit
Desktop failure report before restoring the API and testing recovery.

Maintainer confirmed the expected HTTP 502 during the isolated API outage.
The synthetic helper remained byte-identical to its pre-outage hash. The isolated
API was restarted and `/ready` returned HTTP 200; the same W10 Desktop instance
is still running. Manual Sync Now recovery to the pending HEALER export is next;
do not count recovery as passed until the maintainer confirms Desktop/web results.

Maintainer confirmed manual Sync Now recovery succeeded without restarting
Desktop, and the local web character showed HEALER. The next portable gate is
tray Quit followed by a protected relaunch of the same isolated W10 profile and
a fresh automatic save. Await full exit and startup-registration restoration
before relaunching; persistence/restarted watching are not yet accepted.

The protected portable wrapper exited successfully and reported startup entries
restored/verified. No W10 GUI remained; normal Desktop config hash was unchanged.
Isolated login/path/local endpoint/startup preference persisted. The same candidate
was relaunched through the wrapper; its process and server readiness were verified.
A fresh synthetic DPS save now tests resumed automatic watching. Awaiting maintainer
confirmation of the automatic success and final web role.

Maintainer confirmed resumed automatic watching and final DPS web role after
the protected portable relaunch. Portable login/manual sync, automatic save,
rename/replacement without idle repeats, outage error/helper preservation,
manual recovery and relaunch watching have passed. Installer replacement and
candidate-specific protected game acceptance remain pending.

Maintainer approved installer replacement with Desktop/WoW closed. The portable
wrapper restored/verified startup entries; no FlockSync/WoW processes remained.
Normal config matched its baseline and was backed up/hash-verified locally.
The W10 installer hash was verified and its interactive wizard opened. Previous
installed ASAR matched the accepted W09 hash. Awaiting installation completion
with automatic launch disabled, then installed candidate verification and
protected isolated launch. Installation is not yet accepted.

Maintainer reported installation finished. Installed executable byte-matched the
W10 unpacked candidate; installed ASAR matched the W10 hash. Normal config was
unchanged and local readiness returned 200. Installed Desktop was launched via
the protected wrapper with the W10 synthetic-only profile and its process verified.
A fresh HEALER fixture save tests installed automatic watching; maintainer GUI,
web and tray acceptance remains pending.

Maintainer confirmed installed W10 automatic sync, final HEALER web role and
window-close/tray-reopen behavior passed. Candidate-specific protected game
acceptance remains pending. Obtain fresh approval and full game/test Desktop
exit before backing up real helper files or redirecting the isolated profile.

Maintainer approved protected W10 real-game testing and confirmed game/Desktop
closed. Wrapper restored/verified startup entries; no game/Desktop process
remained and normal config hash was unchanged. Both original real account helper
files were freshly backed up and hash-verified in the session's W10 backup folder.
Only the isolated profile's client path was redirected to the actual client;
the endpoint remains the local test server, verified ready. Original helper
restoration is mandatory after game/test Desktop exit. Game acceptance is pending.

Maintainer confirmed W10 real-game equipment removal and restoration through
reload saves: automatic Desktop uploads and matching local web gear state passed,
with original gear restored. Logout/relogin and returned-helper loading are next;
original helper restoration and final service/config cleanup remain pending.

### W10 final acceptance and cleanup - November 5

Maintainer reported the exit -> automatic sync -> login check completed without
errors and confirmed everything closed. Process checks then verified game and
Desktop were fully stopped. Both original AppHelper files were restored from
the fresh W10 backups and hash-verified; normal Desktop config matched its
pre-test baseline. The protected launch wrapper had already restored/verified
startup entries. The isolated profile was returned to the synthetic client path.
Both identified test containers were stopped and no listener remained on port
18708: the old test URL is inactive.

W10 applicable portable, installed and real-game manual acceptance is complete.
The installed app remains the unreleased W10 candidate (`0.5.1`), not a newly
published release. Earlier pending statements above are chronological test steps,
superseded by this final outcome. Reboot/startup activation, live multiple-account
testing and cancellation/draining of active uploads remain unverified. New account
folders require watcher restart and failed uploads need a new save/Sync Now.
No production deployment, version bump, commit or publication occurred. W11 has
not started.

### W11 GitHub Actions preview handoff

Hosted preparation follow-up: maintainer explicitly authorized the scoped commit,
push and publish-disabled preview. Commit `47eb56e` pushed only the workflow,
pkgmeta exclusions and related RELEASES instructions to
`Dependency-Upgrade-Before-Launch`. Backup-image/audit changes remain uncommitted.
Final actionlint/diff checks passed. The integrated browser is signed out and
available GitHub tools do not expose dispatch; no hosted run has been started.
Maintainer must dispatch through their signed-in browser using the settings below,
then provide the run URL for inspection. No tag/release/upload/deployment occurred.

Local checkpoint passed: baseline/final and individually upgraded actionlint
checks; six exact eligibility-script cases; actual BigWigs 2.7.0 no-upload preview
with the exact workflow archive verifier; valid stable/manual/alpha/beta selection
and rejected invalid tag/channel/prerelease inputs. Injecting an extra root
document into a test ZIP was rejected. Missing pkgmeta exclusions discovered
during preview were added, and packaging then passed. Test fixtures used tracked
sources and disposable local repositories/tags only, not the actual release tags.
No upload credentials were supplied. This does not prove GitHub-hosted execution
or artifact transfer; those remain pending.

Hosted check, only after explicit commit/push authorization:
1. Make the updated workflow and pkgmeta available on the intended remote branch.
   In Actions choose **Package or publish CurseForge addon**, **Run workflow**,
   select that branch, use existing stable tag `v0.10.0`, and leave **publish
   unchecked**. Do not publish a release or create/reuse a tag for this test.
2. Expect checkout, selection, eligibility, no-upload packaging, archive validation
   and artifact saving to pass. Credential/upload steps must be skipped.
3. Download the run's `FlockSync-CurseForge-0.6.0` artifact. Open its inner addon
   ZIP and verify only main addon files, license/generated changelog; no helper,
   root upgrade/server docs, environment configuration or application sources.
4. Report the run URL, failed step and exact error if any. Stop on failure; do not
   retry with publish enabled. Delete only the disposable downloaded preview if
   desired; no production rollback is needed because nothing was deployed.

No new game/manual Desktop test is needed for this change set. Runtime versions
and normal installed Desktop are unchanged. Local validation containers exited
and were removed; W10 test services remain stopped. W11 container image/tooling
and final dependency audit work remains separate.

### W11 container image handoff

Local checks passed on refreshed Alpine 3.23 and candidate 3.24 backup images,
including integrity/restore, evidence digests, ownership/mode, retention, retained
pre-update snapshots, safe failure paths and actual accelerated cron. Full
candidate backup checks also passed on emulated ARM64. Isolated readiness/
backup-health and proxy-trust tests passed with rebuilt nginx; session-only SPA,
PWA cache/header and API routing checks passed. Workspace typecheck and two
deployment-packaging regressions passed. Exact images/limits are recorded in
[W11 image evidence](./UPGRADE-PLAN.md#w11-container-images-checkpoint---november-5-2026).
No game retest or immediate production update is required.

Deployment checks deferred until separately authorized:
1. Use the refreshed `release/FlockSync_Remote_Server_Deploy.zip` candidate,
   not an old ZIP or a published release claim. Preserve deployed `.env` and
   local SQLite data. Confirm the configured backup mount exists, is writable
   and has the expected storage identity. Do not copy test data to production.
2. From the deployed project directory use `sh deploy/update-server.sh`; expect
   a verified pre-update backup before rebuild/recreation. Do not bypass this
   with direct restarts. Confirm `docker compose ps` is healthy and backup logs
   show verified snapshots; validate destination ownership and available storage.
3. Check public login, SPA deep links, PWA loading, API readiness and the next
   actual midnight backup. Report failing step/log, image identity and platform,
   never token/environment values. Local cron acceleration is not evidence that
   a production overnight run has passed.
4. If blocked, retain the pre-update snapshot and operator settings. Rebuild the
   previously tested Alpine 3.23 backup base as a scoped rollback; use the normal
   updater. Database restoration is a separate authorized operation, not a default
   response to a container-tooling problem.

All local test services are stopped; isolated containers/networks/health volumes
were cleaned up. No live tunnel, production update or release publication occurred.
The deployment ZIP was refreshed and inspected (214 entries): backup Dockerfile
selects Alpine 3.24 and operator-data exclusions hold. Candidate SHA256 is
`C59D2FE9D6E7DC308821EA7D05210C0F313739E2992F2C3F77A22C98FD0889AE`.
A separate read-only destination check confirmed explicit failure/failed-attempt
evidence. The combined release manifest was not regenerated; this ZIP is a local
test candidate, not an already published release asset.

### W11 tooling review handoff

Read-only local inventory completed and compared with official release/Marketplace
metadata. All installed extensions match Windows-compatible stable releases;
preview Dev Containers versions were correctly excluded. No machine tool,
extension, setting or runtime changed, so no rebuild/retest was required.
Detailed local inventory and update candidates are session-only.

Optional host maintenance, only after separate approval:
1. Schedule tool/editor exits and retain the known-good configuration/installers.
   Do not reset Docker, prune volumes or uninstall old runtimes indiscriminately.
2. Update one tool family through its supported manager. Docker Desktop's
   executable version does not prove its running components were restarted;
   verify these separately and keep the supported bundled set.
3. Rerun versions and affected gates: frozen install/typecheck/build for a
   Node/pnpm change; isolated Compose/build/backup checks for Docker; extension
   activation for editor updates. Report exact versions/errors, not credentials.
4. Stop on regression and restore the previous supported tool version; application
   database rollback is not a remedy for host-tool problems.

Remote OS inventory needs separate operator approval/access. Lua 5.1 CLI remains
unavailable, and existing Lua editor warnings were not fixed in this review.
No temporary services were started. Final dependency audit and hosted Actions
preview remain outstanding before W11 closure.

### W11 final dependency audit evidence

Queried every exact locked version and latest tag: 476 names / 563 versions,
zero registry lookup errors. Generated inventory comparisons/ownership and
retention notes from actual lockfile/manifests, public metadata and `pnpm why`.
216 older/deprecated names were traced; package-manager ownership is documented
separately. Six deprecated versions remain under Drizzle Kit/Electron builder;
`prebuild-install` is absent. New direct/toolchain latest releases under 24 hours
old were retained as separate follow-ups, not installed.

No runtime/dependency changes were made, so build/test results from preceding
accepted candidates still apply; only documentation/CSV consistency and diff
checks are required here. No services started. This is not a security advisory
scan or proof all packages are latest/safe. The remaining W11 gate is the
GitHub-hosted preview with publish disabled after explicit commit/push approval;
follow its numbered checklist above, not a production or CurseForge upload.

### W11 hosted preview final acceptance

[Run 42155373845](https://github.com/GearDuckDev/FlockSync/actions/runs/42155373845)
passed at scoped workflow commit `47eb56e`, manually dispatched on the upgrade
branch. Checkout, selection, eligibility, no-upload packaging, archive validation
and artifact saving succeeded. Credential/upload-to-CurseForge steps were skipped.
Artifact `13474750550` (`FlockSync-CurseForge-0.6.0`, 55,933 bytes) was downloaded
and matched the recorded SHA256
`ed2d584a1c45a3a394cc539974f03d59ebaa305e4fcfb4cefe828334e85ee7f8`.
Its wrapper contained exactly one addon ZIP; independent inspection verified
39 permitted files and TOC version 0.6.0 / Interface 16001, without AppHelper,
root upgrade docs or application sources. Temporary download was deleted.

This supersedes earlier pending hosted-preview instructions. W11 applicable
acceptance is complete; retained tooling/dependency/production-check limitations
still apply. No further manual check is outstanding for this preview. No
CurseForge publication, release/tag or production deployment occurred. Remaining
W11 source/docs are uncommitted; W12 has not started.

### W12 final-version candidate handoff

Stable bundle 0.10.1 is built locally with Desktop 0.5.2 and API/web/shared 0.7.1;
addons unchanged. Full packager/typecheck, final regressions, embedded Electron
watcher tests and isolated final container tests passed. Exact hashes and
remaining limits are in [W12 evidence](./UPGRADE-PLAN.md#w12-local-release-candidate---november-5-local--november-6-utc).
This supersedes old 0.5.1 candidate filenames for final release acceptance.
The installed app is now the accepted local 0.5.2 candidate. Test services are
stopped; no live test URL exists.

Protected acceptance procedure (completed below):
1. Keep WoW and all normal/test Desktop instances closed. Verify
   `release/FlockSync-Portable-0.5.2-x64.exe` against W12 evidence. Back up
   normal settings/startup entries; use a signed-out or retained isolated test
   profile pointed at synthetic files, never the real client. Start isolated
   API/web final-version services only and verify readiness before sharing a URL.
2. Launch via the protected wrapper. Confirm displayed version 0.5.2, login,
   automatic synthetic final-state sync and correctly placed helper; verify
   the local roster role, tray close/reopen/Quit and persisted settings on relaunch.
   Report exact errors, not tokens. Pre-bump tests are supporting evidence, not
   a report that this exact final executable passed manual smoke.
3. Only with explicit replacement approval, back up normal settings and install
   `release/FlockSync-Setup-0.5.2-x64.exe` to the existing location with automatic
   launch unchecked. Verify installed ASAR/runtime against W12, then repeat
   isolated launch/sync/tray checks. Do not disable Windows protections.
4. Quit test apps, verify normal settings/startup restoration and stop only the
   identified test containers. Retain accepted pre-bump source/public release
   rollback; do not restore a database merely to revert an application tool.
   Report the results before declaring final distribution acceptance.

Completed November 5 local / November 6 UTC:
- Maintainer confirmed WoW/Desktop closed and approved isolated testing.
  Final API/web images ran in a separate network with a fresh tmpfs synthetic
  database. Readiness and synthetic administrator login passed.
- Exact final portable hash matched W12 evidence. Maintainer confirmed 0.5.2,
  login and manual sync. Synthetic helper appeared in the expected account folder.
  An isolated synthetic save changed HEALER to DPS at timestamp 1793933239;
  authenticated roster polling confirmed the automatic upload, without Sync Now.
- Maintainer confirmed X-to-tray, reopen and Quit, then a protected relaunch
  retaining test login/settings, successful sync and another Quit.
- Maintainer separately approved replacing installed 0.5.1, then confirmed
  installation with automatic launch unchecked. Normal config was backed up
  and hash-verified. Installed executable and ASAR byte-match the final build.
- Protected installed launch: maintainer confirmed version/settings, sync,
  tray reopen and Quit. Wrappers reported startup restoration success after
  each exit; final startup entries also matched the pre-installer snapshot.
  Normal configuration hash remained unchanged.
- Test applications exited. Only W12's two containers and network were removed;
  tmpfs synthetic database discarded. No temporary service or test URL remains.
  No real client/helper files, live tunnel or production deployment were touched.

Final portable/installer smoke gate passed. W12 local release preparation is
complete; commit/publication/deployment still require separate authorization.

Game-required/deferred: extensive W08-W10 candidate-specific game results are
already recorded. No new addon source or gameplay behavior changed in W12's
version-only preparation. Do not repeat real helper writes without fresh approval.
Multi-account live, reboot/startup, active-upload shutdown and real NAS/overnight
checks remain unverified. Full final-version API/web ARM64 images were not rebuilt
in W12; W06/W11 scoped emulated ARM64 evidence is retained, not relabeled.

Publication/deployment: separate explicit authorization is still required for
commit/push/tag/GitHub release/CurseForge and production update. Use the existing
deployment guide's backup-verifying updater when deployment is authorized.
