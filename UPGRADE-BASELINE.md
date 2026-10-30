# W00 baseline evidence

Recorded October 30, 2026. Companion to [upgrade plan](./UPGRADE-PLAN.md) and
[test recipes](./UPGRADE-TESTS.md). **No dependencies upgraded.**

## Status and source checkpoint

- W00: `done` for offline/AMD64 baseline; W01 and later waves: not started.
  Initial Docker blocker was cleared in the continuation below.
- Branch: `Dependency-Upgrade-Before-Launch`.
- HEAD and locally recorded upstream:
  `40a920646151129a425b8b59c862a0dab9abb570`.
- Commit: Improve mobile dashboard layouts and add home-screen installation.
- Maintainer reports the mobile changes were tested, functional and pushed.
  Upstream equality was checked locally; no remote publication/deployment was inferred.
- At start, only planning documents were dirty: RELEASES.md, UPGRADE-PLAN.md,
  UPGRADE-TESTS.md. This evidence file and plan status are the only new work.
- Source rollback checkpoint: that commit, retaining these planning documents.
  Do not reset the branch or discard unrelated work.
- No dependency/component package bumps, host installs, commits, tags, publication
  or live deployment occurred. The later authorized manifest correction is below.
  Generated workspace outputs were rebuilt for baseline testing, not release packaging.

## Toolchain and component versions

| Item | Observed baseline |
| --- | --- |
| Windows Node | 24.22.0 |
| pnpm executable and root pin | 12.11.2 |
| Git for Windows | 2.56.0.windows.3 |
| Docker CLI | 29.9.2 |
| Compose | 5.6.1 |
| Buildx | 0.38.1 |
| Docker engine | Unavailable: dockerDesktopLinuxEngine pipe not found |
| Lua / lua5.1 / luajit on PATH | None found |
| Electron package executable | 44.8.0 (`electron --version`) |
| API / web | 0.6.1 / 0.6.1 |
| Shared types / desktop | 0.6.0 / 0.5.1 |
| Main addon / AppHelper | 0.6.0 / 0.2.2; Interface 16001 |
| Root package | 0.2.2 |

Node and pnpm resolve from the existing Author Software nvm Node installation;
Git resolves from Program Files Git; Docker CLI from Docker Desktop.
No tool installation or Docker Desktop start/restart was attempted.

Resolved direct dependencies from `pnpm list --depth 0 --recursive`:

| Scope | Installed dependencies and development tools |
| --- | --- |
| API runtime | @fastify/cors 10.1.0; @fastify/jwt 9.1.0; bcryptjs 3.0.3; better-sqlite3 12.11.1; dotenv 16.6.1; drizzle-orm 0.44.7; fastify 5.12.7 |
| API development | @types/bcryptjs 2.4.6; @types/better-sqlite3 7.6.13; @types/node 22.20.5; drizzle-kit 0.31.11; tsx 4.23.15; TypeScript 5.9.3 |
| Shared / all validation | Shared TypeScript 5.9.3; Zod 3.25.76 across all four packages |
| Web UI | lucide-react 1.58.0; React / React DOM 19.3.1 |
| Web build | @tailwindcss/vite / tailwindcss 4.3.3; @types/node 26.6.5; @types/react / @types/react-dom 19.3.0; @vitejs/plugin-react 6.1.2; TypeScript 7.0.2; Vite 8.3.4 |
| Desktop | Chokidar 5.0.0; Electron 44.8.0; electron-builder 26.15.3; electron-vite 6.0.0; React / React DOM 19.3.1 |
| Desktop build/types | @types/node 26.6.5; @types/react / @types/react-dom 19.3.0; @vitejs/plugin-react 6.1.2; TypeScript 7.0.2; Vite 8.3.4 |

Shared-types remains a local workspace dependency, not an external npm release.
No fresh latest-version lookup was needed for baseline execution.

## Executed baseline checks

