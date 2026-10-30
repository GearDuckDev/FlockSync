# Dependency upgrade runbook

Planning baseline: October 30, 2026. **This is a plan, not authorization to upgrade.**
Audience: maintainer and coding agents. Resume here before dependency work.
Related: [release checklist](./RELEASES.md), [deployment](./DEPLOYMENT.md),
[environment handoff](./.github/copilot-instructions.md).

## Operating rules and launch boundary

- Default pre-launch scope: **W00-W02 only**, one change set at a time.
- **STOP after W02.** W03-W10 require explicit maintainer approval for that wave.
  Offline-testable does not mean worth the risk immediately before launch.
- November 4, 2026 is the hoped-for game launch, not a confirmed deadline.
  Calendar dates never unlock game gates or authorize version 1.0.
- No addon changes, game-format changes, or bulk `update --latest` in early waves.
  Preserve Lua 5.1 / Interface 16001. Cloudflared is already handled; exclude it.
- Never promise zero behavior changes. Record expected invariants and test them.
  Compilation, mocked tests, successful packaging, and "latest" are not live-game proof.
- Recheck stable versions, changelogs, engines and peer requirements before each wave.
  Versions below are audit targets, not evergreen claims. Exclude prereleases.
- Change supported parent packages, not forced transitive major overrides.
  Keep currently supported older lines where compatibility requires them.
- No live deployment, host-tool installation, commit, tag, push, publication,
  production restore, or CurseForge upload without explicit authorization.
- Host tools are shared machine state: maintainer approves updates and restarts.
  Use isolated containers, disposable databases and synthetic SavedVariables.
- Keep secrets, actual desktop configuration and player data out of test evidence.
  Never replace real SavedVariables or helper files to simulate tests.

## Parseable progress and ownership

Wave states: `pending`, `in_progress`, `blocked`, `done`, `deferred`.
Only mark `done` when required evidence is recorded; `deferred` is not a pass.
Use `blocked` with a reason when a prerequisite or environment is missing.
Each wave depends on the preceding wave being done, unless explicitly split into
an independently approved change set with its own baseline and rollback.

| ID | Status | Gate / default policy | Owner |
| --- | --- | --- | --- |
| W00 | done | Offline and AMD64 container baseline passed; see scoped evidence | Agent + maintainer |
| W01 | done | Tooling/offline checks passed; desktop distribution held for T06 | Agent |
| W02 | blocked | Implementation/tests passed; maintainer spot-check pending; pre-launch STOP | Agent + maintainer |
| W03 | pending | Approval; isolated deployment-algorithm verification | Agent |
| W04 | pending | Approval; API compatibility regressions | Agent |
| W05 | pending | Approval; native SQLite and backup/restore on both architectures | Agent |
| W06 | pending | Approval; compiler and runtime alignment | Agent |
| W07 | pending | Working game available; shared-validation migration | Agent + maintainer |
| W08 | pending | Working game available; desktop runtime/packaging | Agent + maintainer |
| W09 | pending | Working game available; watcher migration | Agent + maintainer |
| W10 | pending | Approval; CI, images, remaining tools and inventory closure | Agent + maintainer |
| W11 | pending | Full release-candidate verification and explicit publication approval | Agent + maintainer |

Agent: implement approved scope, add missing regressions, run tests/builds, record
results and limitations. Maintainer: approve scope, operate/test real game and
desktop installations, review evidence, authorize release/deployment separately.
Browser automation may supplement, not replace, maintainer acceptance.

For each completed or blocked wave, append this record under its section:
`Evidence: date; source commit; exact old/new versions; commands/results; artifact identity; manual checks; limitations; rollback checkpoint.`
Use a reviewed commit/tree identity and artifact checksums where applicable, not
filenames or timestamps alone. Never invent results or credentials.

## W00 - Freeze and measure the baseline

1. Re-read git status/diff, manifests, lockfile, release manifest and handoff.
   Preserve existing work; separate mobile/PWA changes from dependency migration.
2. Record installed/resolved versions and exact image digests/runtime versions.
   Confirm Node/pnpm selection, Docker engine, build architectures and Lua 5.1 availability.
3. Run applicable T01-T05 below before upgrading; distinguish baseline failures
   from regressions. Add missing deterministic coverage before changing behavior.
4. Agree a known-good source/artifact checkpoint and isolated backup/restore fixture.
   Do not assume latest published tag matches the checkout or current artifacts.

Evidence: October 30, 2026; source `40a9206`; no dependency versions changed.
See [W00 baseline evidence](./UPGRADE-BASELINE.md) for commands, results, hashes,
rollback identity and remaining checks. This record predates W01 below.

## W01 - Low-risk build and development tooling

