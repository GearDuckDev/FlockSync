## FlockSync 0.6.1

### Web dashboard improvements
- Added custom **UI and background colors** in **Theme Settings**, for both personal themes and administrator-managed server defaults.
- Colors are **linked by default**: one color picker controls the dashboard surfaces and the page behind the background emblem. Enable **Separate UI and background colors** to choose them independently. Disable it again to use the UI color for both.
- Panel, table, and control shades follow the UI color. Neutral text adjusts for light or dark surfaces; action buttons, class colors, and status indicators retain their recognizable colors.
- The live preview shows the page color behind the selected emblem together with a sample panel and control before saving.
- Color choices persist with the website account and follow users across browsers, just like background emblems. Administrator defaults apply only to users without a personal override; **Use server default** removes that override.
- Existing themes retain their original appearance until customized. Changing the emblem preserves color choices, and existing custom-image uploads and opacity settings continue working.
- PNG/JPEG uploads remain limited to 5 MB, resized to at most 1024 pixels per side, and checked against the encoded storage limit. Emblem opacity remains adjustable from 0% to 40%. SVG and external image URLs are not accepted.

### Release channel and scope
This is a normal **Release-channel** build, with no alpha/beta suffix. FlockSync remains **pre-1.0**: version 0.6.1 does not mean every planned feature is complete or that the software has reached 1.0 maturity.

The overall release advances from 0.6.0 to 0.6.1, and API/web and shared types advance from 0.4.0 to 0.4.1, using the requested **0.0.1 increment**. Desktop, main addon, and AppHelper are unchanged and rebuilt/repackaged only to provide complete downloads. Current installations of unchanged components do not need reinstalling.

### Updating the server, desktop app, and addons
1. Preserve the server's existing `.env` and `data` directory. Obtain the new source or extract `FlockSync_Pi_Deploy.zip` while preserving those files, then run `sh deploy/update-server.sh` from the deployed project directory. It verifies a database backup before rebuilding/restarting. Do not bypass the backup guard or use `docker compose down -v`.
2. Deploy **API and web together** at 0.4.1. No new database migration or reset is required for color settings; they use the existing theme storage. Upgrades from before theme support still apply the additive theme-table migration automatically. Check `docker compose ps` and `docker compose logs --tail 100 api web cloudflared`, then verify public login and sync.
3. Open **Theme Settings**. Choose a linked **UI and background color**, or enable **Separate UI and background colors** and select each independently. Check the preview and click **Save theme**. Administrators can also save a server default. Default changes appear on browser focus or within a minute for users following that default.
4. Keep desktop **0.4.0** installed if already current; it does not need reinstalling. For older desktop installations, quit completely through **Quit FlockSync** in the tray, then install `FlockSync-Setup-0.4.0-x64.exe` or replace the portable executable with `FlockSync-Portable-0.4.0-x64.exe`. Preserve settings and use the full server URL without an `/api` suffix.
5. Keep main addon **0.5.0** and AppHelper **0.2.2** installed if already current; neither addon changed. For older installations, exit WoW before replacing files. Members install `FlockSync-Raider-Only.zip`; collectors install `FlockSync-Addon-Bundle.zip`. Extract directly into `Interface\AddOns`, without an extra nested directory, and preserve SavedVariables.
6. After an older addon/desktop upgrade, log in, complete the addon walkthrough if necessary, and `/reload` or log out to save current data. Wait for desktop sync success, then `/reload` to load helper return data. Refresh the dashboard to check synced records.
7. If upgrading from before 0.4.0-beta, deploy the API before the desktop app because newer sync fields require the updated API. To enable website-linked collection, sync a character in the intended guild and reload after success; each WoW account folder needs its own grant. Same-guild/realm low-ranked alts can collect, but unrelated guilds, realms, and guildless characters do not inherit it.

No settings, SavedVariables, or database reset is required. Color settings are included in normal database backups with existing theme/account data.

