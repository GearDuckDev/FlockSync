# W02 - Pre-launch web and declaration updates

Date: October 30, 2026. Source base: `40a920646151129a425b8b59c862a0dab9abb570`
plus uncommitted W01 and W02 changes on Dependency-Upgrade-Before-Launch.
Related: [plan](./UPGRADE-PLAN.md), [test recipes](./UPGRADE-TESTS.md),
[previous wave](./UPGRADE-W01.md).

Status: implementation and automated verification passed; wave `blocked` only
on the maintainer spot-check below. **Pre-launch STOP: W03 has not started.**

## Changes and deliberate exclusions

| Dependency | Previous | Final |
| --- | --- | --- |
| lucide-react (web) | 1.58.0 | **1.64.0**, exact pin |
| @types/better-sqlite3 (API development) | 7.6.13 | **9.6.0**, range ^9.6.0 |
| better-sqlite3 runtime | 12.11.1 | Unchanged |
| Drizzle / API Node declarations | 0.44.7 / 22.20.5 | Unchanged |

Registry latest was Lucide 1.65.0 and SQLite declarations 9.6.0.
Reviewed upstream [Lucide 1.64 notes](https://github.com/lucide-icons/lucide/releases/tag/1.64.0),
[1.65 notes](https://github.com/lucide-icons/lucide/releases/tag/1.65.0),
cumulative comparison and the actual installed SQLite declarations.

The initial 1.65.0 install automatically added a minimumReleaseAgeExclude entry:
the version was published within the release-age cutoff. Removed that generated
exception rather than weaken policy. A subsequent install correctly rejected the
stale 1.65.0 lock entry; restored only that attempt's Lucide lock metadata from
the original safe version, then let pnpm resolve the exact eligible 1.64.0 target.
Normal and frozen installs passed. **No policy exceptions, trust flags or
workspace-policy changes remain.** Do not silently jump to 1.65.0 later; recheck
its age and validate a separately approved update.

The exact Lucide pin deliberately prevents the same-day version from being
selected during this wave. It is not a request to pin unrelated dependencies.
SQLite type numbers do not have to match the runtime major. Installed declarations
cover the constructor, statements, transactions, pragma and backup APIs used here;
strict compilation against current Drizzle passed without source edits/casts.

No application source, API DTOs, schemas, migrations, addons, Electron or watcher
changes. No version bumps, host-tool updates, commits, publication or deployment.
API/web remain 0.6.1; local bundle manifest remains 0.9.0/server 0.6.1.
Desktop is unchanged from W01 and was not rebuilt again.

## Verification

| Check | Result |
| --- | --- |
| Lucide-only web typecheck/build | Passed before declaration upgrade |
| All imported icon render comparison | 34/34 exported and rendered; zero SVG markup changes vs 1.58.0 |
| pnpm install / frozen-lockfile | Passed under pnpm 12.16.1 with existing policies |
| Workspace typecheck | All four packages passed |
| Affected builds | API and web passed; shared dependency built by existing scripts |
| API production regressions | 6 passed |
| API update regressions | 14 passed |
| Web logic/theme/tooltip/PWA regressions | 15 passed |
| API and web Docker builds | Both passed, linux/amd64 |
| Full served static file comparison vs W01 | Zero byte differences |
| Database/sync runtime JS comparison | DB initialization, database admin and sync service hashes unchanged |
| Isolated container integration | Startup, nginx health, auth, fixture sync, restart persistence, backup integrity and restore passed |
| Browser | Authenticated roster/admin layouts fit at 390/768/1440; visible icons; all sections visited |
| Browser theme editing | Separate colors saved and survived reload |
| Deployment ZIP | Refreshed; checked selected final input hashes and exclusions |

Total relevant automated regression tests this wave: **35 passed, 0 failed**.
Desktop tests were not repeated because desktop code/dependencies did not change.
No new test runner or additional dependency was installed for verification.

The first disposable API fixture omitted /backups; admin listing explicitly
returned 400. Created/chowned that directory inside the disposable container,
then listing/backup/restore passed. A PowerShell backup request initially sent
unsupported content type (415); repeating with JSON passed. These were test
setup/request corrections, not application fixes or hidden successful responses.

All isolated W02 test containers and their unique network were removed.
The earlier browser URL is **stopped**. No real configuration, player data,
production volumes, existing desktop installation or WoW client was accessed.

## Persistent artifact identities

SHA256 values identify the current local test output, not an authorized release.

| Item | Identity |
| --- | --- |
| pnpm-lock.yaml | 297486DFAE306F90C78A7B6E5DEA4F6193CBB26F48CE6E837C2B8AF1696065F0 |
| release/FlockSync_Remote_Server_Deploy.zip | A07F1118FA289D828841CDD3C3D7D4D2714FD836D0E878C588EE5BA458DA9C08 |
| flocksync-api:w02-prelaunch | sha256:aaab1e6261cd97c62a1030f2f762bd97be2ca9038b5a939cf1dd141c8a5b9c5d |
| flocksync-web:w02-prelaunch | sha256:6f138825b9560f7d43db2e2e9dc31236e544d03ff0d8b381806f3eb9df3ecc20 |

Comparison images remain. No full release packager ran, and root desktop downloads
were not replaced. The server ZIP is a local candidate only.
Rollback only W02's Lucide/declaration manifest and lock entries while retaining
W01 and unrelated work; install under the current pnpm pin, rebuild/retest API/web
and regenerate the server ZIP. No database migration or database rollback is needed.

## Maintainer spot-check (no game required)

1. From the repository root in PowerShell:
   `pnpm --filter @flocksync/web exec vite preview --host 127.0.0.1 --port 4178 --strictPort`.
   Keep the terminal open; visit http://127.0.0.1:4178.
   If the port is occupied, do not stop an unknown process; use an unused port.
2. Verify the login icon, sign-in/create-account controls and styling at desktop
   and phone widths. Expect no missing icons or horizontal overflow.
   This is a standalone preview with no API: do not enter production credentials.
3. Optional repeat of W01 cached-shell check: reload online after worker activation,
   switch developer-tools networking to Offline and reload, verify styled shell;
   switch back to Online and reload. Offline guild data is not supported.
4. Stop preview with Ctrl+C and restore browser networking to Online. Optionally
   remove only this localhost origin's test worker/cache.
5. Report pass/fail for the icon/layout check, and which optional checks you ran.
   Include failing steps/screenshots/errors without tokens or private data.
   If you want personal authenticated checks, request a fresh isolated fixture;
   do not deploy the candidate to production merely to test it.

After that feedback, mark W02 done but **do not start W03 automatically**.
No new in-game test is required by these web/type-only changes. W01's rebuilt
desktop distribution still waits for the game's T06 collector/helper checks.
ARM64, live-game, actual device installation and old-shell-update acceptance
remain untested; none is implied by these automated results.
