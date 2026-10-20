# Publishing FlockSync releases

FlockSync has three independently released components. Use component-specific
Git tags so an addon update never looks like a desktop or server update.
Creating a commit or pushing a tag alone does **not** publish an update: create
a GitHub Release for the tag and upload the matching artifacts too.

## Current beta release

| Component | Version | GitHub tag |
| --- | --- | --- |
| Desktop | `0.2.0-beta` | `desktop-v0.2.0-beta` |
| Web + API / server | `0.2.0-beta` | `server-v0.2.0-beta` |
| Main addon | `0.3.0-beta` | `addon-v0.3.0-beta` |
| AppHelper (included in officer bundle) | `0.2.0-beta` | Uses the main addon release |

Root/shared-types packages are `0.2.0-beta`. Mark all three GitHub releases as
**prereleases**, and the CurseForge addon upload as **Beta**. Users must select
Beta or Alpha to receive desktop/server beta update notices.

## Tags and channels

| Component | Tag format | Example |
| --- | --- | --- |
| Windows desktop app | `desktop-v<version>` | `desktop-v0.2.0-alpha.1` |
| Web dashboard + API/Docker deployment | `server-v<version>` | `server-v0.2.0-beta.1` |
| In-game addons | `addon-v<version>` | `addon-v0.3.0-alpha.1` |

Supported versions are `MAJOR.MINOR.PATCH`, optionally followed by `-alpha`,
`-alpha.N`, `-beta`, or `-beta.N`. Use numeric preview counters for successive
preview builds. Examples: `0.3.0-alpha.1`, `0.3.0-alpha.2`, `0.3.0-beta.1`,
then `0.3.0`. Do not reuse or move a published tag.

| Selected update channel | Eligible versions | GitHub release setting |
| --- | --- | --- |
| Release (default) | Stable only | Stable tags: **not** a prerelease |
| Beta | Beta and stable | Beta tags: check **Set as a pre-release** |
| Alpha | Alpha, beta, and stable | Alpha tags: check **Set as a pre-release** |

Checks choose the highest eligible version, not the most recently uploaded
release. Switching to Release does not downgrade an installed preview.
Draft releases are ignored. Preview suffixes and GitHub's prerelease checkbox
must agree. Old unprefixed tags such as `v0.2.0-alpha` are ignored by the new
component-aware checkers.

**Hosting requirement:** release metadata must be readable without a GitHub
token. The default repository is `GearDuckDev/FlockSync`. Private repositories
cannot be read by these checkers, even if users are logged into GitHub in their
browser. A public releases-only repository is an alternative; configure the
desktop's `githubRepo` in its user-data `config.json` and the API's
`GITHUB_REPOSITORY` environment variable to point to it. Do not distribute an
embedded personal access token.

## 1. Prepare the versions and changelog

- Fix: increment the patch number (`0.3.0` -> `0.3.1`).
- Feature: increment the minor number (`0.3.0` -> `0.4.0`).
- Keep alpha/beta suffixes while the software is still in testing.
- Reserve `1.0.0` for the first release ready for general use. After that, use
  appropriate semantic version increments, including major releases for
  incompatible changes.
- Desktop: update `version` in `apps/desktop/package.json`.
- Server: align `version` in `apps/api/package.json` and `apps/web/package.json`
  for the server release; the API reports the running server version.
- Addons: update `## Version` in each affected addon's `.toc`. Use the main
  `FlockSync.toc` version for the `addon-v...` tag. If the helper also changed,
  update its TOC too; unchanged helpers can retain their previous version.
- Keep any other affected version references consistent. Do not bump unrelated
  components just to match a repository tag.
- Write user-facing release notes: changes, installation steps, compatibility
  requirements, and any migration or backup instructions. These notes should
  also make sense as a CurseForge changelog.

## 2. Validate and build only what you are releasing

Run the relevant tests, then from the repository root in PowerShell:

```powershell
pnpm run typecheck
```

### Desktop

```powershell
pnpm --filter @flocksync/desktop package:win
```

Upload from `apps\desktop\release`:

- `FlockSync-Setup-<version>-x64.exe`
- `FlockSync-Portable-<version>-x64.exe`

Keep these names unchanged. A desktop release is only eligible for an update
notice if at least one matching installer/portable filename is attached.
Check the version inside the app and test the packaged executables.
The app displays an update banner; downloading and installation remain manual.
Old desktop builds using `/releases/latest` do not understand this tagging
system: distribute this channel-aware build manually for the initial upgrade.

