# Publishing FlockSync: one release, all downloads

Publish **one GitHub Release** with all artifacts and `flocksync-release.json`.
The overall Git tag identifies the bundle; the manifest identifies the version
of each component. Desktop, server, and addon update checks compare their own
installed version with their own manifest entry, never with the bundle tag.

## Current beta

| Item | Version |
| --- | --- |
| Combined GitHub tag | `v0.4.0-beta` |
| Desktop | `0.3.0-beta` |
| API + web / server | `0.3.0-beta` |
| Main addon | `0.4.0-beta` |
| AppHelper | `0.2.1-beta` |
| Shared types | `0.3.0-beta` |
| Root package | `0.2.1-beta` |

### Changes in this beta

- Website ADMIN/OFFICER accounts can collect guild broadcasts on same-guild,
  same-realm alts without first logging in on a native officer-ranked character.
- AppHelper has an independent login update notice using its own component
  version and channel, pointing officers to the GitHub officer bundle.
- Deploy the API first, then update desktop and the main addon. AppHelper's
  own code/version is unchanged. See [RELEASE-NOTES.md](./RELEASE-NOTES.md) for
  copy-ready release notes and activation instructions.

## Each time you release

1. Update **only changed components' versions**. A bug fix increments the patch
   (`0.2.1-beta` -> `0.2.2-beta`); a feature increments the minor
   (`0.2.1-beta` -> `0.3.0-beta`). Keep API and web versions aligned. Update the
   TOC of each affected addon. Reserve `1.0.0` for general availability.
2. Choose a new overall release version. Normally increment the previous
   bundle tag's patch for fixes or minor for features. It does not need to equal
   every component version. Never reuse a published tag.
3. Run the relevant tests. Build/package everything with one PowerShell command
   from the repo root (replace the version for future releases):

   ```powershell
   .\scripts\package-release.ps1 -ReleaseVersion 0.4.0-beta
   ```

   This typechecks, builds API/web, packages desktop/addons/server, copies the
   executables to the output folder, and generates the manifest from actual
   package/TOC versions. It stops on failure and removes an old manifest first,
   so a failed build cannot leave a publish-ready old manifest.
4. Review `git status` and the diff, stage intended source/docs/version changes,
   and commit with a user-facing changelog. Build output remains gitignored.
5. Push the commit and create **one** tag:

   ```powershell
   git push origin main
   git tag -a v0.4.0-beta -m "FlockSync 0.4.0-beta"
   git push origin v0.4.0-beta
   ```

6. On GitHub, open **Releases -> Draft a new release**:
   - Tag: `v0.4.0-beta`.
   - Title: `FlockSync 0.4.0-beta`.
   - Paste the combined changelog, download choices, and upgrade instructions.
   - Check **Set as a pre-release** for alpha/beta builds.
   - Attach the six files below. Publish only after all uploads finish.
7. Publish the member addon ZIP to CurseForge separately, using the main addon
   version and matching **Alpha**, **Beta**, or **Release** type. A GitHub
   release does not upload anything to CurseForge.
8. Verify downloads and manual checks using the intended channel. Smoke-test
   the installer/portable app and in-game addon before distributing widely.

## Upload these six files from `release`

| File | Audience |
| --- | --- |
| `flocksync-release.json` | Required component version manifest; every release |
| `FlockSync-Setup-0.3.0-beta-x64.exe` | Windows installer |
| `FlockSync-Portable-0.3.0-beta-x64.exe` | Windows portable app |
| `FlockSync_Pi_Deploy.zip` | Web/API Docker deployment source |
| `FlockSync-Raider-Only.zip` | Main addon for guild members |
| `FlockSync-Addon-Bundle.zip` | Main addon + AppHelper for officers |

Executable filenames change with the desktop version. The packaging script
prints the exact list for each release. Do not upload old matching-pattern
files just because they remain in the output folder. Do not rename the files
without updating the manifest/packager. Never upload real environment files,
databases, SavedVariables, credentials, or machine-local settings.

## Why unchanged components do not notify

For example, this `v0.3.4-beta` bundle contains:

- desktop `0.2.2-beta` (unchanged);
- server `0.2.2-beta` (unchanged);
- addon `0.3.2-beta` (updated).

Server and desktop users already on `0.2.2-beta` receive no update notice.
Addon users on `0.3.1-beta` can receive a notice through the synced release catalog.
Rebuilding an unchanged component
does not itself increment its version. **If behavior changed, increment its
component version**; checkers compare versions, not source code or file hashes.
The manifest is generated, not a hand-maintained list.

## Channels and compatibility

| Selected channel | Eligible component versions |
| --- | --- |
| Release (default) | Stable only |
| Beta | Beta and stable |
| Alpha | Alpha, beta, and stable |

