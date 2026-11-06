# Dependency and Tooling Audit

Checked November 4, 2026 on `Dependency-Upgrade-Before-Launch`, after merge
commit `5072460e81840e5450baa4c4387daf805b0ac7d4`. This is an inventory and
revised execution order, **not approval to upgrade anything**.

## Registry results

The refreshed [CSV inventory](./UPGRADE-INVENTORY-2026-11-04.csv) covers all
479 unique package names and 585 locked package versions in `pnpm-lock.yaml`.
Every locked version and each package's npm `latest` tag was queried successfully.
263 package names (317 locked versions) are behind that tag; these include
transitive versions and are not 263 independent upgrade recommendations.
The npm `latest` tag is not by itself a compatibility, release-age, or security
assessment. Recheck the target, changelog, engine constraints, and pnpm release
age policy immediately before each approved wave.

The merged `main` adds one direct dependency not in the previous inventory:
`@fastify/rate-limit` 10.3.0, used by the API's request limiting. No dependency
manifest or lockfile was changed during this audit.

## Direct upgrade candidates

Risk is a planning estimate, not a guarantee of behavior. Make each API/runtime
major a separate change set and retain the prior lockfile/source checkpoint.

| Area | Locked -> npm latest | Relative complexity and required attention | Changelog |
| --- | --- | --- | --- |
| Web styles | `tailwindcss` and `@tailwindcss/vite` 4.3.3 -> 4.3.4 | Low; compare generated CSS and run web build/browser checks. | [Tailwind CSS releases](https://github.com/tailwindlabs/tailwindcss/releases) |
| Web/desktop build | `@vitejs/plugin-react` 6.1.2 -> 6.2.1 | Low-medium; affects both Vite apps, so build and smoke-test both outputs. | [Plugin releases](https://github.com/vitejs/vite-plugin-react/releases) |
| Web icons | `lucide-react` 1.64.0 -> 1.67.0 (1.68.0 held by release-age policy) | Low; imported icons were checked against 1.67 changes; none are affected. | [Lucide releases](https://github.com/lucide-icons/lucide/releases) |
| API framework | `fastify` 5.12.7 -> 5.12.8 | Low; patch update, run API regression suite. | [Fastify releases](https://github.com/fastify/fastify/releases) |
| API CORS | `@fastify/cors` 10.1.0 -> 11.4.0 | Medium; preserve the existing reflected-origin and method behavior; compare preflight responses. | [CORS releases](https://github.com/fastify/fastify-cors/releases) |
| API JWT | `@fastify/jwt` 9.1.0 -> 10.2.7 | Medium-high; major update also brings `fast-jwt` v6's scalar-claim rule (except `aud`); verify cross-version tokens, expiry, claims, and all roles. | [JWT releases](https://github.com/fastify/fastify-jwt/releases) |
| API rate limiting | `@fastify/rate-limit` 10.3.0 -> 11.2.2 | Medium; verify auth limits, socket-IP keying, headers, and error responses; v11 removes deprecated types. | [Rate-limit releases](https://github.com/fastify/fastify-rate-limit/releases) |
| API ORM | `drizzle-orm` 0.44.7 -> 0.45.4 | Medium; verify migrations and strict epoch writes; 0.45.2 fixes CWE-89 escaping in helpers not used by FlockSync. | [Drizzle releases](https://github.com/drizzle-team/drizzle-orm/releases) |
| API environment loading | `dotenv` 16.6.1 -> 18.0.9 | Medium; v18 removes `.env.vault` and preloading support; verify the retained `dotenv/config` import, precedence, and startup errors. | [dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md) |
| Native SQLite | `better-sqlite3` 12.11.1 -> 13.0.3 | High; native prebuild/ABI and Node-floor change risk; test Windows, Linux AMD64/ARM64, WAL, and backup/restore. | [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases) |
| TypeScript | API/shared 5.9.3 -> 7.0.2; web/desktop already 7.0.2 | Medium-high; inspect breaking compiler changes, emitted JS/declarations, and all consumers. | [TypeScript releases](https://github.com/microsoft/TypeScript/releases) |
| Node declarations | web/desktop 26.6.5 -> 26.6.6; API 22.20.5 is current on the 22.x line | Low; keep API declarations aligned to its Node 22 runtime, not the unrelated 26.x npm latest tag. | [DefinitelyTyped releases](https://github.com/DefinitelyTyped/DefinitelyTyped/releases) |
| Shared validation | `zod` 3.25.76 -> 4.6.7 | High; coordinated major across API/web/desktop/shared types; contract and real-game gate. | [Zod releases](https://github.com/colinhacks/zod/releases) |
| Desktop packaging | `electron-builder` 26.15.3 -> 26.18.0 | Medium; inspect packaged contents, signing/update metadata, installer and portable launch. | [electron-builder releases](https://github.com/electron-userland/electron-builder/releases) |
| Desktop runtime | `electron` 44.8.0 -> 45.2.2 | High; validate native/runtime behavior and both install modes before distribution. | [Electron releases](https://github.com/electron/electron/releases) |
| Desktop watcher | `chokidar` 5.0.0 -> 6.0.0 | High; Windows event behavior and embedded Node floor; test atomic replacement, partial writes, retries, and shutdown. | [Chokidar releases](https://github.com/paulmillr/chokidar/releases) |

`@types/node@22` is 22.20.5 and `node@22` is 22.23.4 from the registry
version-range checks. The API's current Node declaration therefore does not
need a version bump based on this audit; update the API runtime line only as a
separate, tested decision. Web/desktop declarations have a patch candidate.

### W03 execution result

The approved offline-only W03 subset is complete. Installed Tailwind and
`@tailwindcss/vite` 4.3.4, `@vitejs/plugin-react` 6.2.1 in web/desktop, and
`lucide-react` 1.67.0. Lucide 1.68.0 was published less than 24 hours before the
update and was not installed. W03 build/test/artifact evidence is in
[UPGRADE-PLAN.md](./UPGRADE-PLAN.md). The maintainer later reported the W02
browser spot-check as working; optional offline-cache acceptance was not
reported. Game-gated upgrade waves remain blocked.

Reviewed release notes: Tailwind 4.3.4 adds its Turbopack loader and includes
scoping, symlink-watch, parser, and reload fixes; the React plugin release fixes
refresh include/exclude options and expands optional peer ranges; Lucide 1.67
adds icons and changes `chef-hat`/letter-J icons, none imported by FlockSync.

### W04 execution result

Removed `--legacy` from the API Docker deploy command. Official pnpm 12
documentation confirms the modern implementation works without enabling
`injectWorkspacePackages`; isolated AMD64 build, runtime, auth and restart
checks passed. See the [W04 evidence in the plan](./UPGRADE-PLAN.md).

### W05 progress

Updated Fastify 5.12.7 -> 5.12.8 and `@fastify/cors` 10.1.0 -> 11.4.0. The
Fastify release is a security release for GHSA-3qgw-9275-xf8w. Frozen install,
workspace typecheck, all 24 API regression tests, AMD64 API image builds, and
disposable readiness checks passed. CORS preflights for each configured method
and TRACE matched the pre-upgrade response headers/status; `origin: true`
continues reflecting the request origin, and TRACE remains absent from the
advertised method list. The refreshed deployment ZIP contains the updated API
manifest/lockfile and excludes local environment/database/dependency data;
SHA256 `10567D604E54475CB5BABBD12556DFAF9E1D9D50140D1B352D42D8DB8CF57E12`.
See [W05 package-by-package evidence in the plan](./UPGRADE-PLAN.md).

Updated `@fastify/jwt` 9.1.0 -> 10.2.7. Its v10 major update
brings `fast-jwt` v6, which rejects array-valued claims other than `aud`;
FlockSync's auth schema uses scalar claims. The 10.2.7 release also settles
asynchronous secret providers once; FlockSync uses the configured static
`JWT_SECRET`. The release includes the GHSA-9x4w-r9p5-5h7m security fix.
Frozen install, workspace typecheck, all 24
API regression tests, AMD64 API image build, and disposable readiness passed.
Old and new tokens interoperate in both directions for all roles; claims and
role guards are unchanged, while malformed and expired tokens remain 401. The
refreshed deployment ZIP SHA256 is
`8DD33F6D38265CB8AB33A4D0678A3361EBD5D6989DFE3EDF0CA697805BEBC4C8`.
Rate limiting is also updated below; Drizzle is updated later, and dotenv remains.

Updated `@fastify/rate-limit` 10.3.0 -> 11.2.2. The release includes the
GHSA-grpc-p53c-r64v security fix from 11.2.0 and a local-store counter snapshot
fix. Frozen install, workspace typecheck, all 24 API regression tests, AMD64
API image build, and disposable readiness passed. Container checks confirmed
login and registration limits, socket-IP keying despite untrusted
`X-Forwarded-For`, the custom 429 body, `Retry-After`, and acceptance after
window expiry. The deployment ZIP SHA256 is
`89AC33995E3B31E97C26E5D80EF78D0F72175F1ECCEF9C20F8407FDBCD19CE1D`.
Drizzle is updated below; dotenv is the remaining W05 package.

Updated Drizzle 0.44.7 -> 0.45.4. Version 0.45.2 fixes improper escaping in
`sql.identifier()` and `sql.as()` (CWE-89); API source uses neither helper and
continues to use parameterized SQL templates/query builders. The 0.45.3
Netlify driver and 0.45.4 `postgres-js` prepared-query fix do not apply to
FlockSync's better-sqlite3 driver. Frozen install, workspace typecheck, all 24
API regression tests, AMD64 image build, migration/sync/epoch coverage, and a
disposable SQLite CRUD/restart check passed. The deployment ZIP SHA256 is
`2EFD7D942E763CB5479F778C59A237AA319B826ABB74FE32F0FAEED627589A29`.

Updated dotenv 16.6.1 -> 18.0.9. The v18 major adds a CLI, changes loading logs,
and removes `.env.vault` support and the old preloading feature; FlockSync does
not use the CLI or vault feature, and its `import "dotenv/config"` entry point
was verified. The v18.0.9 change permits an empty `DOTENV_PATH` in the CLI,
which the API does not use. Npm reports publication on 2026-10-22, well beyond
the release-age hold. Frozen install, workspace typecheck, all 24 API tests,
15 web tests, and AMD64 API/web builds passed. Isolated checks confirmed `.env`
loading, process-environment precedence, explicit missing-`JWT_SECRET` failure,
and API container startup/auth. Isolated API/nginx integration verified the SPA
shell, readiness proxy, login and authenticated routes. Deployment ZIP SHA256:
`4C3CF820C1154620E1E7DC5810C66FA904917B4D205D0D8EB5BD06C0A50B6F98`.

W05 is complete for offline scope. No game testing, release installer packaging,
commit, push, live deployment or publication occurred. Lucide 1.68.0 remains
held by release-age policy.

## W06 - Native SQLite

Updated API `better-sqlite3` 12.11.1 -> 13.0.3. Version 13 moved to Node-API,
removed `prebuild-install`, and raises the Node floor to >=22. The API image
already runs Node 22.23.4, so the floor is compatible without changing the
runtime. The new package reports SQLite 3.53.4; the old 12.11.1 image reports
SQLite 3.53.2. Windows Node 24.22.0 loaded the new native binding successfully.

Frozen install, API production tests (10/10), API update tests (14/14), and
workspace typecheck passed. Linux AMD64 and ARM64 API images both built and
booted under Buildx; each passed readiness, login/auth, all four migrations,
UID 1000, WAL/SHM sidecar checks, bound insert/read, concurrent reader/writer
snapshot checks and backup smoke tests. ARM64 was executed under Docker
emulation, not on physical ARM hardware.

An isolated cross-version drill used a disposable database: the old 12.11.1
engine wrote data and made an integrity-verified backup; 13.0.3 read and
restored it, wrote new data and made a second backup; 12.11.1 then reopened the
new-engine database and restored the verified pre-upgrade backup. Data matched
at every step. The refreshed deployment ZIP contains the new manifest and
lockfile and excludes local/sensitive payloads. SHA256:
`9DCC7BBC8795C2CFFAA3F303931E1F927FF43173D4FFC4964208BFE2B38E88FC`.
All disposable containers and volumes were removed. No production service,
physical Pi, game, commit, push, or publication was used. W06 is complete for
offline scope.

## W07 - TypeScript and Node declarations

Updated API/shared-types TypeScript 5.9.3 -> 7.0.2, matching web/desktop.
The compiler was advanced through TypeScript 6.0.3 first; the complete
workspace build passed at both intermediate and target versions. No TypeScript
API consumers were found, so no compatibility package or compiler config
changes were needed. No application source changes were required.

Updated the direct web/desktop `@types/node` declarations 26.6.5 -> 26.6.6.
Kept API declarations at 22.20.5, the current Node 22 line, and left Electron's
transitive Node 24 declarations at 24.19.2.

Frozen install, full workspace typecheck/build, API production tests (10/10),
API update tests (14/14), web tests (15/15), and desktop tests (21 passed,
1 skipped, 0 failed) passed. The skipped desktop test is the existing opt-in
live-update check; GitHub live-update testing was not enabled. The refreshed
deployment ZIP includes the compiler/type declaration changes in its source
manifests and lockfile. AMD64 API and web Docker builds and isolated runtime
checks for readiness, auth, SPA fallback, and API database persistence across
restart passed. No game, release installers, live deployment, commit, push, or
publication occurred. W07 is complete for offline scope; W08 remains blocked
pending real-game acceptance.

## W08 follow-up - November 5, 2026

W08 was explicitly approved after game access and baseline guild testing
returned. All four direct Zod consumers now use `4.6.7`; the CSV's Zod row
reflects this change, not a fresh registry audit of every dependency.
Explicit record keys and `z.ipv4()` replace the removed APIs. Workspace
typecheck/build, frozen install, API production (11), update (14), web (16)
and desktop (25 passed, one opt-in skipped) tests passed, including new legacy
contract/default/refinement/coercion regressions. Windows candidates and the
deployment ZIP were rebuilt; isolated AMD64 API/web builds and runtime checks
passed and disposable containers/network were removed.
Candidate hashes and limitations are in [W08 evidence](./UPGRADE-PLAN.md#w08---shared-zod-migration-game-gate).
Candidate-specific manual acceptance remains pending; W08 is in progress,
not complete. No production deployment or release publication occurred.

## W09 builder follow-up - November 5, 2026

Explicitly approved W09 began from clean checkpoint `e51799e`. Electron-builder
is now `26.18.0`; Electron `44.8.0` and Chokidar `5.0.0` are unchanged.
Frozen install, workspace typecheck, desktop build, installer/portable packaging,
25 desktop tests and ASAR content checks passed; one opt-in test was skipped.
Both executables are unsigned; no signing credential was configured.
The inventory builder row reflects this update only. Registry currently reports
Electron `45.2.3`; its eventual target must be rechecked after builder acceptance.
Manual acceptance is pending. See [W09 evidence](./UPGRADE-PLAN.md#w09---desktop-runtime-and-packaging-game-gate)
for hashes, changelog, rollback and handoff. No installation or deployment was
performed for these new candidates.

## W09 Electron follow-up - November 5, 2026

Electron `44.8.0 -> 45.2.3` passed frozen install, workspace typecheck,
desktop packaging and regressions (25 passed, one optional skipped).
Builder `26.18.0` and Chokidar `5.0.0` remain unchanged. Actual-runtime smoke
verified sandboxed built preload/IPC and native loopback fetch on Electron
45.2.3 / Node 24.22.2 / Chromium 156.0.8078.80. No source changes were required.
The CSV Electron row reflects the rechecked stable target, not a full inventory
refresh. Installer/portable hashes, known unsigned status, rollback and pending
manual acceptance are in [runtime evidence](./UPGRADE-PLAN.md#electron-checkpoint---november-5-2026).
The installed app remains the builder-only Electron 44 candidate.

## Deprecated locked versions

Registry metadata marked seven locked transitive versions deprecated:
`@esbuild-kit/core-utils` 3.3.2 and `@esbuild-kit/esm-loader` 2.6.5 (merged into
tsx), `boolean` 3.2.0 (unsupported), `glob` 7.2.3 (unsupported), `inflight`
1.0.6 (unsupported/memory leak), `prebuild-install` 7.1.3 (unmaintained), and
`rimraf` 2.6.3 (pre-v4 unsupported). Use `pnpm why <package>` to identify the
owning dependency when addressing them; do not add overrides or force transitive
versions just because they are old. This was not an `npm audit` or CVE scan.

## Local and container tooling observed

| Tool | Observed | Audit note |
| --- | --- | --- |
| Host Node | 24.22.0 | 24.22.2 was available in the prior host-tool check; optional host update, separate from workspace packages. |
| pnpm | 12.16.1 | Current in the prior registry/GitHub check; retain the repository pin and `deploy --legacy` until its isolated wave. |
| Docker Desktop | 4.97.0 | 4.98.0 was available in the prior check; host maintenance only. |
| Docker Engine / CLI | 29.9.2 | Engine responsive; Linux x86_64. |
| Docker Compose | 5.6.1 | 5.7.0 was available in the prior check. |
| Buildx | 0.38.1 | 0.38.2 was available in the prior check; recheck and test Bake/build behavior before host update. |
| VS Code | 1.145.0 | Installed at audit time. |
| Container Tools extension | 2.5.3 | Current in the prior Marketplace check. |
| Dev Containers extension | 0.469.0 | 0.471.0 was available in the prior Marketplace check. |
| Locally built container bases | Node 22.23.4, nginx 1.31.8, Alpine 3.24.3 | Observed during the post-merge AMD64 builds; base tags are not immutable deployment identities. |
| Git / Python / Lua | Git 2.56.0.windows.3; Python 3.14.7; Lua 5.1 unavailable | These host versions were not rechecked against their latest releases in this pass. No in-game/Lua result is implied. |

Tool candidate versions marked "available" come from the earlier host-tool
inventory and must be rechecked before action. No host tool was installed or
updated here. Both Dockerfiles built for AMD64; ARM64 was not built or tested.

## Recommended next-wave order

1. W02 maintainer browser spot-check is complete; optional offline-cache
   acceptance was not reported.
2. W03: low-complexity web/build updates. Keep the React plugin, styles, and icon
   change separately attributable; no game is needed for those checks.
3. W04: remove pnpm's legacy deployment flag in isolation.
4. W05: API packages one at a time; include the newly discovered rate-limit
   package and use API fixtures, not production credentials or game data.
5. W06 (complete): native SQLite across Windows and emulated AMD64/ARM64, with a
   cross-version backup/restore rollback drill. W07 (complete): TypeScript/types.
6. W08: Zod contract migration requires T06; currently blocked because the
   maintainer cannot perform in-game testing.
7. W09-W10: desktop builder/runtime, then Chokidar. Offline tests can prepare
   changes, but distribution/acceptance stays blocked until real collector/helper
   testing can be completed.
8. W11: CI/container/host tooling, each independently reviewed and tested.
9. W12: full release candidate checks. Publication remains a separate explicit
   authorization.

Do not treat the ordering as automatic approval. Each wave needs approval,
evidence, rollback notes, tests, and executable maintainer instructions whenever
manual acceptance is required.
