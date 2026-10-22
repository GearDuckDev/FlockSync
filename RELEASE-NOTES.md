## FlockSync 0.7.1

### Gear sync reliability
- Fixed the addon capturing unavailable inventory during logout/reload and replacing valid gear with an empty snapshot. Logout now preserves captured equipment while preparing the character record for WoW's SavedVariables write.
- Equipment changes are captured immediately instead of waiting for the delayed broadcast, so a quick logout does not lose the slot change. Main and alt equipment remains attached to each character's own profile.
- Incomplete item-cache results retain the previous valid gear. Explicit equipment-removal events still remove the affected slot, including the final item. Multiple local changes within one server second are preserved in the saved record.
- WoW itself writes SavedVariables on `/reload` and logout; addons cannot force arbitrary disk writes. The running, signed-in desktop app already watches changed/replaced saves automatically. New integration coverage verifies reload, logout, and character-switch saves upload both characters and write AppHelper without a manual Sync click.
- Includes desktop 0.5.0 from the previous release: explicitly indexed Lua gear tables parse correctly, and missing/malformed lists fail validation rather than silently clearing equipment.
- Genuine equipment removals still replace older gear snapshots. Refreshing the roster does not delete stored equipment, and older or equal-timestamp syncs cannot overwrite newer gear.
- Gear already overwritten by an older desktop sync needs a fresh in-game scan; installing the fix or refreshing the browser alone cannot reconstruct that equipment.

### Release channel and scope
This is a normal **Release-channel** build with no alpha/beta suffix. FlockSync remains **pre-1.0**; this is not a declaration of 1.0 completeness.

The overall release advances from **0.7.0 to 0.7.1**, and the main addon advances from **0.5.0 to 0.5.1** for this fix. Desktop, API/web, shared types, and AppHelper are unchanged. Unchanged components are rebuilt/repackaged for a complete download set and do not need reinstalling if already current.

### Upgrade instructions
1. Exit WoW completely and update **FlockSync to 0.5.1**. Members install `FlockSync-Raider-Only.zip` or update through CurseForge once published. Collectors install `FlockSync-Addon-Bundle.zip`, or update only FlockSync if AppHelper 0.2.2 is already installed. Preserve SavedVariables and avoid an extra nested AddOns directory.
2. Keep desktop **0.5.0**, API/web **0.4.1**, and AppHelper **0.2.2** if already current. No server deployment, migration/reset, or reinstall of unchanged components is required. Desktop versions older than 0.5.0 still need the earlier parser fix: quit completely through the tray, then install `FlockSync-Setup-0.5.0-x64.exe` or use `FlockSync-Portable-0.5.0-x64.exe`. Preserve settings, select the correct WoW folder, and use the full server URL without `/api`.
3. To restore gear previously cleared by an older sync, log in on each affected character and use **Force Scan & Broadcast** in the addon settings. An authorized guild catcher must be online to collect other members' broadcasts. Log out to save the catcher's data, wait for successful desktop sync, then refresh the dashboard.
4. To load server-returned information, use the logout -> desktop sync -> login sequence. Each WoW account folder needs its own sync. Website-linked collection applies only within the authorized guild and realm; unrelated guilds, realms, and guildless characters do not inherit it.
5. If your server is older than 0.4.1, preserve `.env` and `data`, obtain the deployment source, and run `sh deploy/update-server.sh`. It verifies a backup before rebuilding/restarting API/web. Do not bypass the backup guard or use `docker compose down -v`. Check container logs, public login, and sync.
6. For older addon installations, exit WoW before replacing files. Extract directly into `Interface\AddOns`, without an extra ZIP-named directory, and preserve SavedVariables. If upgrading from before 0.4.0-beta, deploy the API before the desktop app for newer sync-field compatibility.

No settings, SavedVariables, or database reset is required. Do not delete saved data to troubleshoot missing equipment.

### Download choices
- **FlockSync-Setup-0.5.0-x64.exe:** Windows installer for officers/admins collecting guild data. Unchanged from 0.7.0; no reinstall needed if current. Includes the previous desktop gear parser fix.
- **FlockSync-Portable-0.5.0-x64.exe:** unchanged portable Windows alternative; choose this or the installer, not both.
- **FlockSync-Raider-Only.zip:** updated main addon **0.5.1** for all guild members, with logout/character-switch gear protection. Regular members do not need AppHelper, desktop, or a server account to share addon data.
- **FlockSync-Addon-Bundle.zip:** updated main addon **0.5.1** plus unchanged AppHelper **0.2.2** for collectors. Collectors additionally need the desktop app and an authorized OFFICER or ADMIN website account.
- **FlockSync_Pi_Deploy.zip:** complete **0.4.1 API/web source**, shared contracts, theme assets, existing database migrations, and Docker deployment tooling. Server behavior/version unchanged; redeployment is not required for this desktop fix.
- **flocksync-release.json:** generated component-version manifest required for update checking alongside the other five downloads.

Publish all six assets on one GitHub release. Collection only happens while a catcher is logged in; it cannot retrieve guild messages sent while offline. Installing AppHelper alone does not grant collection permissions.

### Component versions
- Desktop: **0.5.0 - unchanged**; no reinstall needed if current.
- Server/API/web: **0.4.1 - unchanged**; API/web remain aligned, no redeployment required if current.
- Shared types: **0.4.1 - unchanged**.
- Main addon: **0.5.1 - updated** from 0.5.0; reload/logout and character-switch gear protection.
- AppHelper: **0.2.2 - unchanged**; no reinstall needed if current.
- Root workspace package: **0.2.2 - unchanged**.

### New installations
Members extract the main addon into `Interface\AddOns`, enable it, and complete the walkthrough. Collectors additionally install AppHelper and one desktop download, select the WoW folder containing `Interface` and `WTF`, and connect to their guild's server using an authorized login.

For first-time server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Configure `.env` with unique credentials, prepare a writable backup destination, and keep SQLite on local storage rather than a NAS. The server is guild-hosted, not automatically a shared public service. Background emblems default to **None**, and UI/background colors remain optional.

### Verification and publication status
Local verification covers strict workspace typechecking; addon regression tests using the real character merge for character switches, reload/logout, immediate and same-second equipment changes, unequips, and cache gaps; desktop parser regressions; automatic filesystem-triggered sync and AppHelper writes; and HTTP roster refresh/epoch conflict/unequip checks. All components are rebuilt and the Windows installer/portable app, addon ZIPs, deployment ZIP, and manifest are packaged together.

Local tests do not certify live WoW behavior, installer execution on every Windows system, or server-policy approval. Preparation does not commit, push, tag, upload, or publish anything. Smoke-test the Windows downloads and live sync before wider distribution.

### Publishing and update notices
Publish one GitHub release tagged **v0.7.1**, titled **FlockSync 0.7.1**, with **Set as a pre-release unchecked**. Do not use a literal `-release` suffix. The tag and generated manifest `releaseVersion` must match.

Main addon 0.5.0 can receive a **0.5.1** update notice through synced release metadata. Desktop 0.5.0, server 0.4.1, and AppHelper 0.2.2 should not receive unnecessary update prompts. Older desktops can still discover 0.5.0 on Release, Beta, or Alpha channels. Checkers compare component versions, not the overall tag.

The CurseForge workflow should publish main addon **0.5.1** as **Release** when the GitHub release is published, provided the workflow secret/configuration is ready and that version is not already uploaded. Verify the workflow and CurseForge file before distributing. AppHelper remains a GitHub officer-bundle download.

WoW cannot fetch GitHub directly. Addon notices use synced metadata and appear at initial character login, not repeatedly on reload. Cold metadata caches may need another sync.