| Check | Command / method | Result |
| --- | --- | --- |
| T01 typecheck | `pnpm run typecheck` | Passed all four packages |
| T01 build | `pnpm run build` | Passed shared, API, web and desktop |
| T02 production | `pnpm --filter @flocksync/api test:production` | 6 passed, 0 failed |
| T02 updates | `pnpm --filter @flocksync/api test:updates` | 14 passed, 0 failed |
| T03 web logic | `node --experimental-transform-types --test .\apps\web\test\*.test.mjs` | 15 passed, 0 failed |
| T04 desktop | Loader-based command in UPGRADE-TESTS.md; live-update environment flag removed only in test process | 21 passed, 0 failed, 1 intentionally skipped live GitHub test |
| Electron CLI | Local Electron executable `--version` | 44.8.0; not installed-app acceptance |
| T05 Docker availability | `docker version` | Failed to connect to engine; no images built/run |
| Lua availability | Command lookup for lua5.1, lua, luajit | Unavailable; no Lua tests run |

Total automated test results: **56 passed, 0 failed, 1 intentionally skipped**.
Node emitted experimental loader/transform warnings and desktop module-type warnings;
these did not fail the suites. They are baseline observations, not new regressions.
No dependency restore/frozen install was run: dependencies worked and manifests
were unchanged. Do not reinstall merely to collect baseline evidence.

### Browser smoke check

- Temporary Vite production preview on localhost port 4178 returned HTTP 200.
  Manifest, service worker and both install icons also returned HTTP 200.
- Login screen rendered at widths 390, 768 and 1440 with no horizontal overflow.
- Service worker activated at the preview origin; cache name flocksync-shell-v2.
- Offline reload rendered the login heading; reconnect succeeded.
  **A stylesheet request reported ERR_FAILED during the offline transition.**
  This smoke test is not full styled-offline/PWA acceptance; investigate and
  reproduce before claiming complete offline readiness in a later web wave.
- No API requests were present in that browser's cache, but this unauthenticated
  run did not exercise API traffic: it is not proof of API cache exclusion.
- Authenticated dashboards, home-screen installation, upgrade from an older
  cached shell, and real touch devices were not re-tested here.
- Temporary preview server was stopped. Maintainer's prior mobile testing remains
  a separate report, not automated evidence from this run.

### Isolated backup/restore baseline

The production suite used temporary databases and synthetic accounts. The admin
database fixture created a backup, changed state, restored guild identity/theme
records, exercised restore-upload and protected wipe, and checked stale-sync
rejection. It passed and removed its temporary directory/server.
This repeatable fixture is the offline baseline; it is not an exported production
backup, cross-SQLite-version rollback drill or container-side backup verification.
Watcher tests exercised synthetic rewrite/rename/character-switch saves and helper
output; no actual WoW SavedVariables or desktop configuration was changed.

## Immutable input and release artifact identities

SHA256 values below are identities only, not freshness or release acceptance.

| Input / local release file | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 3C27BCECC956EF5216D8EBC6B14A17291C90969DCFFD58936AE6DF954CC4DE52 |
| release/flocksync-release.json | 729279A05519993C35ABB597D1A8CAF0B50FA47FA3A2ECF0719158B341EE0902 |
| FlockSync_Remote_Server_Deploy.zip | A676D504A7CCC28E1BD434BB8320AD892B6769ACD0A8287B66030177E62BD33C |
| FlockSync-Addon-Bundle.zip | 82891A4A7DAD28A8AF0A399296D6842ACAB04EA41636EA85821BB80FA608EFE5 |
| FlockSync-Raider-Only.zip | 13F0F548DDAE695A1828D5E23C756AE26972B3CC93D73A9BD21B646C4AD4F809 |
| FlockSync-Portable-0.5.1-x64.exe | 648F10C2FF0903D53AEFB012F89CB51A7CDFECFC872F181E6961D0D7B359FDF2 |
| FlockSync-Setup-0.5.1-x64.exe | 11F0EF4DB93A68FD9A190B14D2050339E9B89863DA607EF6440399B8C7F9854E |