Supported versions: `MAJOR.MINOR.PATCH`, optionally with `-alpha`, `-alpha.N`,
`-beta`, or `-beta.N`. The bundle tag must be `v<version>` and match the
manifest's `releaseVersion`. Mark alpha/beta bundles as GitHub prereleases;
stable bundles must not be marked as prereleases. Component eligibility uses
each component's version suffix, so an unchanged stable component can remain
stable inside a preview bundle. Draft releases are ignored.

The checker selects the highest eligible component version across published
releases, not simply the newest GitHub release. Missing manifests on old
unprefixed releases are ignored. Legacy component-prefixed releases remain
readable for compatibility, but **do not create three releases going forward**.
Malformed/unavailable manifests report an error rather than a false
"up-to-date" result. Components missing their declared downloads are ineligible.

Previously distributed checkers do not understand this combined manifest.
Install/deploy this manifest-aware version manually for the initial upgrade.
Afterward, subsequent combined releases are detected normally.

Release metadata/downloads must be publicly readable. A private source
repository needs a public releases-only repository or a separate update
service. Configure desktop `githubRepo` in its user-data `config.json` and API
`GITHUB_REPOSITORY` accordingly. Never embed a personal access token.

## Server installation and automatic backup

Preserve `.env` and the `data` directory while extracting/selecting
the new source. Confirm `NAS_BACKUP_PATH` is configured and its directory
already exists and is writable; mount the NAS first if applicable.

From the deployed project directory on the Pi:

```sh
sh deploy/update-server.sh
docker compose ps
docker compose logs --tail 100 api web
docker compose logs --tail 100 cloudflared
```

The script creates and verifies a uniquely named SQLite backup at the chosen
destination **before rebuilding or restarting API/web**. Backup failure aborts
the update. Pre-update backups remain until manually removed. Direct Docker
commands bypass this guard. Keep a separate secure copy of configuration.
The script also starts missing/stopped backup and Cloudflare tunnel containers.
There is no need to take the whole stack down. Verify tunnel logs and public login.
New installations copy `.env.example` to `.env` and configure it before starting.
Existing installations rename `.env.production` to `.env` without overwriting
an existing file; remove any old `COMPOSE_ENV_FILES=.env.production` override.
Compose now loads `.env` automatically, including for plain `docker compose down`.
The ZIP contains source, not prebuilt images; Docker must be running.
Never use `docker compose down -v` as an upgrade step. Verify login and sync.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup and restore guidance.

## Addon reminders

### CurseForge: one main addon for everyone

CurseForge project **1756960** distributes **FlockSync**, the main addon used by
both members and officers. It is not a separate member-only codebase: guild
permissions and the account's recognized guilds determine catcher status.
Officers additionally need **FlockSync AppHelper** and the desktop app. For now,
download the officer bundle from GitHub for those extra files. Do not upload the
member ZIP and officer bundle as competing files on the same CurseForge project;
the client does not offer a reliable member/officer edition selector.
An independent, optional AppHelper CurseForge project can be added later, with
its own project ID, version, and upload workflow.

Suggested project description:

> All guild members install FlockSync. Officers collecting guild data also need
> FlockSync AppHelper and the Windows desktop app from our GitHub release.
> Regular members do not need AppHelper, the desktop app, or a server account.
> For officer setup, download FlockSync-Addon-Bundle.zip from GitHub; it includes
> the same main FlockSync addon plus AppHelper. Do not nest the extracted folders.

### Set up the BigWigs action once

1. Generate a CurseForge upload API token in your author account. It must have
   permission to upload to project 1756960; it is not a Cloudflare token.
2. In GitHub, open **Settings -> Secrets and variables -> Actions -> New
   repository secret**, name it **CF_API_TOKEN**, and paste the token privately.
   Never put it in source, an issue, a workflow input, or release notes.
3. Commit/push `.github/workflows/curseforge.yml` to the default branch.
4. Open **Actions -> Package or publish CurseForge addon -> Run workflow**.
   Enter an existing combined release tag. Leave **publish** unchecked first.
5. Download the workflow artifact, then inspect the inner addon ZIP. It must
   contain `FlockSync/FlockSync.toc` and the main addon Lua files, without
   AppHelper, API/web/desktop code, database files, or environment configuration.
6. Run again with the same tag and **publish** checked to upload to CurseForge.
   Verify the file, game version, release type, and moderation status there.

The artifact uploader explicitly includes the exact verified ZIP inside the
hidden `.curseforge-release` directory. Keep `include-hidden-files: true` on
that step; upload-artifact otherwise skips dot-prefixed directories. If an
older run failed only at artifact saving, check the preceding CurseForge upload
step and the project's files before publishing again to avoid duplicate uploads.

