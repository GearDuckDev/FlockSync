## FlockSync 1.0.2

### Kill List chat spam fix (main addon)
- Fixes repeated **"Wait one minute between kill-list catch-up requests"**
  messages in chat after logging in and while riding past enemy players.
- The addon now reacts only to **your own** guild changes. Guild information
  loading for nearby players (nameplates, targets, mouseover) no longer starts
  Kill List catch-ups, reloads, or roster rebuilds.
- Login starts exactly one automatic Kill List catch-up. Automatic catch-ups
  that hit the one-minute limit are skipped quietly; typing `/fs kill sync`
  twice within a minute still shows the reminder.
- Kill List sighting cooldowns and alerts no longer reset when nearby players'
  guild information loads, so listed enemies alert once per cooldown.
- Less background guild addon traffic: your shared Kill List is no longer
  re-sent to the guild each time an extra event fires.

### Upgrade instructions
1. Exit WoW completely before replacing addon files.
2. Members: install **FlockSync-Raider-Only.zip** directly into the actual
   client's `Interface\AddOns`, yielding
   `FlockSync\FlockSync.toc`.
3. Collectors: extract **FlockSync-Addon-Bundle.zip** into the same AddOns
   folder, yielding sibling `FlockSync` and `FlockSync_AppHelper` folders.
   AppHelper is unchanged; replacing it is harmless but not required.
4. Avoid extra ZIP-named folder nesting and preserve SavedVariables. No data
   migration or reset is required.
5. Desktop, API/web and server are unchanged: do **not** reinstall Desktop or
   run the server updater for this release.
6. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first installation, recovery and
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
- **FlockSync-Raider-Only.zip:** main addon **1.0.2** for members.
- **FlockSync-Addon-Bundle.zip:** main addon **1.0.2** plus unchanged
  AppHelper **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** unchanged API/web **1.0.1** source and
  deployment tooling for supported Linux Docker servers; not a prebuilt image.
  Existing 1.0.1 servers do not need updating.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.0.2** | Updated (patch) |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.0.1** | Unchanged; reinstall not required |
| API/web | **1.0.1** | Unchanged; no server update required |
| Shared types | **1.0.1** | Unchanged |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the **Release** channel. When authorized, publish one GitHub
release tagged **v1.0.2**, titled **FlockSync 1.0.2**, with **Set as a
pre-release unchecked** and all six assets. Publishing that release triggers
the CurseForge workflow, which uploads main addon **1.0.2** as a **Release**
file. Existing stable-channel addon installs (1.0.1) can receive an update
notice. Desktop and server checkers see no change.

### Verification and acceptance
All 19 addon Lua 5.1 regression tests passed, including the new
`killGuildEvents.test.lua`, which fails on 1.0.1 sources (3 catch-up requests
from one login) and passes on this build. Every main addon Lua file passed a
Lua 5.1 syntax check, and the Sumneko Lua Language Server reported no problems
in changed files. The maintainer tested in game and confirmed the login and
nearby-enemy chat spam is fixed. The release packager rebuilt the release
assets and manifest.
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
