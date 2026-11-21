## FlockSync 1.1.1

### Kill List and Desktop sync fixed on WoW Forever (main addon)
- **Adding Kill List targets works again.** The Add Target **OK** button no
  longer stays grayed out when the game does not report a realm name.
- **Website Kill List targets show up in game again** after the usual
  logout -> Desktop sync -> login.
- **Desktop sync no longer fails** with `officerCharacter.realm: Too small`,
  `collectorGuild.realm: Too small` or `characters.N.realm: Too small` errors.
- FlockSync now **detects your server automatically**, using the server number
  every character already carries. No one needs to type anything; existing
  characters saved with a blank realm are repaired on login. Gear, timestamps
  and other characters are left untouched.
- The Add Target dialog now explains why OK is disabled (no list selected,
  Kill List turned off, or server not detected) instead of silently graying out.
- Fallback only: if chat ever says **"Realm unavailable"**, an officer can run
  `/fs realm <exact realm shown on the website>` once on that account, then
  `/reload`. The setting cannot be changed afterwards without a data migration.

### Upgrade instructions
1. Exit WoW completely before replacing addon files.
2. Members: install **FlockSync-Raider-Only.zip** directly into the actual
   client's `Interface\AddOns`, yielding
   `FlockSync\FlockSync.toc`.
3. Collectors: extract **FlockSync-Addon-Bundle.zip** into the same AddOns
   folder, yielding sibling `FlockSync` and `FlockSync_AppHelper` folders.
   AppHelper is unchanged; replacing it is harmless but not required.
4. Avoid extra ZIP-named folder nesting and preserve SavedVariables. No reset
   is required; blank realms are repaired automatically on login.
5. Collectors: log in once, then log out or exit, let Desktop finish a
   **successful** sync, and log back in to load the website's Kill List.
   Repeat for each WoW account folder you collect from.
6. Desktop, API/web and server are unchanged: do **not** reinstall Desktop or
   run the server updater for this release.
7. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first installation, recovery and
   server setup. Members do not need Desktop or AppHelper just to use the addon;
   collectors still need Desktop, AppHelper, and an authorized OFFICER/ADMIN
   account for collection and server sync. Continue to use logout/exit ->
   successful Desktop sync -> login for server-returned helper data.

### Download choices
- **FlockSync-Setup-1.0.1-x64.exe:** Windows collector installer, unchanged
  Desktop **1.0.1**. Choose this or the portable alternative; existing 1.0.1
  installs need nothing new.
- **FlockSync-Portable-1.0.1-x64.exe:** portable Windows collector alternative,
  unchanged Desktop **1.0.1**. Preserve saved server/client settings.
- **FlockSync-Raider-Only.zip:** main addon **1.1.1** for members.
- **FlockSync-Addon-Bundle.zip:** main addon **1.1.1** plus unchanged
  AppHelper **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** unchanged API/web **1.0.1** source and
  deployment tooling for supported Linux Docker servers; not a prebuilt image.
  Existing 1.0.1 servers do not need updating.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.1.1** | Updated (patch: bug fix) |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.0.1** | Unchanged; reinstall not required |
| API/web | **1.0.1** | Unchanged; no server update required |
| Shared types | **1.0.1** | Unchanged |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the **Release** channel. When authorized, publish one GitHub
release tagged **v1.1.1**, titled **FlockSync 1.1.1**, with **Set as a
pre-release unchecked** and all six assets. Publishing that release triggers
the CurseForge workflow, which uploads main addon **1.1.1** as a **Release**
file. Existing stable-channel addon installs (1.1.0) can receive an update
notice. Desktop and server checkers see no change.

### Verification and acceptance
All 19 addon Lua 5.1 regression test files passed, including new cases for
automatic server detection, blank-realm repair limited to the same server,
refusing to guess when saved data conflicts, and the Add Target OK button.
Every addon Lua file passed a Lua 5.1 syntax check, and `pnpm run typecheck`
passed. Detection was also checked against a backup of real collector data,
which resolved to the exact website realm. The release packager rebuilt all
assets and the manifest; both addon ZIPs were verified file-by-file against
source. The maintainer confirmed in game that Desktop sync succeeds, website
targets appear and Add Target works after setting the realm. Automatic
detection on a client that never ran `/fs realm` is pending the maintainer's
report.

Server numbers are mapped in `ns.KNOWN_SERVER_REALMS` in
`apps/addon/FlockSync/Ruleset.lua` (currently `6932` ->
`CAMWOW US2 Realm 6 PvP`). Guilds on other Forever servers are detected only
if that account saved a realm earlier; otherwise add the server number there
using the exact website realm, or use the `/fs realm` fallback.
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
