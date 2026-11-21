## FlockSync 1.1.0

### One Main per account (main addon)
- Your **Main** character is now a single setting shared by every character
  on the same WoW account. Pick a Main on any character and all your other
  characters, including new ones, show that same Main.
- Changing the Main later (for example from char1 to char2) updates every
  character on the account: logging in on char1 or any alt now shows char2.
- Existing setups convert automatically on your next login. If your characters
  had different Mains, FlockSync keeps the Main chosen on the character you log
  in with; otherwise it uses the Main most of your characters already shared.
- If you remove your Main from FlockSync's account character list, the
  character you are logged in on becomes the Main.
- The guild and website see an offline alt's new Main the next time that alt
  logs in.

### Upgrade instructions
1. Exit WoW completely before replacing addon files.
2. Members: install **FlockSync-Raider-Only.zip** directly into the actual
   client's `Interface\AddOns`, yielding
   `FlockSync\FlockSync.toc`.
3. Collectors: extract **FlockSync-Addon-Bundle.zip** into the same AddOns
   folder, yielding sibling `FlockSync` and `FlockSync_AppHelper` folders.
   AppHelper is unchanged; replacing it is harmless but not required.
4. Avoid extra ZIP-named folder nesting and preserve SavedVariables. No reset
   is required; Main choices migrate automatically on login.
5. After logging in, open the Role & Main settings once to confirm the Main
   shown is the one you want for the account.
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
- **FlockSync-Raider-Only.zip:** main addon **1.1.0** for members.
- **FlockSync-Addon-Bundle.zip:** main addon **1.1.0** plus unchanged
  AppHelper **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** unchanged API/web **1.0.1** source and
  deployment tooling for supported Linux Docker servers; not a prebuilt image.
  Existing 1.0.1 servers do not need updating.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.1.0** | Updated (minor: new feature) |
| AppHelper | **1.0.0** | Unchanged; reinstall not required |
| Desktop | **1.0.1** | Unchanged; reinstall not required |
| API/web | **1.0.1** | Unchanged; no server update required |
| Shared types | **1.0.1** | Unchanged |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the **Release** channel. When authorized, publish one GitHub
release tagged **v1.1.0**, titled **FlockSync 1.1.0**, with **Set as a
pre-release unchecked** and all six assets. Publishing that release triggers
the CurseForge workflow, which uploads main addon **1.1.0** as a **Release**
file. Existing stable-channel addon installs (1.0.2) can receive an update
notice. Desktop and server checkers see no change.

### Verification and acceptance
All 20 addon Lua 5.1 regression tests passed, including the new
`accountMain.test.lua`, which fails on 1.0.2 sources and passes on this build.
Every addon Lua file passed a Lua 5.1 syntax check, and the Sumneko Lua
Language Server reported no problems in changed files. The release packager
rebuilt the release assets and manifest. In-game acceptance of the account-wide
Main is pending the maintainer's report.
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