### Download choices
- **FlockSync-Raider-Only.zip:** main WoW addon **0.5.0** for all guild members. Regular members do not need the desktop app, AppHelper, or a server account. Unchanged; no reinstall needed if current.
- **FlockSync-Addon-Bundle.zip:** the same main addon plus AppHelper **0.2.2** for officers/admins collecting guild data. Both addons are unchanged.
- **FlockSync-Setup-0.4.0-x64.exe:** Windows desktop installer for collectors. Desktop behavior/version are unchanged.
- **FlockSync-Portable-0.4.0-x64.exe:** portable desktop alternative; choose this or the installer, not both. Unchanged version.
- **FlockSync_Pi_Deploy.zip:** updated **0.4.1 API/web source**, shared theme contracts, bundled theme images, existing database migrations, and Docker deployment tooling for server administrators.
- **flocksync-release.json:** generated component-version manifest, required alongside the downloads for update checking.

Publish all six files on one GitHub release. Collectors need the main addon, AppHelper, and desktop app; installing AppHelper alone does not grant website permissions. Collection only occurs while logged in and cannot retrieve guild messages sent while offline.

### Component versions
- Main addon: **0.5.0 - unchanged**; no reinstall needed if already current.
- AppHelper: **0.2.2 - unchanged**; no reinstall needed if already current.
- Desktop: **0.4.0 - unchanged**; rebuilt for the complete download set, no reinstall needed if current.
- Server/API/web: **0.4.1 - updated** from 0.4.0; custom linked/independent UI and background colors. API/web remain aligned.
- Shared types: **0.4.1 - updated** from 0.4.0; backward-compatible color fields and hex-color validation.
- Root workspace package: **0.2.2 - unchanged**; no root runtime change.

### New installations
Extract the appropriate addon ZIP into `Interface\AddOns`, enable the addon(s), and complete the in-game walkthrough. Collectors additionally install the desktop app, select their WoW client folder, configure their server URL, and sign in with an ADMIN or OFFICER website account.

For server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Copy `.env.example` to `.env`, configure unique credentials and your Cloudflare tunnel token, and prepare an existing writable backup directory. Keep the live SQLite database on local storage, not the NAS. New dashboard themes start with no emblem and the original dark palette; custom colors are optional.

### Verification and publication status
Local release preparation covers strict monorepo typechecking, theme color/validation tests, API theme permissions and persistence across restart, attunement regressions, browser checks for linked/independent colors and preview rendering, and production builds/packages for API, web, desktop, and both addon downloads.

Local validation does not certify live WoW/server behavior or server-policy approval. This release preparation does not commit, tag, upload, or publish anything. Validate the generated manifest and all six packaged artifacts before publication, then smoke-test the deployed server and desktop installers in their target environments.

### Publishing and update notices
Publish one GitHub release tagged **v0.6.1**, titled **FlockSync 0.6.1**, with **Set as a pre-release unchecked**. Do not use a literal `-release` suffix. The tag and manifest `releaseVersion` must match exactly.

The CurseForge workflow should **skip uploading** this release's main addon because its version remains 0.5.0. Do not manually upload a duplicate. If an earlier CurseForge publication failed or was never attempted, inspect the project's files before using the manual workflow to publish the existing main addon 0.5.0 as **Release**. AppHelper remains a GitHub officer-bundle download.

Release-channel updates are eligible for users on Release, Beta, or Alpha. Checkers compare each component's own version, not the overall tag: server 0.4.0 can discover 0.4.1, while desktop 0.4.0, main addon 0.5.0, and helper 0.2.2 correctly show no new component update. Stable addon/helper versions ignore future preview builds.

WoW cannot fetch GitHub directly. Addon notices rely on metadata from desktop sync and, for main-addon notices, guild snapshots. Cold metadata caches may require another sync. Notices appear once at initial character login, not on reloads or zone changes.
