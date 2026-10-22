## FlockSync 0.7.0

### Gear sync reliability
- Fixed desktop sync treating equipment saved with explicit Lua indexes as empty gear. These records now retain their items when uploaded and displayed after a web refresh.
- Missing or malformed equipment lists now fail sync validation instead of silently uploading an empty list.
- Genuine equipment removals still replace older gear snapshots. Refreshing the roster does not delete stored equipment, and older or equal-timestamp syncs cannot overwrite newer gear.
- Gear already overwritten by an older desktop sync needs a fresh in-game scan; installing the fix or refreshing the browser alone cannot reconstruct that equipment.

### Release channel and scope
This is a normal **Release-channel** build with no alpha/beta suffix. FlockSync remains **pre-1.0**; this is not a declaration of 1.0 completeness.

Using the requested **minor increment**, the overall release advances from **0.6.1 to 0.7.0**, and desktop advances from **0.4.0 to 0.5.0**. API/web, shared types, and both addons are unchanged. Unchanged components are rebuilt/repackaged for a complete download set and do not need reinstalling if already current.

### Upgrade instructions
1. Quit the desktop app completely using **Quit FlockSync** in its system tray. Install `FlockSync-Setup-0.5.0-x64.exe`, or replace your portable executable with `FlockSync-Portable-0.5.0-x64.exe`. Choose one, not both. Preserve existing settings and configure the full guild server URL without an `/api` suffix.
2. Keep API/web **0.4.1**, main addon **0.5.0**, and AppHelper **0.2.2** if already current. No server deployment, database migration/reset, or addon reinstall is required for this fix.
3. To restore gear previously cleared by an older sync, log in on each affected character and use **Force Scan & Broadcast** in the addon settings. An authorized guild catcher must be online to collect other members' broadcasts. Log out to save the catcher's data, wait for successful desktop sync, then refresh the dashboard.
4. To load server-returned information, use the logout -> desktop sync -> login sequence. Each WoW account folder needs its own sync. Website-linked collection applies only within the authorized guild and realm; unrelated guilds, realms, and guildless characters do not inherit it.
5. If your server is older than 0.4.1, preserve `.env` and `data`, obtain the deployment source, and run `sh deploy/update-server.sh`. It verifies a backup before rebuilding/restarting API/web. Do not bypass the backup guard or use `docker compose down -v`. Check container logs, public login, and sync.
6. For older addon installations, exit WoW before replacing files. Extract directly into `Interface\AddOns`, without an extra ZIP-named directory, and preserve SavedVariables. If upgrading from before 0.4.0-beta, deploy the API before the desktop app for newer sync-field compatibility.

No settings, SavedVariables, or database reset is required. Do not delete saved data to troubleshoot missing equipment.

### Download choices
- **FlockSync-Setup-0.5.0-x64.exe:** updated Windows installer for officers/admins collecting guild data; includes the gear parser fix.
- **FlockSync-Portable-0.5.0-x64.exe:** updated portable Windows alternative with the same fix; choose this or the installer.
- **FlockSync-Raider-Only.zip:** main addon **0.5.0** for all guild members. Unchanged; no reinstall needed if current. Regular members do not need AppHelper, desktop, or a server account to share addon data.
- **FlockSync-Addon-Bundle.zip:** the same main addon plus AppHelper **0.2.2** for collectors. Both unchanged; no reinstall needed if current. Collectors additionally need the desktop app and an authorized OFFICER or ADMIN website account.
- **FlockSync_Pi_Deploy.zip:** complete **0.4.1 API/web source**, shared contracts, theme assets, existing database migrations, and Docker deployment tooling. Server behavior/version unchanged; redeployment is not required for this desktop fix.
- **flocksync-release.json:** generated component-version manifest required for update checking alongside the other five downloads.

Publish all six assets on one GitHub release. Collection only happens while a catcher is logged in; it cannot retrieve guild messages sent while offline. Installing AppHelper alone does not grant collection permissions.

### Component versions
- Desktop: **0.5.0 - updated** from 0.4.0; equipment parsing and invalid-list validation fix.
- Server/API/web: **0.4.1 - unchanged**; API/web remain aligned, no redeployment required if current.
- Shared types: **0.4.1 - unchanged**.
- Main addon: **0.5.0 - unchanged**; no reinstall needed if current.
- AppHelper: **0.2.2 - unchanged**; no reinstall needed if current.
- Root workspace package: **0.2.2 - unchanged**.

### New installations
Members extract the main addon into `Interface\AddOns`, enable it, and complete the walkthrough. Collectors additionally install AppHelper and one desktop download, select the WoW folder containing `Interface` and `WTF`, and connect to their guild's server using an authorized login.

For first-time server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Configure `.env` with unique credentials, prepare a writable backup destination, and keep SQLite on local storage rather than a NAS. The server is guild-hosted, not automatically a shared public service. Background emblems default to **None**, and UI/background colors remain optional.

### Verification and publication status
Local verification covers strict workspace typechecking, parser regressions for positional/indexed/sparse equipment lists, explicit unequips and malformed input, sync watcher/configuration checks, and HTTP roster refresh/epoch conflict/unequip checks. All components are rebuilt and the Windows installer/portable app, addon ZIPs, deployment ZIP, and manifest are packaged together.

Local tests do not certify live WoW behavior, installer execution on every Windows system, or server-policy approval. Preparation does not commit, push, tag, upload, or publish anything. Smoke-test the Windows downloads and live sync before wider distribution.

### Publishing and update notices
Publish one GitHub release tagged **v0.7.0**, titled **FlockSync 0.7.0**, with **Set as a pre-release unchecked**. Do not use a literal `-release` suffix. The tag and generated manifest `releaseVersion` must match.

Desktop 0.4.0 can discover **0.5.0** on Release, Beta, or Alpha channels. Checkers compare each component's own version, not the overall tag: current server/addon/helper installations should not receive unnecessary update prompts.

The CurseForge workflow should **skip** this release's unchanged main addon 0.5.0. Do not manually upload a duplicate. If it was never published successfully, inspect existing CurseForge files before manually publishing main addon 0.5.0 as **Release**. AppHelper remains a GitHub officer-bundle download.

WoW cannot fetch GitHub directly. Addon notices use synced metadata and appear at initial character login, not repeatedly on reload. Cold metadata caches may need another sync.