### Server (web + API/Docker)

```powershell
pnpm --filter @flocksync/api build
pnpm --filter @flocksync/web build
.\scripts\package-pi-deploy.ps1
docker compose --env-file .env.production build api web
```

The Docker build requires a running Docker engine. Upload
`release\FlockSync_Pi_Deploy.zip`. This is a deployment source package, **not**
a prebuilt container image. The current Compose setup builds locally; there
are no registry images to pull for the API/web services.

Preserve production configuration and data, select/extract the updated source
on the server, and deploy with the guarded update command:

```sh
sh deploy/update-server.sh
docker compose --env-file .env.production logs --tail 100 api web
```

The script automatically creates and verifies a uniquely named pre-update
SQLite backup at the configured `NAS_BACKUP_PATH` before building/restarting
API/web containers. It aborts if backup fails. The destination must be configured,
already exist, and be writable; mount the NAS first if applicable. These
rollback snapshots are retained until manually removed. Direct Docker commands
bypass this safeguard. Keep a separate secure backup of production configuration.

Do not overwrite the server's real environment file or data directory with
example configuration. Do not use `docker compose down -v` as an update step.
Check health, login, and sync after deploying. See [DEPLOYMENT.md](./DEPLOYMENT.md)
for production setup and backup details.

### Addons

```powershell
.\scripts\package-addons.ps1
```

Upload:

| Artifact | Audience |
| --- | --- |
| `release\FlockSync-Raider-Only.zip` | Guild members; main addon only |
| `release\FlockSync-Addon-Bundle.zip` | Officers; main addon and AppHelper |

Inspect both ZIPs for the expected top-level addon folders and updated TOCs.
Test in WoW. Publish the member addon to CurseForge too, selecting its matching
Alpha, Beta, or Release type. **GitHub publication does not upload to CurseForge.**
Do not nest the addon in an extra directory when uploading.

## 3. Commit, tag, and create the GitHub Release

Review `git status` and your diff first. Stage only the intended source,
documentation, and version changes; build output stays gitignored and is
uploaded as release assets. Do not include secrets, database files, personal
SavedVariables, or machine-local configuration.

Example for an addon alpha release (replace the version with its actual TOC):

```powershell
git add <explicit-paths-to-reviewed-changes>
git commit
git push origin HEAD
git tag -a addon-v0.3.0-alpha.1 -m "FlockSync addon 0.3.0-alpha.1"
git push origin addon-v0.3.0-alpha.1
```

Use `desktop-v...` or `server-v...` instead when publishing those components.
If one commit updates several components, create a separate tag and GitHub
Release for each component being shipped.

On GitHub:

1. Open **Releases -> Draft a new release**.
2. Select the exact tag you pushed.
3. Use a descriptive title such as **FlockSync Addon 0.3.0-alpha.1**.
4. Paste the user-facing changelog and setup/migration instructions.
5. Upload the fresh artifacts for **that component**, not stale output from
   an earlier build. Do not attach desktop binaries to an addon-only release.
6. Check **Set as a pre-release** for alpha/beta; leave it unchecked for stable.
7. Publish the release (do not leave it as a draft).
8. Confirm the release and downloads are readable without authentication and
   use **Check for Updates** on the intended channel to verify detection.

## What users see

- **Desktop:** choose Release, Beta, or Alpha in App Settings. Scheduled checks
  run 15 seconds after startup and every six hours. Manual checks bypass
  Remind Me Later; automatic checks remain muted until the next app launch.
- **Web:** every signed-in user sees a compact amber banner at the top-right when
  a newer eligible server release exists. It checks on dashboard load and every
  six hours, without interrupting the user. Administrators can select the channel
  and check manually in Admin Settings; the preference is per browser and also
  applies to the banner. The notice links to the server release; installation
  uses the guarded update script above, not an automatic container restart.
- **Addon:** no direct web requests are possible inside WoW. The API obtains
  addon release metadata, the desktop delivers it through AppHelper during a
  sync, and guild snapshots relay compact versions to members. Metadata may
  take a subsequent sync to arrive while the server refreshes its cache.
  Metadata received during play is saved for a later login, not announced.
  At initial character login, the addon checks the saved catalog once and
  prints at most one chat notice. UI reloads and zone transitions do not check.
  Stable installs only see stable updates; beta installs can see beta/stable;
  alpha installs can see all three. Users manage preview downloads in
  CurseForge, not through an in-game channel selector. Offline guilds or guilds
  without a recently synced officer may have stale or no release information.
