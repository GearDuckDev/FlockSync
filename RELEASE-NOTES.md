## FlockSync 0.4.0-beta

### Guild collection on officer and admin alts
- Website ADMIN and OFFICER accounts can now act as guild data collectors on low-ranked alts, without first logging in on an in-game officer-ranked character.
- A successful desktop sync links collection access to the synced character's guild and realm. Other characters sharing that WoW account's SavedVariables can collect in that same guild, regardless of their in-game rank.
- Characters in unrelated guilds, on other realms, or without a guild do not inherit this website-linked collection access.
- Existing native guild officer detection continues to work. Uploads still require an authorized website account; installing AppHelper alone does not grant website permissions.
- The related guild comes from the synced character, not a new website user-management setting. Each later sync replaces the linked guild; a guildless sync clears the website-linked grant. Each WoW account folder must sync separately.

### Independent AppHelper update notices
- Officers can now see a separate chat notice when their installed FlockSync AppHelper needs an update.
- AppHelper is compared against its own component version, independently of the main addon, desktop app, and overall release tag.
- The notice shows installed and available versions and points to `github.com/GearDuckDev/FlockSync/releases` for the officer bundle.
- The GitHub address is plain chat text, not a clickable external hyperlink.
- Notices appear once at initial character login, not repeatedly during play, reloads, or zone changes. Members without AppHelper receive no helper notice.
- This release adds the checking support; AppHelper itself remains at `0.2.1-beta`, so an existing copy at that version does not need replacing.

### Updating the server, desktop app, and addons
1. **Update the API/web server first.** Preserve your existing `.env` and `data` directory. From the deployed project directory, run `sh deploy/update-server.sh` after obtaining the new source, or apply the updated Pi deployment package while preserving those files. The update script verifies a database backup before rebuilding/restarting. Do not bypass the backup guard or use `docker compose down -v`.
2. Confirm `docker compose ps` shows the API and web healthy, and check `docker compose logs --tail 100 api web cloudflared` for errors. The new desktop sync fields require this updated API; an older API can reject them.
3. Quit the desktop app completely using **Quit FlockSync** in its system tray menu. Install `FlockSync-Setup-0.3.0-beta-x64.exe`, or replace your portable executable with `FlockSync-Portable-0.3.0-beta-x64.exe`. Keep your settings, enter the full server URL without an `/api` suffix, and log in with an ADMIN or OFFICER account.
4. Exit WoW before replacing addon files. Install `FlockSync-Raider-Only.zip`, or `FlockSync-Addon-Bundle.zip` if you need AppHelper. Extract into `Interface\AddOns` without an extra nested folder. Keep existing SavedVariables, settings, and collected data.
5. If updating the main addon through CurseForge, select **FlockSync 0.4.0-beta** when available and allow Beta files. Officers can keep AppHelper `0.2.1-beta`; new officers obtain its folder from the GitHub officer bundle. CurseForge updates only the main addon.
6. To activate website-linked collection, log into a character in the intended guild and complete the addon walkthrough if needed. Use `/reload` or log out so WoW writes the guild information to SavedVariables. Wait for the desktop app to report a successful sync, then `/reload` again to load the server's guild grant.
7. Same-guild, same-realm alts on that WoW account can now collect broadcasts without an officer rank. Keep the desktop app running and logged in for uploads. Collection occurs only while logged in and does not retrieve messages sent while offline.

Older desktop clients can continue syncing against the updated server without receiving the new optional helper metadata. To enable both new features, update the server, desktop app, and main addon together in the order above.

### Download choices
- **FlockSync-Raider-Only.zip:** main WoW addon for all guild members. Regular members do not need the desktop app, AppHelper, or a server account.
- **FlockSync-Addon-Bundle.zip:** the same main addon plus FlockSync AppHelper for officers/admins collecting guild data.
- **FlockSync-Setup-0.3.0-beta-x64.exe:** Windows desktop installer for collectors.
- **FlockSync-Portable-0.3.0-beta-x64.exe:** portable desktop alternative without installation; choose this or the installer, not both.
- **FlockSync_Pi_Deploy.zip:** API/web source and Docker deployment tooling for server administrators.
- **flocksync-release.json:** generated component-version manifest; publish alongside all downloads so update checkers can identify each component correctly.

Officers/admins collecting data need the main addon, AppHelper, and desktop app. All six files belong to this one GitHub release.

### Component versions
- Main addon: **0.4.0-beta - updated** from 0.3.2-beta.
- Desktop: **0.3.0-beta - updated** from 0.2.2-beta.
- Server/API/web: **0.3.0-beta - updated** from 0.2.2-beta; API and web remain aligned.
- Shared types: **0.3.0-beta - updated** from 0.2.1-beta; bundled with the applications, no separate download needed.
- AppHelper: **0.2.1-beta - unchanged**; existing installations at this version do not need reinstalling.
- Root workspace package: **0.2.1-beta - unchanged**; not an end-user application version.

Feature-bearing components receive minor version increments. AppHelper's unchanged version is intentional: independent checking support lives in the main addon, API, and desktop app.

### New installations
Extract the appropriate addon ZIP into `Interface\AddOns`, enable the addon(s), and complete the in-game setup walkthrough.

Collectors additionally install the Windows desktop app, configure their full server URL without an `/api` suffix, select their WoW client folder, and log in with an authorized website account. Follow the activation steps above to link their guild.

For server hosting, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Copy `.env.example` to `.env`, configure unique credentials and your Cloudflare tunnel token, and prepare an existing writable backup directory. Keep the live SQLite database on local storage, not the NAS. Preserve `.env` and `data` during future upgrades.

### Update notices and channels
This is a **Beta** release. Publish the single GitHub release as **v0.4.0-beta** and mark it **pre-release**. Use **Beta** for the CurseForge main addon upload.

Desktop and server users should select the **Beta** update channel to discover these builds. Release accepts stable versions only; Beta accepts beta and stable; Alpha accepts alpha, beta, and stable.

Update checkers compare each component's own version, not the overall tag. Main-addon and AppHelper notices independently follow their installed version's channel: stable installations ignore previews, beta installations accept beta/stable, and alpha installations accept all channels.

WoW cannot query GitHub directly. Release metadata arrives through desktop sync; main-addon metadata can also reach members through guild snapshots. A cold server release cache may require another sync. Fresh metadata may require a subsequent sync and initial character login before a notice appears; `/reload` alone does not trigger the initial-login notice.
