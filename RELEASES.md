# Publishing FlockSync: one release, all downloads

Publish **one GitHub Release** with all artifacts and `flocksync-release.json`.
The overall Git tag identifies the bundle; the manifest identifies the version
of each component. Desktop, server, and addon update checks compare their own
installed version with their own manifest entry, never with the bundle tag.

## Current beta

| Item | Version |
| --- | --- |
| Combined GitHub tag | `v0.3.1-beta` |
| Desktop | `0.2.1-beta` |
| API + web / server | `0.2.1-beta` |
| Main addon | `0.3.1-beta` |
| AppHelper | `0.2.1-beta` |
| Root/shared-types package | `0.2.1-beta` |

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
   .\scripts\package-release.ps1 -ReleaseVersion 0.3.1-beta
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
   git tag -a v0.3.1-beta -m "FlockSync 0.3.1-beta"
   git push origin v0.3.1-beta
   ```

6. On GitHub, open **Releases -> Draft a new release**:
   - Tag: `v0.3.1-beta`.
   - Title: `FlockSync 0.3.1-beta`.
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
| `FlockSync-Setup-0.2.1-beta-x64.exe` | Windows installer |
| `FlockSync-Portable-0.2.1-beta-x64.exe` | Windows portable app |
| `FlockSync_Pi_Deploy.zip` | Web/API Docker deployment source |
| `FlockSync-Raider-Only.zip` | Main addon for guild members |
| `FlockSync-Addon-Bundle.zip` | Main addon + AppHelper for officers |

Executable filenames change with the desktop version. The packaging script
prints the exact list for each release. Do not upload old matching-pattern
files just because they remain in the output folder. Do not rename the files
without updating the manifest/packager. Never upload real environment files,
databases, SavedVariables, credentials, or machine-local settings.

## Why unchanged components do not notify

For example, a later `v0.3.2-beta` bundle might contain:

- desktop `0.2.1-beta` (unchanged);
- server `0.2.1-beta` (unchanged);
- addon `0.3.2-beta` (updated).

Desktop and server users already on `0.2.1-beta` receive no update notice.
Addon users on `0.3.1-beta` receive a notice. Rebuilding an unchanged component
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

Preserve `.env.production` and the `data` directory while extracting/selecting
the new source. Confirm `NAS_BACKUP_PATH` is configured and its directory
already exists and is writable; mount the NAS first if applicable.

From the deployed project directory on the Pi:

```sh
sh deploy/update-server.sh
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail 100 api web
```

The script creates and verifies a uniquely named SQLite backup at the chosen
destination **before rebuilding or restarting API/web**. Backup failure aborts
the update. Pre-update backups remain until manually removed. Direct Docker
commands bypass this guard. Keep a separate secure copy of configuration.
The ZIP contains source, not prebuilt images; Docker must be running.
Never use `docker compose down -v` as an upgrade step. Verify login and sync.
See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup and restore guidance.

## Addon reminders

WoW cannot fetch GitHub directly. The API supplies addon release metadata during
desktop sync; AppHelper loads it and guild snapshots relay compact versions to
members. Fresh metadata may require a subsequent sync/login.

The addon checks its saved catalog once at initial character login and prints
at most one chat notice. Reloads, zone changes, and metadata received during
play do not announce updates. Stable installs ignore previews; beta installs
see beta/stable; alpha installs see all three. Use CurseForge to manage preview
downloads. Stale/no guild metadata does not guarantee an addon is current.
