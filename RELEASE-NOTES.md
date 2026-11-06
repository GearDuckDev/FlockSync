## FlockSync 1.0.1

### Website character links and shared Kill List
- Removes the Character Links management screen from the website. Existing
  character ownership links are retained and continue to determine which
  member groups are visible.
- Lets any signed-in website user add shared Kill List targets, edit their
  reasons, and remove targets. Editing a target's character name is not
  supported.
- Lets any current online guild member add shared targets, edit reasons, and
  remove targets in game. Guild-roster identity checks remain, and authoritative
  snapshot relay remains officer-only.
- Personal Kill List entries remain private. Offline guild members receive
  shared changes through the existing authorized officer/collector sync flow.

### Upgrade instructions
1. Server operators: preserve deployed environment configuration, local SQLite
   data and independent backups. Verify configured backup storage is mounted
   and writable. Stage the new server source without replacing configuration.
2. Run `sh deploy/update-server.sh` from the deployed project directory. Require
   a verified pre-update backup; stop on failure. Do not bypass safeguards with
   direct restarts, `docker compose down -v`, or a database wipe. This change
   requires no data migration; existing character ownership links are preserved.
3. Members using the website: sign in and open Kill List to add a shared target,
   change its reason, or remove it. Any authenticated account can perform these
   actions; character names remain unchanged when editing.
4. With WoW closed, update the main addon for participating clients. Collectors
   install both addons from the bundle. Extract directly into the actual
   client's `Interface\AddOns`, without extra ZIP folder nesting, and preserve
   SavedVariables.
5. Use logout/exit -> successful Desktop sync -> login for server-returned helper
   data. Each account folder needs its own sync. Do not overwrite helper files
   manually while WoW is running.
6. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first installation, recovery and
   server setup. Members do not need Desktop or AppHelper just to use the addon;
   collectors still need Desktop, AppHelper, and an authorized OFFICER/ADMIN
   account for collection and server sync.

### Download choices
- **FlockSync-Setup-1.0.0-x64.exe:** Windows collector installer; Desktop is
  unchanged. Choose this or the portable alternative.
- **FlockSync-Portable-1.0.0-x64.exe:** unchanged portable Windows collector
  alternative. Preserve saved server/client settings.
- **FlockSync-Raider-Only.zip:** main addon **1.0.1** for members.
- **FlockSync-Addon-Bundle.zip:** main addon **1.0.1** plus unchanged AppHelper
  **1.0.0** for collectors.
- **FlockSync_Remote_Server_Deploy.zip:** API/web **1.0.1** source and deployment
  tooling for supported Linux Docker servers; it is not a prebuilt image.
- **flocksync-release.json:** generated component-version manifest. Attach it
  beside the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.0.1** | Updated (patch) |
| API/web | **1.0.1** | Updated (patch); kept aligned |
| Shared types | **1.0.1** | Updated (patch) |
| Desktop | **1.0.0** | Unchanged; reinstall not required |
| AppHelper | **1.0.0** | Unchanged; reinstall not required for this change |
| Root workspace metadata | **1.0.0** | Unchanged |

### Channel and publication
Prepared for the stable **Release** channel. When separately authorized,
publish one release tagged **v1.0.1**, titled **FlockSync 1.0.1**, with the
GitHub prerelease option unchecked and all six assets. Checkers compare each
component's own version. Publish the main addon to CurseForge only through the
established release workflow, using addon version **1.0.1** and Release type.
This preparation does not publish, deploy, or authorize a live update.

### Verification and outstanding acceptance
The API/web changes passed workspace typecheck, API production tests (19/19),
web production build, and web tests (24/24). All 17 addon Lua regression scripts
passed under Lua 5.1. The full release packager rebuilt the release artifacts,
and the manifest, versions, archive contents, and sensitive-file exclusions
were checked.

The following Interface 16001 in-game acceptance remains pending:
1. Use a disposable WoW Forever test profile and test guild, not production
   SavedVariables. Install `release\FlockSync-Addon-Bundle.zip` with WoW closed.
2. With two online guild members, including a non-officer, verify the non-officer
   can add a shared target, change another member's reason, and remove a target.
   Verify online peers receive the changes and that an unauthorized/non-guild
   sender cannot alter the shared list.
3. Test offline catch-up through the existing authorized officer/collector
   relay. Confirm the shared list remains intact after relogging.
4. Remove only the test target, close the disposable client, and restore or
   discard only the disposable test profile. Report client/addon versions,
   each action's result, and any exact in-game error.

Nothing was committed, tagged, pushed, published, or deployed. Do not treat
automated mocks or packaging as proof of in-game behavior. Keep the final
installation/smoke test and separate publication authorization as distribution
gates.

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
