## FlockSync 0.5.0

### Addon improvements and fixes
- Reduced redundant guild broadcasts: rapid character edits coalesce before transmission, and unchanged event-triggered scans avoid rebroadcasting within a ten-minute window. This is event-driven suppression, not a periodic background heartbeat.
- Guild information arriving late no longer permanently blocks character broadcasts after retries expire. Leaving a guild during retries also clears the pending attempt; later scans can retry. Skipped broadcasts report a chat message.
- Snapshot requests and responses now coordinate better with other officers already transferring data, reducing duplicate guild traffic.
- Unrelated quest turn-ins no longer trigger full attunement scans.
- Profession scans avoid broadcasting unchanged data, remove dropped professions when the client supplies the learned-profession list, and include a Reset button for clearing captured profession data.
- Profession cleanup now advances the export timestamp even when triggered by the profession summary, allowing newer data to replace stale server records.
- Item search refreshes use a bounded recency queue, keeping personal items searchable without accumulating duplicate bookkeeping entries.
- Crafter search and recipe output resolution cache repeated lookups; enchant names take precedence over colliding numeric item IDs when recognized.
- Tooltip annotations avoid duplicate FlockSync lines on repeated refreshes.
- Raid invitations refresh the local guild roster cache and attempt to convert an existing party when more than five places are needed.
- Loot recording ignores roll/crafting messages, preserves two-part player names, and improves duplicate detection for nearby officer observations.
- Removing a registered account character clears references to that character as a main across locally collected records.

### Release channel and scope
This is a normal **Release-channel** publication, with no alpha/beta suffix. FlockSync remains **pre-1.0**: version 0.5.0 does not mean every planned feature is complete or that the software has reached 1.0 maturity.

All component versions were advanced for this publication. New runtime changes are concentrated in the main addon; desktop, API/web, shared types, and AppHelper retain their previous runtime behavior and receive version/channel updates.

Existing website ADMIN/OFFICER same-guild collector support and independent AppHelper update notices remain included.

### Updating the server, desktop app, and addons
1. Preserve the server's existing `.env` and `data` directory. Obtain the new source or extract the Pi deployment package while preserving those files, then run `sh deploy/update-server.sh` from the deployed project directory. It verifies a database backup before rebuilding/restarting. Do not bypass the backup guard or use `docker compose down -v`.
2. Check `docker compose ps` and `docker compose logs --tail 100 api web cloudflared`. For users upgrading from before 0.4.0-beta, deploy the API before the desktop app because newer desktop sync fields require the updated API.
3. Quit the desktop app completely through **Quit FlockSync** in its tray menu. Install `FlockSync-Setup-0.3.1-x64.exe`, or replace your portable executable with `FlockSync-Portable-0.3.1-x64.exe`. Keep existing settings and use the full server URL without an `/api` suffix.
4. Exit WoW before replacing addon files. Members install `FlockSync-Raider-Only.zip`; collectors install `FlockSync-Addon-Bundle.zip`, containing FlockSync 0.5.0 and AppHelper 0.2.2. Extract directly into `Interface\AddOns`, with no extra nested directory. Preserve SavedVariables, settings, and collected data.
5. CurseForge users select main addon **0.5.0**, file type **Release**, when available. CurseForge updates only the main addon; obtain AppHelper 0.2.2 from the GitHub officer bundle.
6. Log in, complete the addon walkthrough if necessary, and `/reload` or log out to save current data. Wait for desktop sync success, then `/reload` to load the helper return data. Refresh the web dashboard to see newly synced records.
7. If enabling website-linked collection for the first time, perform that sync on a character in the intended guild. The returned grant allows low-ranked alts sharing that WoW account's SavedVariables to collect in the same guild and realm. Each WoW account folder needs its own sync; a later sync replaces the guild grant, and a guildless sync clears it.

Users already on the previous beta can keep using its desktop/server/AppHelper runtime for the addon fixes alone, but should install the newly versioned components to move fully onto this Release-channel set. No component version is unchanged in this publication; no settings/database reset is required.

### Download choices
- **FlockSync-Raider-Only.zip:** main WoW addon for all guild members. Regular members do not need the desktop app, AppHelper, or a server account.
- **FlockSync-Addon-Bundle.zip:** the same main addon plus AppHelper for officers/admins collecting guild data.
- **FlockSync-Setup-0.3.1-x64.exe:** Windows desktop installer for collectors.
- **FlockSync-Portable-0.3.1-x64.exe:** portable desktop alternative; choose this or the installer, not both.
- **FlockSync_Pi_Deploy.zip:** API/web source and Docker deployment tooling for server administrators.
- **flocksync-release.json:** generated component-version manifest, required alongside the downloads for update checking.

Publish all six files on one GitHub release. Collectors need the main addon, AppHelper, and desktop app; installing AppHelper alone does not grant website permissions. Collection only occurs while logged in and cannot retrieve guild messages sent while offline.

### Component versions
- Main addon: **0.5.0 - updated** from 0.4.0-beta; addon improvements and fixes.
- AppHelper: **0.2.2 - updated** from 0.2.1-beta; version/channel update only.
- Desktop: **0.3.1 - updated** from 0.3.0-beta; version/channel update only.
- Server/API/web: **0.3.1 - updated** from 0.3.0-beta; version/channel update only, API/web remain aligned.
- Shared types: **0.3.1 - updated** from 0.3.0-beta; bundled contract package, version/channel update only.
- Root workspace package: **0.2.2 - updated** from 0.2.1-beta; workspace metadata only.

### New installations
Extract the appropriate addon ZIP into `Interface\AddOns`, enable the addon(s), and complete the in-game walkthrough. Collectors additionally install the desktop app, select their WoW client folder, configure their server URL, and log in with an ADMIN or OFFICER website account.

For server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Copy `.env.example` to `.env`, configure unique credentials and your Cloudflare tunnel token, and prepare an existing writable backup directory. Keep the live SQLite database on local storage, not the NAS.

### Publishing and update notices
Publish one GitHub release tagged **v0.5.0**, titled **FlockSync 0.5.0**, with **Set as a pre-release unchecked**. Do not use a literal `-release` suffix. The tag and manifest `releaseVersion` must match exactly.

The CurseForge workflow automatically packages and publishes the main addon to project 1756960 as **Release** when this GitHub release is published, provided the tag includes the updated workflow and the repository has its `CF_API_TOKEN` secret configured. Check the workflow result and CurseForge moderation status; publication here is not a claim of server-policy approval. Do not manually re-upload a successful automated upload.

Release-channel updates are eligible for desktop/server users on Release, Beta, or Alpha. Checkers compare each component's own version, not the overall release tag. Stable addon/helper versions ignore future preview builds; preview installations can still discover eligible stable updates.

WoW cannot fetch GitHub directly. Addon notices rely on metadata from desktop sync and, for main-addon notices, guild snapshots. Cold metadata caches may require another sync. Notices appear once at initial character login, not on reloads or zone changes.
