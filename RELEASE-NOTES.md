## FlockSync 0.6.0

### Desktop improvements
- Added **Start minimized to system tray**, available in App Settings and the tray menu. It applies on the next launch and defaults off.
- Startup visibility is independent of **Start on Windows boot** and **Minimize to tray on close**. Windows startup no longer unconditionally hides the app; an explicit `--hidden` argument still hides it.
- If the tray icon cannot be created, the window opens even when start-minimized is enabled.
- Updated the desktop window, tray, installer, and portable-app icons using the FlockSync artwork.

### Web dashboard improvements
- Attunements now group linked alts under their main instead of placing each alt in a separate step section. Sections and completion totals count mains, not individual characters.
- Alt lists start **collapsed**. Expand a main to see indented alts with their own completed/total counts, including alts on the same step as their main.
- Missing main progress remains explicitly unknown, rather than being inferred from an alt. Inactive mains can remain as anchors for active alts; task creation still targets the chosen character's actual step.
- Added **Theme Settings** with bundled **Alliance**, **Horde**, and **World of Warcraft** backgrounds, plus custom PNG/JPEG uploads. The example guild image is not bundled.
- The initial theme is **None**, with no background emblem. Administrators can set a server-wide default; each user can save a personal override or choose **Use server default**.
- Backgrounds stay faded behind content and do not intercept clicks. Opacity sliders range from 0% to 40%, with a 12% starting value for a chosen image.
- Theme settings and uploaded images persist with the website account in SQLite and are included in normal database backups. Admin-default changes appear on browser focus or within a minute for users following that default.
- Custom uploads accept PNG/JPEG files up to 5 MB, resize to at most 1024 pixels per side, and must fit the encoded storage limit after conversion. SVG and external image URLs are not accepted.
- Updated the browser favicon using the FlockSync artwork.

### Release channel and scope
This is a normal **Release-channel** publication, with no alpha/beta suffix. FlockSync remains **pre-1.0**: version 0.6.0 does not mean every planned feature is complete or that the software has reached 1.0 maturity.

Desktop, API/web, and shared types are updated. The main addon and AppHelper are unchanged from 0.5.0 and 0.2.2 respectively and are included for complete downloads. Existing addon installations on those versions do not need reinstalling.

### Updating the server, desktop app, and addons
1. Preserve the server's existing `.env` and `data` directory. Obtain the new source or extract `FlockSync_Pi_Deploy.zip` while preserving those files, then run `sh deploy/update-server.sh` from the deployed project directory. It verifies a database backup before rebuilding/restarting. Do not bypass the backup guard or use `docker compose down -v`.
2. Deploy API and web together. The API automatically applies the additive theme-table migration at startup; no database reset is required. Check `docker compose ps` and `docker compose logs --tail 100 api web cloudflared`, then verify public login and sync.
3. Quit the desktop app completely through **Quit FlockSync** in its tray menu. Install `FlockSync-Setup-0.4.0-x64.exe`, or replace your portable executable with `FlockSync-Portable-0.4.0-x64.exe`. Keep existing settings and use the full server URL without an `/api` suffix.
4. To start quietly, enable **Start minimized to system tray** in desktop App Settings or the tray menu, then quit and relaunch. Leave it disabled to open the window normally. Older Windows startup entries containing `--hidden` are rewritten without that argument when the updated app runs.
5. Open **Theme Settings** on the website. Administrators can save a server default; users can save their own theme or return to the default. New installations start with **None**. Attunement alts start collapsed and expand with the chevron beside their main.
6. If already using main addon **0.5.0** and AppHelper **0.2.2**, keep them installed: neither addon changed. For older installations, exit WoW before replacing files. Members install `FlockSync-Raider-Only.zip`; collectors install `FlockSync-Addon-Bundle.zip`. Extract directly into `Interface\AddOns`, without an extra nested directory, and preserve SavedVariables.
7. Log in, complete the addon walkthrough if necessary, and `/reload` or log out to save current data. Wait for desktop sync success, then `/reload` to load helper return data. Refresh the dashboard to check synced records.
8. If upgrading from before 0.4.0-beta, deploy the API before the desktop app because newer sync fields require the updated API. To enable website-linked collection, sync a character in the intended guild and reload after success; each WoW account folder needs its own grant. Same-guild/realm low-ranked alts can collect, but unrelated guilds, realms, and guildless characters do not inherit it.