1. Upgrade Vite 8.3.4 -> 8.3.5 in web/desktop; remove API `@types/bcryptjs`
   because bcryptjs provides declarations. Test these as separately attributable changes.
2. Upgrade pnpm 12.11.2 to confirmed stable (audit: npm 12.16.1; GitHub also
   listed 12.17.0). Align root pin, both Dockerfiles and selected local executable.
   **Keep `deploy --legacy`**. Preserve trust, build-script and minimum-age policies.
3. Optional, separately approved host maintenance: Node 24.22.0 -> 24.22.2,
   npm 12.0.2 -> 12.2.1, Git for Windows 2.56.0.windows.3 -> .4.
   Use the existing installation manager; verify PATH/pnpm selection afterward.
4. Run T01-T05 for touched surfaces, including frozen install and both container builds.
   Vite affects desktop output too: offline verification is not full collector acceptance.
   Hold any newly rebuilt desktop distribution for T06, or retain known-good desktop assets.

Evidence: October 30, 2026; source `40a9206` plus uncommitted W01 changes;
Vite 8.3.4 -> 8.3.5, pnpm 12.11.2 -> 12.16.1, redundant bcrypt declarations removed.
See [W01 evidence](./UPGRADE-W01.md) for tests, artifact hashes and limitations.
Optional host Node/npm/Git updates were not performed. See W02's later record below.

## W02 - Web visuals and declaration-only cleanup

1. Upgrade lucide-react 1.58.0 -> 1.65.0; inspect every imported icon family.
2. Separately update `@types/better-sqlite3` 7.6.13 -> 9.6.0 only if declarations
   match the installed runtime/Drizzle usage. Do not change SQLite runtime here.
3. Run T01-T03 and API tests for declaration changes; refresh server test ZIP.
   Confirm no schema, API payload, addon or desktop-sync contract changes.
4. **STOP.** Prefer a small verified server/web-only update before launch.
   A server-only candidate must pass the W11 checks applicable to that scope;
   do not mark skipped waves done. Do not ship an unverified desktop rebuild.

Evidence: October 30, 2026; source `40a9206` plus uncommitted W01/W02 changes.
Lucide 1.58.0 -> 1.64.0 (1.65.0 deferred by release-age policy);
SQLite declarations 7.6.13 -> 9.6.0; runtime unchanged.
See [W02 evidence and maintainer checklist](./UPGRADE-W02.md).
Automated verification passed; waiting for the listed maintainer spot-check.
**Do not begin W03 or later migrations automatically.**

## W03 - Remove legacy pnpm deployment separately

1. Confirm current pnpm deploy requirements; remove only `--legacy` after reviewing
   workspace linking. Do not add dependency injection unless actually required.
2. Run T05 on both images with fresh deployment output; verify built shared-types
   resolution, production-only dependencies, native SQLite and non-root permissions.
3. Exercise startup, auth, persistence and restart using disposable volumes.
   Failure: restore the previous deploy algorithm, not a policy-bypass flag.

## W04 - Server libraries, one migration at a time

1. `@fastify/cors` 10.1.0 -> 11.3.1: retain explicit origins/methods; test
   preflight and allowed/disallowed origins across GET/POST/PUT/PATCH/DELETE/OPTIONS.
2. `@fastify/jwt` 9.1.0 -> 10.2.6: verify tokens minted by the old stack against
   the new stack, valid claims, expiry, malformed tokens and every user role.
3. Drizzle 0.44.7 -> 0.45.4: verify migrations, guild identity, queries and strict
   `incoming.updatedAt > existing.updatedAt` behavior for older/equal/newer writes.
4. dotenv 16.6.1 -> 18.0.9: test existing `dotenv/config`, precedence, missing
   required settings, startup errors and logs. Preserve deployed configuration.
5. Run T01-T03/T05 after each migration; use fixture sync requests, not live game data.
   Keep contract changes out of this wave; escalate any required contract migration.

## W05 - Native database engine

1. better-sqlite3 12.11.1 -> 13.0.3; review N-API/prebuild changes and Node floor.
2. Run T01/T02/T05 on Windows and Linux AMD64/ARM64. Verify WAL/SHM access,
   bound parameters, strict timestamp guards, migrations and concurrent reads/writes.
3. Back up an old-version fixture, restore/read it with the new engine, restart,
   and restore a verified pre-upgrade backup into the old stack as a rollback drill.
   Never assume binary downgrade alone safely reverses database changes.

## W06 - Compiler and supported runtime alignment

1. Align API/shared TypeScript 5.9.3 -> 7.0.2 with web/desktop; review intervening
   migrations. Verify emitted JS/declarations, package exports and all consumers.
2. Align Node declarations to each actual host/container/Electron runtime.
   Do not blindly choose the latest `@types/node` major.
