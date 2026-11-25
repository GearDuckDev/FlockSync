## FlockSync 1.1.3

### Automatic desktop refresh and linked-folder watching
- Desktop now syncs each discovered `FlockSync.lua` with the server when it
  launches or after you log in, refreshing the adjacent
  `FlockSync_AppHelper.lua` with the latest server-returned data.
- The watcher now follows linked `SavedVariables` folders, including Windows
  symbolic links used for OneDrive folders. It continues to ignore unrelated
  addon files.
- No addon, API/web, or server changes are required.

### Upgrade instructions
1. Collectors: install **FlockSync-Setup-1.0.2-x64.exe** or use
   **FlockSync-Portable-1.0.2-x64.exe**; choose one. Existing desktop settings
   and saved WoW paths are preserved.
2. The addon and AppHelper are unchanged. Existing installations do not need
   addon replacement, SavedVariables resets, or a server update.
3. For the freshest in-game data, exit WoW, open Desktop, wait for a successful
   sync for each account folder, then log into WoW. This lets WoW load the
   refreshed helper data safely.
4. Desktop must be logged in to sync. If no `FlockSync.lua` export exists yet,
   log in to WoW and `/reload` once to create it; the next Desktop launch can
   sync it.
5. Members need only the main addon. Collectors need both addons, Desktop, and
   an authorized OFFICER/ADMIN website login. For first installation or
   recovery, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Download choices
- **FlockSync-Setup-1.0.2-x64.exe:** Windows collector installer for Desktop
  **1.0.2**. Choose this or the portable alternative.
- **FlockSync-Portable-1.0.2-x64.exe:** portable Windows collector alternative
  for Desktop **1.0.2**. Preserve saved server/client settings.
- **FlockSync-Raider-Only.zip:** unchanged main addon **1.1.2** for members.
- **FlockSync-Addon-Bundle.zip:** unchanged main addon **1.1.2** plus AppHelper
  **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** unchanged API/web **1.0.1** source
  and deployment tooling for supported Linux Docker servers; not a prebuilt
  image. Existing servers do not need updating.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.1.2** | Unchanged; reinstall not required |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.0.2** | Updated (patch: bug fix) |
| API/web | **1.0.1** | Unchanged; no server update required |
| Shared types | **1.0.1** | Unchanged |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the **Release** channel; not published. When authorized, publish
one GitHub release tagged **v1.1.3**, titled **FlockSync 1.1.3**, with **Set as
a pre-release unchecked** and all six assets. Publishing triggers the
CurseForge workflow to skip the unchanged main addon **1.1.2**. Desktop users
on **1.0.1** can update to **1.0.2** from the release manifest. This stable
release is eligible on Release, Beta and Alpha channels; broader channels also
include stable releases.

### Verification and acceptance
The Desktop watcher/configuration tests passed (36 passed, 1 skipped), and
`pnpm run typecheck` completed successfully. The prior 1.0.1 test build was
manually confirmed on both devices for launch-time server refresh and linked
SavedVariables auto-sync. The 1.0.2 installer and portable package are rebuilt
from the same tested code with the patch version incremented; the Windows
builds are unsigned because no code-signing certificate is configured. The
full six-asset release package and its generated manifest have not been
rebuilt. Do not treat this local preparation as a published release.

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
