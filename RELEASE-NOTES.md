## FlockSync 1.2.0

### Reliable realm identity on WoW Forever
- Characters now use the numeric server ID in their WoW GUID (for example,
  `Player-6930-...`) instead of a realm name that Forever may report as blank.
  The web dashboard displays this identity as **Server 6930**.
- The addon converts existing character and kill-list SavedVariables to
  server IDs once. The API migrates existing character, guild, and shared
  kill-list data on startup.
- **Connected realms work without configuration.** Guilds are matched by
  guild name, so collectors and members on different server IDs of the same
  connected realm share one guild roster, website collector authorization, and
  kill list. Older kill targets whose realm label spans several servers keep
  that label and match the player name on any server.
- Members on older addons can still send gear and Last Seen updates to updated
  collectors. Collectors must update. Kill-list sharing between old and new
  addon versions is incompatible until everyone updates.

### Desktop keeps AppHelper up to date
- Desktop **1.1.0** automatically installs newer **FlockSync_AppHelper**
  releases from the official GitHub release, following your Desktop update
  channel. It only updates an existing AppHelper folder, waits until World of
  Warcraft is closed, and verifies the download's SHA-256 before installing.
- The previous AppHelper copy is kept in `FlockSync-Updates\backup` beside the
  client's `Interface` folder. SavedVariables are never touched.
- The main **FlockSync** addon is not changed by Desktop; keep updating it
  through CurseForge or the GitHub ZIPs. Linked (symlink/junction) addon
  folders used for development are skipped.

### Upgrade instructions
1. Server operators: back up the existing database and `.env`. Install the
   **FlockSync_Remote_Server_Deploy.zip** source and use the guarded update
   instructions in [DEPLOYMENT.md](./DEPLOYMENT.md). No new `.env` settings
   are required.
2. Members: exit WoW and install the updated **FlockSync** addon from
   **FlockSync-Raider-Only.zip** or CurseForge. Preserve SavedVariables and
   extract the `FlockSync` folder directly into `Interface\AddOns`.
3. Collectors: exit WoW and install both folders from
   **FlockSync-Addon-Bundle.zip**, then install Desktop **1.1.0** with the
   Setup or Portable download. Preserve SavedVariables, Desktop settings,
   and saved client paths. Future AppHelper updates install automatically.
   Collectors need an authorized OFFICER/ADMIN website
   login; regular members do not need the desktop app or a website account.
4. Keep a collector online to receive member broadcasts. For server-returned
   data, log out, wait for a successful Desktop sync, then log in again.
   Repeat the sync for each account folder that needs its data uploaded.
5. After updating, check the website for **Server <id>** labels. Do not reset
   SavedVariables or manually edit the database to force a migration.

### Download choices
- **FlockSync-Raider-Only.zip:** main addon for members; no collector tooling.
- **FlockSync-Addon-Bundle.zip:** main addon plus AppHelper for collectors.
- **FlockSync-Setup-1.1.0-x64.exe:** Windows collector installer; choose this
  or the portable alternative, not both.
- **FlockSync-Portable-1.1.0-x64.exe:** Windows collector alternative.
- **FlockSync_Remote_Server_Deploy.zip:** API/web source and deployment tools
  for server operators; it is not a prebuilt Docker image.
- **flocksync-release.json:** component-version manifest; attach it beside the
  five payloads on the same publicly readable GitHub Release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.2.1** | Updated; includes the connected-realm fix |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.1.0** | Updated; collectors install the new Setup or Portable |
| API/web | **1.1.1** | Updated; deploy server source |
| Shared types | **1.1.0** | Unchanged; reinstall not required |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepare one GitHub release on the normal **Release** channel, tagged
**v1.2.0** and titled **FlockSync 1.2.0**, with **Set as a pre-release**
unchecked and all six assets attached. Stable updates are eligible on Release,
Beta, and Alpha channels; unchanged components (AppHelper and shared types) do
not issue update notices. Publish the main addon ZIP separately on CurseForge
as **1.2.1** (Release), matching its component version.
The combined bundle keeps the overall version at **1.2.0**; the main addon
**1.2.1** and API/web **1.1.1** component versions include patch fixes folded
in before this first publication. No separate v1.2.1 bundle is being prepared.

### Verification and acceptance
Workspace typecheck and the API suites passed (`test:production` 21/21 and
`test:updates` 14/14). Desktop tests passed (39 passed, 1 skipped). Lua 5.1
addon tests passed 20/21; the existing `gearPersistence.lua` scanner-mock
failure remains. The complete release bundle and manifest were built and
verified with `package-release.ps1`. The maintainer reports that the server
update appeared to work; cross-server collection and kill-list behavior have
not yet been confirmed in game. Before wider rollout, verify migration and
connected-realm behavior using the isolated test procedures in
[RELEASES.md](./RELEASES.md#120-connected-realm-and-server-id-migration-candidate-acceptance)
and [Desktop AppHelper auto-update acceptance](./RELEASES.md#desktop-apphelper-auto-update-acceptance).

No client realm-name table or `/fs realm` configuration is required. The
canonical realm is the digits between `Player-` and the next hyphen in a
player GUID.

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