3. Separately evaluate Node 26.13.0 LTS; first refresh the supported Node 22
   container line (audit latest 22.23.4) if needed. Do not combine runtime majors
   with SQLite migration. Align engines/docs with verified dependency floors.
4. Run T01-T05; require T06 before distributing a changed collector/runtime.

## W07 - Shared Zod migration: game gate

1. **Do not begin the migration until a working game and test window are available.**
2. Migrate Zod 3.25.76 -> 4.6.7 across shared/API/web/desktop as one coordinated
   contract change. Cover defaults, optional fields, coercion, refinements and errors.
3. Use old payload fixtures to test Lua-parser output, sync requests/responses,
   auth, themes, helper serialization and release metadata; reject invalid inputs.
4. Run T01-T06. Ship only after real capture -> upload -> helper load succeeds.

## W08 - Desktop runtime and packaging: game gate

1. First electron-builder 26.15.3 -> 26.18.0, then Electron 44.8.0 -> 45.2.0
   in separate change sets. Keep Chokidar unchanged for attribution.
2. Run T01/T04/T06 for each: installed and portable launch, preload/IPC, tray,
   startup settings, auth, network fetch, update checks, saved paths and fixture sync.
3. Verify packaging contains correct dependencies and no configuration/secrets.
   Require live-game collection/helper acceptance before desktop distribution.

## W09 - Chokidar migration: game gate

1. Chokidar 5.0.0 -> 6.0.0 changes Windows watching; verify embedded Node meets
   its floor (audit: >=22.22), options and close behavior before implementation.
2. Extend T04 with new/missing account directories, create/rename/atomic replacement,
   rapid saves, duplicates, partial writes, retries, shutdown and watcher recreation.
3. Run T06 across logout/reload/relogin and multiple accounts. Prove successful
   final-state sync without lost updates, runaway repeats or unsafe helper overwrites.

## W10 - CI, container images and remaining tooling

1. Update actions separately: checkout v4 -> v7.0.1, github-script v7 -> v9,
   upload-artifact v4 -> v7.0.2. Review Node/ESM compatibility and embedded scripts.
   Test packager workflow with publishing disabled; preserve hidden ZIP inclusion.
2. BigWigs packager v2 already tracks current major (audit release 2.6.1);
   optional SHA pinning is not a required major update. Never duplicate uploads.
3. Inspect nginx digest/version before refreshing; test proxy, SPA routing and PWA.
   Evaluate backup Alpine 3.23 patch separately from 3.24.3 branch migration;
   test cron, permissions, retention, actual backup integrity and isolated restore.
4. Recheck VS Code/Container Tools/Dev Containers and other extensions via their
   own version histories; distinguish extension versions from embedded libraries.
   Docker Desktop/Engine/Compose/Buildx were current at audit; update only if needed.
5. Inventory Python/MSBuild/.NET and remote OS tooling before claiming currency.
   Do not install a runtime merely because it exists; Lua remains 5.1.
6. Re-audit all direct/transitive packages and deprecations. Record retained versions,
   owning parents, support reasons and review dates; do not force "zero outdated."

## Test recipes and mandatory acceptance

Execute [UPGRADE-TESTS.md](./UPGRADE-TESTS.md) for T01-T06, including the exact
commands, isolation requirements, browser checks and maintainer game checklist.
Missing required evidence blocks the wave; a skipped test is never acceptance.

## W11 - Release and rollback gate

1. Confirm scope, all applicable wave evidence, tests and manual acceptance.
   Collector/shared-contract changes require T06; web/server-only candidates require
   offline contract regressions and must not claim new in-game acceptance.
2. After each implementation wave refresh affected testable artifacts: server ZIP via
   `.\scripts\package-remote-server-deploy.ps1`; desktop via its `package:win` script.
   Documentation-only edits require neither runtime builds nor version bumps.
3. When ready to commit: bump changed components only; fixes +0.0.1, significant
   features +0.1.0; align API/web. Do not bump unchanged addons or auto-release 1.0.
4. Only for an authorized release run `.\scripts\package-release.ps1 -ReleaseVersion <new-version>`.
   Verify all six assets/manifest, exclusions and detailed current release notes.
   Unchanged known-good components need no reinstall; do not substitute untested rebuilds.
5. Follow [RELEASES.md](./RELEASES.md) for destinations, channel, cleanup and publishing.
   Deploy only via the backup-verifying updater in [DEPLOYMENT.md](./DEPLOYMENT.md).
   No production changes merely to validate an upgrade.
6. Failure: stop advancement, retain evidence, revert only the approved wave's
   changes without discarding unrelated work, rebuild and retest. Use known-good
   artifacts; database rollback requires the verified pre-upgrade backup.