The local manifest identifies bundle 0.9.0/server 0.6.0, but inspected deployment
ZIP package manifests contain API/web 0.6.1 plus PWA manifest and DashboardNav.
**The local manifest and server ZIP disagree. Do not publish this set or treat
it as an exact known-good released rollback bundle.** Do not overwrite or rebuild
release downloads during this baseline-only task.
Lockfile and release manifest hashes were unchanged after testing.

## Resume conditions

1. Maintainer makes Docker's Linux engine available. Recheck availability without
   restarting any production deployment.
2. Record actual image digests/runtime versions and architecture support; execute
   isolated T05 baseline builds and startup/proxy/auth/persistence checks.
   Never assume Dockerfile floating tags identify installed image versions.
   Configured bases: node:22-bookworm-slim, nginx:alpine, backup alpine:3.23.
3. Keep the PWA smoke limitation explicit; resolve or deliberately scope it out
   before accepting a web-output migration. Game/Lua acceptance remains deferred
   to its required waves; it does not block unrelated tooling preparation.
4. Review this source rollback checkpoint and evidence, then mark W00 done only
   after the missing applicable checks are accepted. Start W01 only when authorized.

## Continuation - Docker baseline and manifest correction

Completed October 30, 2026 after the maintainer opened Docker Desktop.
This section supersedes the earlier Docker blocker and manifest mismatch;
earlier hashes/results remain the historical pre-correction record.

- Checked the engine **before any other continuation work**: CLI/server 29.9.2,
  Linux x86_64. Builder desktop-linux reports AMD64 and ARM64 capability.
- Authorized local manifest correction: server 0.6.0 -> **0.6.1** only.
  Bundle remains 0.9.0; desktop/addon/helper versions remain unchanged.
  New manifest SHA256:
  `6EFBE66C469790A058175D5A5407C0D24BE09B9D2D67D746BF6D8558F2CEEB8A`.
  This now matches the inspected deployment ZIP's API/web versions.
  Release output is gitignored: this local correction is not a committed source
  change, release preparation or publication. Future packaging regenerates it.
- Built API and web with unchanged Dockerfiles/dependency pins:
  `docker build -f Dockerfile.api -t flocksync-api:w00-baseline .` and
  `docker build -f Dockerfile.web -t flocksync-web:w00-baseline .`.
  Both passed; cached layers were reused where applicable.

| Image identity / runtime | Observed value |
| --- | --- |
| API image ID | sha256:171c9981c9e7cdd74ca34de93df6dac4745f7f02b6becf319799ec00a38a4d0c |
| Web image ID | sha256:5b24f93d87e1a470b88a50e1731b92b838a4244d6749682cfb1e0a1c8c8aef72 |
| Node base digest | sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da |
| nginx base digest | sha256:785835ea65db4bba6f021acc0f3be91b0fef76a53fe41f8588c6698d2aed0606 |
| Built/tested platform | linux/amd64 |
| API Node | 22.23.4 |
| API SQLite CLI / module engine | 3.40.1 / 3.53.2 |
| Web nginx | 1.31.8 |

An isolated harness used a uniquely named network, disposable data/backup volumes
and loopback-only random web port. Synthetic credentials were not printed or saved.
It verified API UID 1000, proxied health, unauthorized roster rejection, login,
member creation, WAL, backup `integrity_check`, restore, restart, and retained user
records. SPA fallback and PWA endpoints returned 200; manifest/service-worker
cache headers were no-cache. All checks passed. Test containers, volumes and
network were removed; baseline images remain available for comparison.

W00 is complete for the current unchanged-runtime, low-risk upgrade preparation.
ARM64 was advertised by the builder but **not built or exercised**; native/runtime
migrations must still pass both architectures. Backup sidecar cron/retention,
full browser/PWA acceptance, Lua and live-game checks remain unverified, not passed.
The earlier offline stylesheet observation remains explicitly scoped out of this
baseline; investigate before accepting changed web output.
No W01 upgrade has begun, and no production services were touched.
