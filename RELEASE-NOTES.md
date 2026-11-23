## FlockSync 1.1.2

### Prevented repeated realm repair notices (main addon)
- Blank-realm guild updates no longer erase a character's already-known realm,
  which could cause the same repair notice to recur.
- New blank-realm records use the existing server-identity fallback only when
  their GUID matches the current server (or the account has an explicit realm
  identity). Other server identities are never guessed.
- Older saved records with blank realms may still be repaired once. No
  SavedVariables reset or Desktop/API change is required.

### Upgrade instructions
1. Exit WoW completely before replacing addon files.
2. Members: install **FlockSync-Raider-Only.zip** into the actual client's
   `Interface\AddOns`, yielding `FlockSync\FlockSync.toc`.
3. Collectors: extract **FlockSync-Addon-Bundle.zip** into the same AddOns
   folder, yielding sibling `FlockSync` and `FlockSync_AppHelper` folders.
   The AppHelper component is unchanged; reinstalling it is not required.
4. Preserve SavedVariables and avoid extra ZIP-named folder nesting.
5. Collectors: log in, log out or exit, let Desktop finish a **successful**
   sync, then log in again to load server-returned data. Repeat for each WoW
   account folder you collect from.
6. Desktop, API/web, shared types and server are unchanged; no Desktop
   reinstall or server update is required.
7. For first installation or recovery, see [DEPLOYMENT.md](./DEPLOYMENT.md).
   Members need only the main addon. Collectors need both addons, Desktop and
   an authorized OFFICER/ADMIN website login.

### Download choices
- **FlockSync-Setup-1.0.1-x64.exe:** Windows collector installer, unchanged
  Desktop **1.0.1**. Choose this or the portable alternative.
- **FlockSync-Portable-1.0.1-x64.exe:** portable Windows collector alternative,
  unchanged Desktop **1.0.1**. Preserve saved server/client settings.
- **FlockSync-Raider-Only.zip:** main addon **1.1.2** for members.
- **FlockSync-Addon-Bundle.zip:** main addon **1.1.2** plus unchanged
  AppHelper **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** unchanged API/web **1.0.1** source
  and deployment tooling for supported Linux Docker servers; not a prebuilt
  image. Existing servers do not need updating.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.1.2** | Updated (patch: bug fix) |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.0.1** | Unchanged; reinstall not required |
| API/web | **1.0.1** | Unchanged; no server update required |
| Shared types | **1.0.1** | Unchanged |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the **Release** channel; not published. When authorized, publish
one GitHub release tagged **v1.1.2**, titled **FlockSync 1.1.2**, with **Set as
a pre-release unchecked** and all six assets. Publishing triggers the
CurseForge workflow to upload main addon **1.1.2** as a **Release** file.
Desktop and server checkers see no component-version change.

### Verification and acceptance
The realm-merge regression and the full addon test suite were run with Lua 5.1;
all addon Lua files passed Lua 5.1 syntax checks. `pnpm run typecheck` and the
release packager completed successfully. The manifest and all release assets
were checked against the selected component versions. The Windows installer
and portable builds are unsigned because no code-signing certificate is
configured. In-game acceptance of the recurring-notice fix remains pending;
verify it with a test character before distribution. Do not treat this local
preparation as a published release or as confirmation of manual testing.

For Forever server identity, `ns.KNOWN_SERVER_REALMS` in
`apps/addon/FlockSync/Ruleset.lua` currently maps `6932` to
`CAMWOW US2 Realm 6 PvP`. Other servers are recognized only from that account's
earlier capture or the exact identity configured with `/fs realm`; do not
guess a realm or merge data across server identities.
### Maintainer / next-agent handoff
Read [RELEASES.md](./RELEASES.md), [DEPLOYMENT.md](./DEPLOYMENT.md),
[README.md](./README.md) and the workspace instructions before release or
deployment work. Inspect branch, status, package/TOC versions, generated
manifest and actual publication state. Never reuse a published tag or infer ZIP
freshness from filenames. Local trackers and operator notes remain ignored, not
release assets.

Build source of truth: committed format-9 lockfile, pnpm **12.16.1**,
TypeScript strict shared contracts, Vite React SPA (not Next.js), Fastify,
parameterized Drizzle and WAL SQLite, Lua **5.1**, Interface **16001**.
Docker API/web builders use Node 22 Bookworm; API builds native SQLite with
Python 3/make/g++, runner UID 1000; web runs nginx; backups use Alpine.
Use host-appropriate commands; editor extensions do not establish runtimes.

Desktop settings/auth live in Electron userData configuration: preserve them,
never dump, commit or package them. Preserve saved client paths. Addons go into
the actual client's `Interface\AddOns`; SavedVariables stay in their account
folder. Logout -> Desktop sync -> login remains the safe helper-loading flow.

No host ports are exposed in production Compose. Cloudflare Tunnel routes to
`http://web:80`; nginx proxies `/api` and `/health` to `api:3001`. Live WAL SQLite
must remain on local persistent storage; configured backup storage is for
backups only. Verify storage availability and permissions before upgrades.
Preserve deployed environment/data; use the guarded updater, not direct restarts.
Keep pre-update snapshots until intentionally removed. Instance runbooks,
host inventories and access details belong only in ignored local notes.