The workflow is manual on purpose: server-only releases must not automatically
re-upload an unchanged main addon. The package label comes from the main
addon's TOC, not the overall bundle tag. For example, bundle `v0.3.2-beta`
packages main addon `0.3.1-beta`; use that for its first CurseForge upload only
if that addon version has not already been uploaded. Thereafter publish only
when the main addon version changes. The tag and addon must share the same
alpha/beta/stable channel because BigWigs derives upload type from the Git tag.

BigWigs detects Forever from Interface `16001`; do not substitute a retail or
Classic interface just to make an upload pass. If CurseForge does not offer
the matching game version for your pending project, resolve that with
CurseForge rather than mislabeling compatibility. Upload acceptance does not
guarantee public listing or client availability while moderation is pending.
No `GH_API_TOKEN` is supplied: this action does not create another GitHub Release
or modify the combined release assets. The existing PowerShell release packager
remains the source of the six combined-release downloads.

WoW cannot fetch GitHub directly. The API supplies addon release metadata during
desktop sync; AppHelper loads it and guild snapshots relay compact versions to
members. Fresh metadata may require a subsequent sync/login.

AppHelper updates are checked independently against its own installed TOC version.
Updated desktop clients opt into helper metadata from the updated API and write
it to AppHelper SavedVariables. The main addon checks this metadata once at
initial login and, when AppHelper needs updating, prints its installed/latest
versions and points to `github.com/GearDuckDev/FlockSync/releases` for the officer
bundle. This is plain chat text, not a clickable external hyperlink. Members
without AppHelper receive no helper notice. The helper's own alpha/beta/stable
channel controls preview eligibility independently of the main addon. Older
desktop clients do not receive the new response field; update API, desktop, and
main addon to enable this feature. Stale/no metadata cannot prove it is current.

### Website-authorized guild collectors

Website ADMIN and OFFICER accounts can collect guild broadcasts on low-ranked
alts without first logging in on an in-game officer. Install the main addon,
AppHelper, and desktop app, complete addon setup, then log into the desktop app
with the authorized website account. Log out or `/reload` on a character in the
intended guild, let desktop sync finish, and `/reload` again to load the grant.
The server returns a grant scoped to that synced character's guild name and
realm. All characters sharing that WoW account's SavedVariables can collect in
that same guild regardless of rank; other guilds, other realms, and guildless
characters do not inherit it. Normal in-game officer detection still works.

There is currently no website guild-assignment model: the guild comes from the
synced character, not a new user-management setting. A subsequent sync replaces
the grant (a guildless sync clears it). Each WoW account folder needs its own
sync. Guild traffic is only caught while logged in and requires the desktop
app for uploads. Website role checks still run on every upload; local cached
permissions are not an alternative to API authorization. Update the API before
the desktop app and main addon; older API builds reject the new sync field.

The addon checks its saved catalog once at initial character login and prints
at most one chat notice. Reloads, zone changes, and metadata received during
play do not announce updates. Stable installs ignore previews; beta installs
see beta/stable; alpha installs see all three. Use CurseForge to manage preview
downloads. Stale/no guild metadata does not guarantee an addon is current.

## Live beta verification (development)

To repeat the older/current/newer version matrix against the published beta
without editing source versions or using production data, build isolated images:

```powershell
pnpm --filter @flocksync/api build
docker build -f Dockerfile.api -t flocksync-api:update-verification .
docker build -f Dockerfile.web -t flocksync-web:update-verification .
node scripts\test-updates-live.mjs
```

This opt-in check requires Docker and public GitHub access. It expects a beta
bundle, exercises the real GitHub catalog and HTTP endpoints with isolated
databases for all user roles, and tests matching, older, and newer component
versions/channels. Only temporary container copies of the API package version
are changed. Test containers, network, and temporary files are removed afterward.
It does not run automatically in the ordinary offline test suites.

To include the desktop updater's live GitHub check and native Electron transport
smoke test, run from the repository root:

```powershell
$env:FLOCKSYNC_LIVE_UPDATE_TEST = "1"
$loader = ([System.Uri](Resolve-Path .\apps\desktop\test\typescript-loader.mjs).Path).AbsoluteUri
try {
  node --experimental-transform-types --experimental-loader $loader --test .\apps\desktop\test\*.test.ts
} finally {
  Remove-Item Env:\FLOCKSYNC_LIVE_UPDATE_TEST
}
pnpm --filter @flocksync/desktop exec electron test\nativeElectronFetchSmoke.cjs
```

The desktop test targets `v0.3.1-beta` and simulates installed versions in an
isolated configuration directory. The scheduler test invokes timer callbacks
without waiting six hours. These checks do not launch the packaged desktop UI
or a WoW client; verify the visible desktop and in-game notices separately.
