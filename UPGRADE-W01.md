# W01 - Low-risk tooling upgrade evidence

Completed October 30, 2026. Scope: [W01](./UPGRADE-PLAN.md), using
[W00 baseline](./UPGRADE-BASELINE.md) and [test recipes](./UPGRADE-TESTS.md).
Status: `done` for implementation and offline checks; **not release approval**.

## Changes and invariants

| Item | Before | After |
| --- | --- | --- |
| Web/desktop Vite | 8.3.4, range ^8.3.4 | 8.3.5, range ^8.3.5 |
| Root packageManager and lockfile pin | pnpm 12.11.2 | pnpm 12.16.1 |
| Both Dockerfile pnpm installs | 12.11.2 | 12.16.1 |
| API @types/bcryptjs | 2.4.6 | Removed; bcryptjs 3.0.3 supplies declarations |

- Registry latest tags were rechecked: Vite 8.3.5 and pnpm 12.16.1.
  GitHub's later pnpm release was not substituted for the registry stable target.
- Reviewed [Vite notes](https://github.com/vitejs/vite/releases/tag/v8.3.5),
  [pnpm notes](https://github.com/pnpm/pnpm/releases/tag/v12.16.1)
  and the earlier cumulative audit. Vite engines support current host/container Node.
- pnpm automatically selected/downloaded the project-pinned 12.16.1 binary.
  No new global installation method or host Node/npm/Git update was used.
  Outside this workspace the existing pnpm launcher may still select another version.
- **deploy --legacy remains.** No dependency-injection or workspace-policy changes.
  Frozen installs and supply-chain checks passed without bypass flags.
- Lockfile review showed pnpm pin/integrities, Vite peer-context changes and
  redundant bcrypt-types removal; no unrelated runtime upgrades.
- The same seven deprecated transitive dependencies remain. Parent migrations
  belong to later waves, not unsupported overrides.
- No addon, shared schema, watcher, Electron, database engine or API behavior edits.
  No component/bundle version bumps; API/web stay 0.6.1 and bundle stays 0.9.0.
  The local manifest's server 0.6.1 correction from W00 remains intact.

## Verification sequence

1. Removed only bcrypt types, installed with pnpm 12.11.2, then passed API
   typecheck and all six production tests, including registration/login/role guards.
2. Changed only Vite, installed, then passed workspace typecheck and build before
   changing pnpm. This separates package migration failures from manager failures.
3. Updated pnpm pins, confirmed `pnpm --version` = 12.16.1, ran install followed
   by `pnpm install --frozen-lockfile`; both passed.
4. With final sources/pnpm, repeated workspace typecheck/build and regressions:

| Check | Result |
| --- | --- |
| pnpm run typecheck | All four packages passed |
| pnpm run build | Shared/API/web/desktop passed |
| API test:production | 6 passed |
| API test:updates | 14 passed |
| Web node test suite | 15 passed |
| Offline desktop loader-based suite | 21 passed; 1 live-GitHub test intentionally skipped |
| Dockerfile.api build | Passed on linux/amd64, pnpm 12.16.1 with legacy deploy |
| Dockerfile.web build | Passed on linux/amd64, Vite 8.3.5 / pnpm 12.16.1 |
| Desktop package:win | Installer and portable x64 artifacts built successfully |
| Remote-server packager | ZIP rebuilt; selected archived inputs hash-match final sources |

Final automated regression total: **56 passed, 0 failed, 1 intentionally skipped**.
Baseline Node experimental loader/module warnings remain; Docker legacy-deploy
warning is expected. Neither was hidden or treated as a reason to bypass policy.

## Isolated container/browser acceptance

- Used synthetic credentials/character, unique network and disposable data/backup
  volumes. Bound web only to a random loopback port; no deployed configuration used.
- Verified API UID 1000, nginx health/API/SPA routing, unauthorized rejection,
  login, fixture sync, SQLite WAL, backup integrity, restore and restart persistence.
- Compared every served static file hash between W00 and W01 web images:
  **zero byte differences**, despite rebuilding with the updated tools.
- Compared deployed production dependency directories: no new/changed runtime
  packages; old-only directories were @types/better-sqlite3 7.6.13,
  @types/node 22.20.5 and undici-types 6.21.0. The new deploy output omits these
  declaration-only directories; no declaration-only packages were forced into runtime.
- Browser login and synthetic roster rendered without horizontal overflow at
  widths 390, 768 and 1440. Visited all dashboard sections on desktop.
- Saved separate UI/background colors, reloaded and verified persisted values.
  Exercised mobile section picker and opening the gear drawer.
- Simulated touch-pointer events opened the item preview with mocked Wowhead data.
  This is not a real-device or live-Wowhead acceptance test.
- Actual authenticated API traffic was exercised; browser cache inspection found
  zero API entries. Worker controlled the page.
- After controlled reload and stylesheet warm-up, offline login reload retained
  the online background and 51 CSS rules; reconnect succeeded. This did not
  reproduce W00's transient stylesheet failure. It does not prove first-visit
  offline behavior or upgrade from an older cached shell.
- Automation initially hit hidden duplicate responsive elements, a transient save
  status assertion and pointer-event sequencing issues. Corrected selectors,
  persisted-value assertions and dispatched events completed the checks; these
  are not claims of successful physical touch/installer interaction.
- All temporary test containers, volumes and network were removed.

## Artifacts and rollback identity

Source base: `40a920646151129a425b8b59c862a0dab9abb570`, with W01 changes still
uncommitted on Dependency-Upgrade-Before-Launch. SHA256 identities:

| File | SHA256 |
| --- | --- |
| pnpm-lock.yaml | F4F25973D0173A6548D5A7CEF24EA6EC9539CCB740D55FCAA902E3DE25D4E0D8 |
| release/FlockSync_Remote_Server_Deploy.zip | 63730974A335A74ACF66BEC224B3AFB68B36B93520517B6D679F26CC8CDA7258 |
| apps/desktop/release/FlockSync-Setup-0.5.1-x64.exe | 17069B9070577C4E3CB38B7FB747E57572828229D12D26B3472424FBE0F07AA1 |
| apps/desktop/release/FlockSync-Portable-0.5.1-x64.exe | 11CC135BD9CC84FF92B6CBD7C78527BCFEA39D4F58745055D7EEC5871699A6D2 |

The desktop ASAR contains the expected main/preload/renderer/package files and
no matched local config/database files. Packaged main SHA256 matches W00 exactly:
`B354E1D1C454EECA5CA02D42B73A01798592D27EBE74C7888ABD915A860200C0`.
Server ZIP excludes dependency/build/git folders, real environment files and DBs.

| Retained comparison image | Image ID |
| --- | --- |
| flocksync-api:w01-tooling | sha256:48d8b80d1ab5ae4156ea466494a933a76b29f4593e51cec46a6e8fa75e5a2f1f |
| flocksync-web:w01-tooling | sha256:6f5642420d375cf93da39ab59d2a88251df81408c5cb1a78dabb6dd801261cf6 |

W00 comparison images remain. Node/nginx base digests are unchanged from W00.
W01 desktop test candidates are **only in apps/desktop/release**; root release
desktop downloads retain their W00 hashes. Do not copy/distribute candidates over
the known-good downloads before T06. No full release packager was run.
The refreshed server ZIP is a local test artifact, not a published release.

Rollback: restore only W01 manifest/pin/lockfile changes from the reviewed W00
checkpoint, preserve other work/planning documents, reinstall with the prior pin,
rebuild affected outputs and rerun checks. No database migration was introduced.

## Remaining gates and next step

- **W02 has not started.** It is the next tooling/web wave, followed by the
  mandatory pre-launch stop; do not jump to broader migrations.
- No ARM64 build/run, backup-sidecar scheduling/retention test, physical-device
  PWA installation, old-shell update acceptance or real in-game check was performed.
- Desktop installer/portable packaging and ASAR checks passed, but interactive
  installation, tray/startup and actual collector workflow were not accepted.
  Hold distribution for the required maintainer/game checks.
- Optional host-tool updates remain unapproved/not performed.
- No commits, tags, pushes, publication, CurseForge uploads or production changes.

## Maintainer checklist

Manual status: **pending**. Automated verification above need not be repeated.
The earlier localhost container URL is stopped and must not be used.
On October 30 the maintainer reported "Seems to work" and authorized W02.
Record this as general acceptance feedback only: the exact checks performed
were not specified, and desktop distribution/game acceptance remains pending.

### Can test now: production web shell, no server deployment

1. In PowerShell from the repository root, run:
   `pnpm --filter @flocksync/web exec vite preview --host 127.0.0.1 --port 4178 --strictPort`.
   Keep that terminal open and visit http://127.0.0.1:4178.
   If the port is occupied, do not stop an unknown process; choose another port.
2. At normal desktop width and narrow phone width, verify the login screen is
   styled, readable and fits without horizontal scrolling. Browser zoom should
   remain 100%; use responsive device mode for the narrow-width check.
3. This standalone preview has no API backend. **Do not use production credentials
   or expect login to work.** Authenticated sections/themes were tested by the
   agent using a disposable API; request a fresh isolated fixture for manual
   authenticated checks rather than deploying to production just to test.
4. Reload once online after service-worker activation. In browser developer tools,
   enable network Offline and reload: expect the previously cached, styled login
   shell. Restore Online and reload: expect normal loading. This does not test
   offline guild data or first-visit offline availability.
5. Press Ctrl+C in the preview terminal. Restore the browser's network setting
   to Online. Optionally remove this localhost origin's service worker/cache in
   browser developer tools; do not clear unrelated site data.
6. Report pass/fail for desktop layout, phone layout and cached offline styling;
   include the failing action and screenshot/console error if applicable.
   Do not include passwords, tokens or personal player data.

### Desktop checks: only in an isolated Windows profile

1. Do not replace the currently working collector. Use a separate Windows test
   user or an available Windows Sandbox so candidate settings cannot touch real
   Electron userData or WoW paths. If isolation is unavailable, defer this check.
2. Candidate portable executable:
   `apps\desktop\release\FlockSync-Portable-0.5.1-x64.exe`.
   Launch only one collector at a time; confirm window/login UI renders, minimize
   to tray, restore from tray, then quit from tray and confirm it exits.
3. For installer acceptance, use
   `apps\desktop\release\FlockSync-Setup-0.5.1-x64.exe` in that same isolated test
   environment. Install, launch, repeat the UI/tray check, quit and uninstall.
   Do not enable start-at-login in the real Windows profile.
4. Do not connect this candidate to production or point it at real SavedVariables.
   Login/sync/startup-setting checks needing an API must use a fresh isolated
   fixture. Never treat a packaged build or tray check as collector acceptance.
5. Report which candidate was used and pass/fail for launch, tray restore, quit
   and installation/uninstallation. Remove only the test installation/profile
   resources you deliberately created; retain the working collector.

### Wait for the working game

Before distributing a rebuilt desktop candidate, complete T06 in
[UPGRADE-TESTS.md](./UPGRADE-TESTS.md): real game saves -> desktop sync -> website,
logout -> sync -> login helper loading, guild collection/authorization and Lua
errors. No addon reinstall is required for W01: addon code was unchanged.
Game checks remain blocked until the game/test characters are available.
