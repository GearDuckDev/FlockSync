# Dependency upgrade runbook

Planning baseline: November 4, 2026. **This is a plan, not authorization to upgrade.**
Audience: maintainer and coding agents. Resume here before dependency work.
Related: [release checklist](./RELEASES.md), [deployment](./DEPLOYMENT.md),
[environment handoff](./.github/copilot-instructions.md),
[post-merge dependency audit](./UPGRADE-AUDIT-2026-11-04.md).

## Operating rules and current gates

- W00-W02 are complete, including the maintainer's November 4 report that the
  browser check "looks like the browser stuff works." Optional offline-cache
  checks were not reported.
- W03-W12 require explicit maintainer approval for each wave, one change set at
  a time. Offline-testable does not mean behavior-free or automatically approved.
- November 4, 2026 is the hoped-for game launch, not a confirmed deadline.
  Calendar dates never unlock game gates or authorize version 1.0.
- Game access returned November 4; guild testing was reported November 5.
  Baseline T06 reports cover capture, collection, upload, helper loading and
  member relay. See the [evidence and limits](./UPGRADE-TESTS.md#maintainer-evidence---november-4-5-2026).
  Candidate identities and remaining coverage are not fully established.
  Each changed wave still requires its own applicable acceptance; baseline
  reports do not approve or validate future migrations.
- No addon changes, game-format changes, or bulk `update --latest` in early waves.
  Preserve Lua 5.1 / Interface 16001. Cloudflared is already handled; exclude it.
- Never promise zero behavior changes. Record expected invariants and test them.
  Compilation, mocked tests, successful packaging, and "latest" are not live-game proof.
- Recheck stable versions, changelogs, engines, release age and peer requirements
  before each wave. Versions below are audit targets, not evergreen claims.
  Exclude prereleases and don't confuse npm's latest tag with compatibility.
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
| W02 | done | Automated checks passed; maintainer reported browser spot-check works | Agent + maintainer |
| W03 | done | Independently approved offline web/build updates; desktop installers held for T06 | Agent |
| W04 | done | pnpm v12.16 non-legacy deploy passed isolated API image/runtime checks | Agent |
| W05 | done | All six API library migrations passed offline gates; see package evidence | Agent |
| W06 | done | better-sqlite3 13.0.3 passed Windows, AMD64/ARM64 container, and rollback gates | Agent |
| W07 | done | TypeScript 7 and runtime-aligned Node declarations passed offline gates | Agent |
| W08 | done | Automated gates and candidate-specific game/browser/portable/installer checks passed; scoped limits below | Agent + maintainer |
| W09 | pending | W08, explicit approval, packaging/runtime and candidate-specific T06 required | Agent + maintainer |
| W10 | pending | W09, explicit approval, watcher and candidate-specific T06 required | Agent + maintainer |
| W11 | pending | Approval; CI, images, remaining tools and inventory closure | Agent + maintainer |
| W12 | pending | Full release-candidate verification and explicit publication approval | Agent + maintainer |

Recommended order and current package targets are recorded in the
[November 4 audit](./UPGRADE-AUDIT-2026-11-04.md). W02 and W05 are complete.
W06-W07 are complete; W08 and later waves remain approval-gated as listed above.

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
rollback identity and remaining checks. Post-merge checks are appended there;
they did not change dependency versions.

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

1. Upgrade lucide-react 1.58.0 -> 1.64.0; inspect every imported icon family.
2. Separately update `@types/better-sqlite3` 7.6.13 -> 9.6.0 only if declarations
   match the installed runtime/Drizzle usage. Do not change SQLite runtime here.
3. Run T01-T03 and API tests for declaration changes; refresh server test ZIP.
   Confirm no schema, API payload, addon or desktop-sync contract changes.
4. This wave did not change SQLite runtime, app contracts, addons, Electron or
   watcher behavior. Do not ship an unverified desktop rebuild.

Evidence: October 30, 2026; source `40a9206` plus uncommitted W01/W02 changes.
Lucide 1.58.0 -> 1.64.0 (1.65.0 deferred by release-age policy);
SQLite declarations 7.6.13 -> 9.6.0; runtime unchanged.
See [W02 evidence and maintainer checklist](./UPGRADE-W02.md).
Automated verification passed. On November 4, the maintainer reported
"looks like the browser stuff works" after the browser spot-check instructions.
Record this as general browser acceptance; the optional offline-cache check was
not reported. No later wave was started automatically from that acceptance.

## W03 - Remaining web/build updates

1. Update `tailwindcss` and `@tailwindcss/vite` 4.3.3 -> 4.3.4 as one focused
   web-only change; inspect CSS output and responsive browser behavior.
2. Separately update `@vitejs/plugin-react` 6.1.2 -> 6.2.1; it is used by web
   and desktop, so build and smoke-test both.
3. Separately update `lucide-react` 1.64.0 -> 1.67.0, the newest release old
   enough for the configured release-age policy at the time; 1.68.0 was held
   until eligible. Inspect imported icons and compare rendered output.
4. Run T01-T03 for web-only changes and T01/T04 for the desktop plugin change.
   No game is required for these checks; hold rebuilt desktop installers until
   game acceptance in W09.

Evidence: November 4, 2026; independently approved offline subset. W02's
separate maintainer spot-check was completed later that day. Baseline: merge commit
`5072460e81840e5450baa4c4387daf805b0ac7d4`, with the audited dependency state.
Updated Tailwind and `@tailwindcss/vite` 4.3.3 -> 4.3.4, React plugin 6.1.2 ->
6.2.1 in web/desktop, and Lucide 1.64.0 -> 1.67.0. No application source or
component version changed. Full frozen install, workspace typecheck, web tests
(15/15), desktop tests (21 passed, 1 live-GitHub test skipped), web/desktop
builds, 390/768/1440 browser smoke, AMD64 web-image build/HTTP smoke and deployment
ZIP contents checks passed. Test ZIP SHA256:
`00EE69796381EA0096875A199FF3F5D6BF512571315169F3F76D3FFDCB693160`.
Image: `flocksync-web:upgrade-w03-offline-5072460`, manifest-list digest
`sha256:246145d99aa9f781b56b7dd7cf0a4436b0eb11150b691da5ed020cf0ec446954`.
No installer/release packaging, game check, commit, push or deployment.
Rollback only the three affected dependency declarations and lockfile closure.

## W04 - Remove legacy pnpm deployment separately

1. pnpm 12.2+ supports non-injected workspace dependencies through a dedicated
   deploy lockfile, so remove only `--legacy`; do not enable dependency injection.
2. Run T05 on both images with fresh deployment output; verify built shared-types
   resolution, production-only dependencies, native SQLite and non-root permissions.
3. Exercise startup, auth, persistence and restart using disposable volumes.
   Failure: restore the previous deploy algorithm, not a policy-bypass flag.

Evidence: November 4, 2026; independently approved offline subset based on
merge commit `5072460e81840e5450baa4c4387daf805b0ac7d4` plus completed W03.
Removed only `--legacy` from the API Dockerfile command; pnpm 12.16.1 generated
the dedicated deploy lockfile and deployed the workspace shared-types dependency
without enabling injected workspace packages or changing the root policy.
`Dockerfile.api` built for `linux/amd64`, image manifest digest
`sha256:29ebd842bbb3c5aeedf51bc6965dbc8e2488efc5c4c79fcb8610a337077580c3`.
Workspace typecheck and API tests passed (10 production, 14 update). A disposable
container ran as UID 1000, passed readiness, synthetic admin login, restart and
login after restart on a disposable volume. Docker reassigned its dynamic host
port on restart; the harness was corrected to re-read the mapping and then passed.
The deployment ZIP was refreshed and inspected (212 entries, required exclusions);
SHA256 `67B9483CF96050A7F5374C28B6F526FCCEBF96DBEE3A46BFED38D632CFAA1D65`.
Test container and volume were removed. No dependency, application source,
production environment, component version, deployment, commit or release changed.
Rollback only the Dockerfile API deploy flag and rebuild/retest the prior image.

## W05 - Server libraries, one migration at a time

1. `fastify` 5.12.7 -> 5.12.8: run API regression tests.
2. `@fastify/cors` 10.1.0 -> 11.4.0: preserve `origin: true` and the configured
   method list; compare reflected origins and preflight headers with the baseline.
3. `@fastify/jwt` 9.1.0 -> 10.2.7: v10 upgrades `fast-jwt` to v6, which rejects
   array-valued claims other than `aud`; verify old/new tokens, claims, expiry,
   malformed tokens and every user role.
4. `@fastify/rate-limit` 10.3.0 -> 11.2.2: cover merged auth limits, keying,
   headers, allowed traffic and standard error responses.
5. Drizzle 0.44.7 -> 0.45.4: verify migrations, guild identity, queries and strict
   `incoming.updatedAt > existing.updatedAt` behavior for older/equal/newer writes.
6. dotenv 16.6.1 -> 18.0.9: test `dotenv/config`, precedence, missing required
   settings, startup errors and logs. Preserve deployed configuration.
7. Run T01-T03/T05 after each migration; use fixture sync requests, not live game data.
   Keep contract changes out of this wave; escalate any required contract migration.

W05 progress — `fastify` 5.12.7 -> 5.12.8:
The official 5.12.8 release is a security release (GHSA-3qgw-9275-xf8w) and also
contains router, stream, parser, and type fixes. The API range and lockfile now
select 5.12.8. Frozen install, workspace typecheck, API production tests (10/10),
API update tests (14/14), AMD64 Docker build, and disposable container readiness,
seeded admin login, authenticated `/me`, and non-root UID 1000 passed. Deployment
ZIP SHA256: `18E6D85F73D4F9594CD49F0FCF20BD6AAB85974E53915B455783C12C8FBD34B6`.

W05 progress — `@fastify/cors` 10.1.0 -> 11.4.0:
The lockfile and API manifest now select 11.4.0. Frozen install, workspace
typecheck, API production tests (10/10), API update tests (14/14), AMD64 Docker
build, and disposable container readiness passed. OPTIONS preflights for GET,
POST, PUT, PATCH, DELETE, OPTIONS, and TRACE returned the same status and CORS
headers as the pre-upgrade baseline; the configured allowed-method header
continues to omit TRACE, and `origin: true` continues reflecting the request
origin. Deployment ZIP contents were checked for the updated manifest/lockfile
and sensitive/local artifacts. SHA256:
`10567D604E54475CB5BABBD12556DFAF9E1D9D50140D1B352D42D8DB8CF57E12`.
Continue with JWT, rate-limit, Drizzle and dotenv, one package at a time.

W05 progress — `@fastify/jwt` 9.1.0 -> 10.2.7:
The release includes the GHSA-9x4w-r9p5-5h7m security fix. The v10 major
updates `fast-jwt` to v6, which rejects array-valued JWT claims other than
`aud`; FlockSync's `AuthUserSchema` uses scalar string/enum claims. The 10.2.7
release also settles asynchronous secret providers once; FlockSync uses the
configured static `JWT_SECRET`. Frozen install, workspace typecheck, API
production tests (10/10), API update tests
(14/14), AMD64 Docker build, and disposable readiness passed. Container checks
confirmed old and new tokens interoperate in both directions for MEMBER,
OFFICER and ADMIN, identity claims and role guards are unchanged, and expired
and malformed tokens still return 401. The deployment ZIP manifest and lockfile
were checked and local secrets/data were excluded. SHA256:
`8DD33F6D38265CB8AB33A4D0678A3361EBD5D6989DFE3EDF0CA697805BEBC4C8`.
Continue with rate-limit, Drizzle and dotenv, one package at a time.

W05 progress — `@fastify/rate-limit` 10.3.0 -> 11.2.2:
Version 11.2.2 includes the GHSA-grpc-p53c-r64v security fix from 11.2.0 and
the local-store counter snapshot fix. Frozen install, workspace typecheck, API
production tests (10/10), API update tests (14/14), AMD64 Docker build, and
disposable readiness passed. Container checks verified login/registration
limits, socket-IP keying despite untrusted `X-Forwarded-For`, the custom 429
body, positive `Retry-After`, and successful requests after window expiry.
The deployment ZIP contains the updated API manifest/lockfile and excludes
local data. SHA256:
`89AC33995E3B31E97C26E5D80EF78D0F72175F1ECCEF9C20F8407FDBCD19CE1D`.
Continue with Drizzle and dotenv, one package at a time.

W05 progress — Drizzle 0.44.7 -> 0.45.4:
Version 0.45.2 fixes improper escaping in `sql.identifier()` and `sql.as()`
(CWE-89); API source uses neither helper, relying on parameterized SQL
templates and the query builder. The 0.45.3 Netlify driver and 0.45.4
`postgres-js` prepared-query fix do not affect FlockSync's better-sqlite3
driver. Frozen install, workspace typecheck, API production tests (10/10),
API update tests (14/14), AMD64 Docker build, and disposable readiness passed.
Migration, guild/sync, epoch conflict, SQLite CRUD, UID 1000, and container
restart/persistence checks passed. The deployment ZIP was verified to contain
the updated manifest/lockfile and exclude local data. SHA256:
`2EFD7D942E763CB5479F778C59A237AA319B826ABB74FE32F0FAEED627589A29`.

W05 progress — dotenv 16.6.1 -> 18.0.9:
Version 18 adds the dotenv CLI and removes `.env.vault` support; FlockSync uses
neither and retains its explicit `import "dotenv/config"` entry point. The
18.0.9 CLI-only `DOTENV_PATH` change does not affect the API. Frozen install,
workspace typecheck, API production tests (10/10), API update tests (14/14),
and web tests (15/15) passed. Isolated checks verified `.env` loading,
process-environment precedence, explicit failure for a missing `JWT_SECRET`,
and container startup/auth. AMD64 API and web images built; isolated
API-to-nginx integration passed SPA shell, readiness, login and authenticated
request checks. Final deployment ZIP contains the updated manifest/lockfile
and excludes local secrets/data. SHA256:
`4C3CF820C1154620E1E7DC5810C66FA904917B4D205D0D8EB5BD06C0A50B6F98`.

W05 complete: all six API dependency updates passed their offline checks.
No game, release installers, live deployment, commit, push or publication was
performed. Continue to W06 only after its approval gate.

## W06 - Native database engine

1. better-sqlite3 12.11.1 -> 13.0.3; review N-API/prebuild changes and Node floor.
2. Run T01/T02/T05 on Windows and Linux AMD64/ARM64. Verify WAL/SHM access,
   bound parameters, strict timestamp guards, migrations and concurrent reads/writes.
3. Back up an old-version fixture, restore/read it with the new engine, restart,
   and restore a verified pre-upgrade backup into the old stack as a rollback drill.
   Never assume binary downgrade alone safely reverses database changes.

Evidence: November 4, 2026. better-sqlite3 13.0.3 uses Node-API, bundles
SQLite 3.53.4, and requires Node >=22; the API container remains on Node 22.
On Windows Node 24.22.0, frozen install and native loading passed. API production
tests (10/10), update tests (14/14), workspace typecheck, AMD64 and ARM64 image
builds and runtime checks passed. Both Linux images booted as UID 1000, passed
readiness/auth, applied all four migrations, and verified WAL/SHM sidecars,
bound writes and reads, concurrent WAL reader/writer snapshots, and online
backup. AMD64/ARM64 execution used Docker's Buildx/emulation, not physical ARM
hardware. The retained old image confirmed better-sqlite3 12.11.1 / SQLite
3.53.2; it created a verified backup which 13.0.3 read and restored. After a
new-engine write, 12.11.1 reopened the database and restored the pre-upgrade
backup successfully. The deployment ZIP contains the new API manifest/lockfile,
excludes sensitive/local payloads, and has SHA256
`9DCC7BBC8795C2CFFAA3F303931E1F927FF43173D4FFC4964208BFE2B38E88FC`.
Only disposable databases and Docker volumes were used; all test containers and
volumes were removed. No live server, physical Pi, commit, push or release
publication was used. W07 was started after its separate maintainer approval.

## W07 - Compiler and supported runtime alignment

1. Align API/shared TypeScript 5.9.3 -> 7.0.2 with web/desktop; review intervening
   migrations. Verify emitted JS/declarations, package exports and all consumers.
2. Align Node declarations to each actual host/container/Electron runtime.
   Update web/desktop 26.6.5 -> 26.6.6; retain API 22.20.5 unless a newer 22.x
   declaration is verified. Do not choose the latest `@types/node` major blindly.
3. The post-merge AMD64 image already ran Node 22.23.4, the current Node 22 line
   observed in this audit. Do not combine any future runtime change with SQLite;
   align engines/docs only with verified dependency floors.
4. Run T01-T05; require T06 before distributing a changed collector/runtime.

Evidence: November 4, 2026. API/shared-types moved from TypeScript 5.9.3
through 6.0.3 to 7.0.2, matching web/desktop. Each compiler step passed a
workspace build. `@types/node` web/desktop declarations moved 26.6.5 -> 26.6.6;
API remains on current Node 22 declarations 22.20.5, with Electron's separate
Node 24.19.2 declarations unchanged. No TypeScript programmatic API consumers
were found, and no compiler configuration or application code required edits.
Frozen install, workspace typecheck/build, API production tests (10/10) and
update tests (14/14), web tests (15/15), and desktop tests (21 passed, 1
skipped, 0 failed) passed. The deployment ZIP was refreshed with the updated
API/shared-types manifests and lockfile; AMD64 API and web Docker builds and
isolated container readiness, auth, SPA fallback, and API restart-persistence
checks passed. No game, installer packaging, live deployment, commit, push or
publication occurred during W07 implementation. Game access subsequently returned;
see the November 4-5 baseline T06 evidence below. W08 still requires separate
approval and acceptance of its changed contracts.

### Baseline game checkpoint - November 5, 2026

Maintainer reports now cover solo and remote gear/availability, rank-based and
website-authorized collection, upload rejection across guild/realm and guildless
boundaries, helper loading, main/alt grouping, member relay and update notices.
Reload-notice repetition is explicitly acceptable either way. See the
[T06 evidence](./UPGRADE-TESTS.md#maintainer-evidence---november-4-5-2026)
for the distinction between server authorization and local aggregation, missing
candidate identities, unverified live stale-write rejection, single-account
coverage and the known premature reload prompt.

Documentation checkpoint: record the reported evidence without changing runtime
behavior, versions or artifacts. Acceptance gate: review the documentation diff
and check whitespace; no runtime build is required for documentation-only edits.
Suggested commit: `Record live guild sync testing and remaining checks`.
This is not final release acceptance or permission to publish.

Next implementation checkpoint, only after explicit W08 approval: recheck the
Zod target/compatibility, migrate coordinated consumers, pass T01-T05 and repeat
applicable T06 checks against identified candidate artifacts. Do not start W09
or W10 as part of that checkpoint.

## W08 - Shared Zod migration: game gate

1. A working-game testing window is reported available; get the maintainer's
   explicit approval and schedule T06 before starting the migration.
2. Migrate Zod 3.25.76 -> 4.6.7 across shared/API/web/desktop as one coordinated
   contract change. Cover defaults, optional fields, coercion, refinements and errors.
3. Use old payload fixtures to test Lua-parser output, sync requests/responses,
   auth, themes, helper serialization and release metadata; reject invalid inputs.
4. Run T01-T06. Ship only after real capture -> upload -> helper load succeeds.

Evidence: November 5, 2026; maintainer approved W08 with "lets start".
Baseline workspace build passed. npm reported stable Zod `4.6.7`, and pnpm's
release-age/supply-chain policy accepted it. Updated all four direct consumers
from `3.25.76` to `4.6.7`, retaining coordinated `^4.6.7` ranges.
Reviewed the [official migration guide](https://zod.dev/v4/changelog).
Changed the web name-cache record to explicit string keys/string values and
the API proxy validator from `.ip({ version: "v4" })` to `z.ipv4()`.
Existing schema strictness, refinements and optional fields remain in place.
Zod 4 rejects unsafe integers and may change validation error wording; tests
assert actionable field paths/statuses rather than the old wording.

Frozen install, workspace typecheck/build, API production tests (11/11),
API update tests (14/14), web tests (16/16), and desktop tests (25 passed,
1 opt-in live-update test skipped) passed. Added synthetic legacy Lua/sync,
availability, helper/snapshot/metadata, auth, theme/refinement, update-default,
name-cache and environment coercion/IPv4 regressions. No real SavedVariables,
desktop credentials or production databases were read for these checks.

After the maintainer started Docker Desktop, AMD64 API/web image builds passed
(`flocksync-api:w08-zod-test`, `flocksync-web:w08-zod-test`).
An isolated internal network with disposable containers verified non-root API
startup, Zod 4 availability, readiness, nginx SPA fallback/proxy, login, legacy
sync and helper response, roster availability, invalid-input rejection, and
database persistence across API restart. No host ports were exposed. Test
containers/network were removed. ARM64 was not rerun for this pure-JS migration;
W06's native-runtime evidence is historical, not a fresh W08 ARM64 result.

Windows installer/portable packaging passed; the packaged ASAR main matches
the rebuilt output and contains no root desktop config or node_modules folder.
The deployment ZIP was refreshed and inspected for Zod dependency alignment
and sensitive-path exclusions. Candidate identities (SHA256):

| Candidate | SHA256 |
| --- | --- |
| `release/FlockSync_Remote_Server_Deploy.zip` | `944CA4E63488288F042FF6A7CB4EEA54D94E20DBF2CDDF5AEB736D4D6FF705B3` |
| `apps/desktop/release/FlockSync-Setup-0.5.1-x64.exe` | `4E69452F57AFB0AA843D81EDE8F3E6A222BCFEAC246AFDB8178ABF47C4602E0D` |
| `apps/desktop/release/FlockSync-Portable-0.5.1-x64.exe` | `8BE6EE5CBCD02E50D15E5549FE147BB81024A519A3CBA5199345B6E674A5EFE9` |

These are local test candidates with unchanged component versions, not a release
or replacements for published same-version downloads. Root release desktop assets
and the existing bundle manifest were not regenerated; that directory is not a
coherent W08 release set. No component bumps, commit, deployment, tag, push or
publication were performed.

Manual acceptance update: maintainer passed isolated browser login/theme/roster,
rebuilt Desktop login/synthetic sync, real game export upload, fresh equipment
removal/restoration and exit -> sync -> helper login, with no reported errors.
The Desktop used a separate-userData Electron harness, not installer/portable
execution. Original helper and `.bak` files were backed up and hash-verified,
then restored and verified after WoW and the test Desktop were closed. Manual
test containers were stopped; the local URL is no longer active.
Portable follow-up: actual candidate launch with isolated settings/synthetic
files reached the local website by maintainer report and exited completely.
With explicit approval, original startup entries were backed up, restored and
verified by the launch wrapper. No FlockSync processes remained afterward;
manual API/web containers were stopped again. Installer launch and remaining
packaged settings/relaunch checks are still pending. No prior baseline report
substitutes for those modes.

Portable relaunch/settings follow-up passed by maintainer report: saved login,
endpoint/path, sync, startup/minimized preferences off, close-to-tray enable,
tray reopen and Quit, with no errors. Startup entries were restored/verified
and test services stopped again. Installer execution remains pending;
startup-at-login activation was intentionally not exercised on the normal
Windows account.

Installer follow-up passed November 5. Maintainer explicitly accepted replacing
the normal installation and reported installation to `C:\Program Files\FlockSync`
without errors. Normal config/startup entries were backed up first; installed
ASAR matched the candidate hash. Installed launch with isolated settings passed
login/settings, synthetic sync/roster and tray close/reopen/Quit by maintainer
report. Startup entries were restored/verified, normal config remained
hash-identical to its backup, and manual services were stopped. The unreleased
installed binary remains at unchanged `0.5.1`; no server deployment occurred.
This closes the earlier pending W08 candidate acceptance. W08 is complete for
the scoped migration; reboot/startup activation, multi-account live behavior
and fresh ARM64 checks remain unverified, not passed.

Ready-to-commit checkpoint: W08 coordinated validation upgrade, subject to
normal changed-component version preparation and final artifact refresh when
the maintainer is ready to commit. Suggested message:
`Update data validation while preserving guild sync and settings`.
W09 is not started; obtain explicit approval before its separate packaging
and Electron upgrades.
Follow the [W08 handoff](./UPGRADE-TESTS.md#w08-candidate-handoff---november-5-2026).
Do not mark W08 done or start W09 from the earlier baseline game reports.
Rollback checkpoint is the pre-W08 committed tree/lockfile; retain all unrelated
work and do not restore a production database merely to revert this dependency.

## W09 - Desktop runtime and packaging: game gate

1. First electron-builder 26.15.3 -> 26.18.0, then Electron 44.8.0 -> 45.2.2
   in separate change sets. Keep Chokidar unchanged for attribution.
2. Run T01/T04/T06 for each: installed and portable launch, preload/IPC, tray,
   startup settings, auth, network fetch, update checks, saved paths and fixture sync.
3. Verify packaging contains correct dependencies and no configuration/secrets.
   Require live-game collection/helper acceptance before desktop distribution.

## W10 - Chokidar migration: game gate

1. Chokidar 5.0.0 -> 6.0.0 changes Windows watching; verify embedded Node meets
   its floor (audit: >=22.22), options and close behavior before implementation.
2. Extend T04 with new/missing account directories, create/rename/atomic replacement,
   rapid saves, duplicates, partial writes, retries, shutdown and watcher recreation.
3. Run T06 across logout/reload/relogin and multiple accounts. Prove successful
   final-state sync without lost updates, runaway repeats or unsafe helper overwrites.

## W11 - CI, container images and remaining tooling

1. Recheck action versions/changelogs (the November 4 npm scan does not cover
   GitHub Actions), then update checkout, github-script, and upload-artifact
   separately. Review Node/ESM compatibility and embedded scripts.
   Test packager workflow with publishing disabled; preserve hidden ZIP inclusion.
2. BigWigs packager v2 already tracks current major (audit release 2.6.1);
   optional SHA pinning is not a required major update. Never duplicate uploads.
3. Inspect nginx digest/version before refreshing; test proxy, SPA routing and PWA.
   Evaluate backup Alpine 3.23 patch separately from 3.24.3 branch migration;
   test cron, permissions, retention, actual backup integrity and isolated restore.
4. Recheck VS Code/Container Tools/Dev Containers and other extensions via their
   own version histories; distinguish extension versions from embedded libraries.
   The November 4 audit records candidate host versions; install/update none without
   separate maintainer approval and a recovery plan.
   The audit records newer Docker Desktop/Compose/Buildx candidates; recheck and
   update host tools only with separate maintainer approval and recovery plan.
5. Inventory Python/MSBuild/.NET and remote OS tooling before claiming currency.
   Do not install a runtime merely because it exists; Lua remains 5.1.
6. Re-audit all direct/transitive packages and deprecations. Record retained versions,
   owning parents, support reasons and review dates; do not force "zero outdated."

## Test recipes and mandatory acceptance

Execute [UPGRADE-TESTS.md](./UPGRADE-TESTS.md) for T01-T06, including the exact
commands, isolation requirements, browser checks and maintainer game checklist.
Missing required evidence blocks the wave; a skipped test is never acceptance.

## W12 - Release and rollback gate

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