No settings, SavedVariables, or database reset is required. The new theme tables are added without replacing existing roster or account data.

### Download choices
- **FlockSync-Raider-Only.zip:** main WoW addon 0.5.0 for all guild members. Regular members do not need the desktop app, AppHelper, or a server account. Unchanged from the previous release.
- **FlockSync-Addon-Bundle.zip:** the same main addon plus AppHelper 0.2.2 for officers/admins collecting guild data. Both addons are unchanged.
- **FlockSync-Setup-0.4.0-x64.exe:** updated Windows desktop installer for collectors.
- **FlockSync-Portable-0.4.0-x64.exe:** updated portable desktop alternative; choose this or the installer, not both.
- **FlockSync_Pi_Deploy.zip:** updated API/web source, bundled theme images, database migration, and Docker deployment tooling for server administrators.
- **flocksync-release.json:** generated component-version manifest, required alongside the downloads for update checking.

Publish all six files on one GitHub release. Collectors need the main addon, AppHelper, and desktop app; installing AppHelper alone does not grant website permissions. Collection only occurs while logged in and cannot retrieve guild messages sent while offline.

### Component versions
- Main addon: **0.5.0 - unchanged**; no reinstall needed if already current.
- AppHelper: **0.2.2 - unchanged**; no reinstall needed if already current.
- Desktop: **0.4.0 - updated** from 0.3.1; start-minimized preference and branding.
- Server/API/web: **0.4.0 - updated** from 0.3.1; themes, persistence, attunement presentation, and favicon. API/web remain aligned.
- Shared types: **0.4.0 - updated** from 0.3.1; shared theme validation and contracts.
- Root workspace package: **0.2.2 - unchanged**; no root runtime change.

### New installations
Extract the appropriate addon ZIP into `Interface\AddOns`, enable the addon(s), and complete the in-game walkthrough. Collectors additionally install the desktop app, select their WoW client folder, configure their server URL, and sign in with an ADMIN or OFFICER website account.

For server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Copy `.env.example` to `.env`, configure unique credentials and your Cloudflare tunnel token, and prepare an existing writable backup directory. Keep the live SQLite database on local storage, not the NAS.

### Verification and publication status
Release preparation includes strict monorepo typechecking, API/migration/theme permission and persistence tests, attunement grouping and desktop regressions, and production builds/packages for API, web, desktop, and both addon downloads. Browser/Electron smoke checks cover theme selection, uploads, opacity, personal/default behavior, collapsed alts, and desktop startup/tray behavior. The optional live-GitHub desktop test is not part of the offline verification.

Local validation does not certify live WoW/server behavior or server-policy approval. This release preparation does not commit, tag, upload, or publish anything.

### Publishing and update notices
Publish one GitHub release tagged **v0.6.0**, titled **FlockSync 0.6.0**, with **Set as a pre-release unchecked**. Do not use a literal `-release` suffix. The tag and manifest `releaseVersion` must match exactly.

The CurseForge workflow should **skip uploading** this release's main addon because its version remains 0.5.0, already included in v0.5.0. Do not manually upload a duplicate. If the earlier CurseForge publication failed or was never attempted, inspect the project's files before using the manual workflow to publish the existing main addon 0.5.0 as **Release**. AppHelper remains a GitHub officer-bundle download.

Release-channel updates are eligible for desktop/server users on Release, Beta, or Alpha. Checkers compare each component's own version, not the overall tag: desktop/server 0.3.1 can discover 0.4.0, while main addon 0.5.0 and helper 0.2.2 correctly show no component update. Stable addon/helper versions ignore future preview builds.

WoW cannot fetch GitHub directly. Addon notices rely on metadata from desktop sync and, for main-addon notices, guild snapshots. Cold metadata caches may require another sync. Notices appear once at initial character login, not on reloads or zone changes.
