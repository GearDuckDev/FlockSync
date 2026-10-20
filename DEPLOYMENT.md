# Production deployment

## 1. Raspberry Pi 5 and Synology

To prepare a clean source archive on Windows, run
`.\scripts\package-pi-deploy.ps1` from the repository root. Transfer
`release\FlockSync_Pi_Deploy.zip` to the Pi and extract it; the top-level folder is
`FlockSync`. The archive includes the pnpm lockfile but excludes dependencies,
build outputs, database files, local environment secrets and symlinks/junctions.
The script removes its temporary staging directory after packaging.

Use a **64-bit** Raspberry Pi OS / Debian installation, Docker Engine and the
Docker Compose plugin. Keep the repository and live SQLite data on the Pi's
NVMe drive. Do **not** put the live database on NFS/SMB; only backups go there.
Images build natively on ARM64 (Pi) or AMD64 (PC), including better-sqlite3.

On the Pi (Linux terminal, from the repository):

```sh
cp .env.production.example .env.production
openssl rand -hex 32
```

Edit `.env.production`: replace `JWT_SECRET` with the generated value and choose
a unique admin email and password (16+ characters). Never commit this file.
Set `CLOUDFLARE_TUNNEL_TOKEN` using the tunnel setup below. Backup cron runs
daily at midnight UTC.
An admin is seeded only when the users table is empty. Changing the seed
password in the environment later does not reset an existing account.

### Mount the NAS

Enable NFS on the Synology shared folder and grant the Pi's LAN IP access.
Install `nfs-common` on the Pi, then adapt this example to your server/export:

```sh
sudo apt-get update && sudo apt-get install -y nfs-common
sudo mkdir -p /mnt/synology/flocksync_backups
sudo mount -t nfs 192.168.1.20:/volume1/flocksync_backups /mnt/synology/flocksync_backups
mountpoint /mnt/synology/flocksync_backups
```

For boot persistence, add the real export to `/etc/fstab`, for example:

```fstab
192.168.1.20:/volume1/flocksync_backups /mnt/synology/flocksync_backups nfs defaults,_netdev 0 0
```

Set `NAS_BACKUP_PATH=/mnt/synology/flocksync_backups`. Ensure the backup
container can write there; Synology root-squash mappings and export permissions
must allow it. Test creating a file through the mounted share. Never store NAS
credentials in the repository. Configure service startup ordering so the NAS is
mounted **before** Compose; otherwise backups can land on the Pi's mountpoint
directory instead. For a trial without NAS, set `NAS_BACKUP_PATH=./data/backups`
and create it with `mkdir -p data/backups` before starting Compose.

### Start the stack

Configure the Cloudflare tunnel below before starting. No host ports are
published by the stack.

```sh
mkdir -p data/sqlite
sudo chown 1000:1000 data/sqlite
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 api db-backup cloudflared
docker compose --env-file .env.production exec web wget -qO- http://localhost/health
```

The API runs as UID 1000 and needs write access to `data/sqlite`. It is not
published directly. Nginx serves the SPA and proxies `/api/` and `/health`.
Visit `https://flocksync.gearduckdev.com` and log in with the initial admin
credentials. The desktop app's **API URL** should be
`https://flocksync.gearduckdev.com` (no `/api` suffix; the desktop app adds it).

Cloudflare provides public HTTPS and routes traffic through an outbound tunnel;
no router port forwarding is needed. Keep secrets and backups
restricted; backups contain account password hashes and guild records.

### Exposing to the Internet via Cloudflare Tunnels

Use a domain managed by Cloudflare for your public hostname.

1. Go to the **Cloudflare Zero Trust Dashboard -> Networks -> Tunnels**.
2. Create a new Cloudflared tunnel, for example **FlockSync**.
3. Copy its **Tunnel Token** and set `CLOUDFLARE_TUNNEL_TOKEN` in
   `.env.production`. Keep the token private; do not paste the entire
   Cloudflare installation command or commit the token.
4. In the tunnel's **Public Hostname** configuration, route
   `flocksync.gearduckdev.com` to **HTTP** service **`http://web:80`**. This is the
   internal Docker service, not `localhost` or the Pi's IP address.
5. On the Pi, from the extracted project folder, start the stack:

   ```sh
   docker compose --env-file .env.production up -d
   ```

   Include `--build` on first deployment or when updating source code.
   Use `--env-file .env.production` so Compose can substitute the tunnel token
   and NAS path; plain `docker compose up -d` does not automatically load it.

Confirm the tunnel is healthy in Cloudflare and visit
`https://flocksync.gearduckdev.com/health`. The web and API containers have no
published host ports, so direct access at the Pi's IP/port no longer works.
Remove any old `WEB_PORT` setting; it is no longer used.

FlockSync's JWT login and Officer/Admin authorization still apply. If you add
Cloudflare Access policies, browser-only login challenges will also affect the
desktop app's API calls; the desktop app does not implement Cloudflare Access
service-token authentication.

### Schema updates and existing databases

At startup, the API applies checked-in Drizzle SQL migrations **before** seeding
or listening. The baseline also adopts previous `db:push` databases and adds
the historical optional tracking columns without deleting existing rows.
Migration failure stops startup with an explicit log.

To move an existing dev database, stop its API and use SQLite `.backup` to
create `data/sqlite/flocksync.db`; set ownership to UID 1000. Do not copy just
the `.db` file from a running WAL database. Keep an independent backup first.

After future schema edits, developers run `pnpm --filter @flocksync/api db:generate`
and commit the generated SQL **and** Drizzle metadata. Rebuild and redeploy.
Do not use interactive `db:push` in production or edit applied migrations.

Migration `0001_character_auto_stale` adds `characters.auto_stale`. Addon-reported
30+ day idle characters are deactivated with `auto_stale = 1` and revived
automatically on a newer, fresh login; manual web culls clear the flag and stay
sticky. Redeploy the API to apply it (it runs automatically on startup).

For every server upgrade, select/extract the new source while preserving
`.env.production` and `data`, then run from that deployed project directory:

```sh
sh deploy/update-server.sh
```

The script builds backup tooling, runs a one-shot SQLite backup in the configured
`NAS_BACKUP_PATH`, verifies it, and only then builds/recreates API and web containers.
Backup failure aborts the upgrade without rebuilding or restarting API/web.
This guard applies when using the script; direct Docker commands bypass it.
The script does not download a release or change tags for you.

`NAS_BACKUP_PATH` must be set in `.env.production`, and that directory must
already exist. Compose refuses to silently create a missing destination or use
a fallback. Mount the NAS first if that is your chosen destination; verify the
mount is actually live before upgrading. A local trial directory must be
created manually, for example `mkdir -p data/backups`.

### Backups, retention and restore

The Alpine sidecar runs once at startup, then daily at midnight UTC via cron. SQLite's
online `.backup` API takes a consistent snapshot while WAL writes continue.
It verifies `PRAGMA quick_check`, renames the temporary file only on success,
and then deletes daily backups older than 30 days. Successful daily runs publish
`flocksync-YYYYMMDD.db`; rerunning on the same day replaces that day's backup
only after validation. Failed backups log an error and leave existing backups
untouched; cron retries at the next daily run. Inspect logs and NAS contents regularly.

Pre-update backups are published as
`flocksync-pre-update-<UTC timestamp>-<unique suffix>.db` and are not overwritten
by daily runs or deleted by automatic retention. Review/remove these rollback
snapshots manually when no longer needed. They contain the database, not your
production environment file: keep a separate secure configuration backup.

The source volume is mounted read-only. With a live WAL database, SQLite needs
readable WAL/SHM files already created by the API, which Compose waits for
before starting the backup service. Missing or inaccessible WAL/SHM files cause
an explicit backup failure; the backup never uses `immutable=1`, which could
miss live WAL changes. This does not run a checkpoint or copy raw database files.
NAS unmounts/network failures must be monitored separately.

To restore: stop the stack, preserve the current database and its WAL/SHM files
elsewhere, put a selected verified backup at `data/sqlite/flocksync.db`, ensure
no old WAL/SHM files remain alongside it, set ownership to 1000:1000, then start
the stack. Never restore over a running SQLite connection.

## 2. Windows officer desktop releases

On Windows with Node.js 22+ and pnpm, from the repo root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @flocksync/desktop typecheck
pnpm --filter @flocksync/desktop package:win
```

Find the **NSIS installer** (`FlockSync-Setup-<version>-x64.exe`) and the
**portable app** (`FlockSync-Portable-<version>-x64.exe`) in
`apps\desktop\release`. The portable target needs no Node.js installation.
All runtime dependencies, including shared-types, are bundled by electron-vite.
Bump the desktop package version before publishing a new release.

Unsigned builds can show Windows SmartScreen warnings. For public distribution,
configure electron-builder code signing with your own certificate via its
environment variables; never commit a certificate or signing password.
Test both executables on a clean Windows machine, enter the API Server URL for
the FlockSync instance the guild uses, log in, select the WoW folder and confirm
a sync after `/reload`.

### Publishing updates (GitHub Releases)

The desktop app reads the paginated GitHub releases list without authentication.
`githubRepo` defaults to `GearDuckDev/FlockSync` and is stored in the app's
`config.json` (in its user-data folder under `%APPDATA%`). The repository must
be public (or use a public releases-only repository); private repositories
cannot be read by the unauthenticated checker.

Choose **Release** (default), **Beta**, or **Alpha** in App Settings. Publish
all downloads together as `v<overall-version>` with `flocksync-release.json`.
The generated manifest records each component's version; an unchanged desktop
or server does not trigger an update just because the overall tag changed.
Mark alpha/beta releases as prereleases; stable releases must not be marked as
prereleases. Use `.\scripts\package-release.ps1 -ReleaseVersion <version>` for
one-command packaging. See [RELEASES.md](./RELEASES.md) for the full tagging,
versioning, build, upload, and recurring release checklist.

The update banner's **Download on GitHub** opens the release page. Installation
stays manual; there is no silent auto-install. Requests are cached to reduce
GitHub's unauthenticated rate-limit usage.

### Tray and start-on-boot behavior

- Closing the window hides it to the tray when *Minimize to Tray on Close* is on.
  Turn it off to make the close button quit the app. *Quit FlockSync* in the tray
  always exits.
- *Run on Windows Startup* (on by default) registers the installed `.exe`, or the
  portable `.exe` itself, as a per-user login item with a `--hidden` argument.
  Logon launches therefore start in the tray without showing the window.
  Launching the app again while it is already running reopens the existing window.
- Development runs (`pnpm dev`) never register a login item.
- Disabling FlockSync in Task Manager's Startup tab overrides the setting.

### Snapshot return-trip updates

Snapshot support requires **both** the updated API and the updated desktop app.
Building desktop source does not update an already packaged/running executable,
and an existing Pi ZIP does not update itself after source changes.

1. Regenerate the Pi ZIP with `.\scripts\package-pi-deploy.ps1`, copy and extract
   it on the Pi, preserving `.env.production` and `data`.
2. Run `sh deploy/update-server.sh` to back up and verify SQLite before updating.
3. Build a fresh desktop executable using `pnpm --filter @flocksync/desktop package:win`.
   Close the old desktop app completely and start the new executable.
4. Log out of WoW, let the desktop sync finish, and inspect that account's
   `WTF\Account\<account>\SavedVariables\FlockSync_AppHelper.lua`.
   It should contain `craftersIndex`, `upcomingRaids`, and `goalMatches`, even if
   empty. Log back in to load the returned data. `/reload` writes old in-memory
   SavedVariables before loading, so logging out before syncing is the clearest
   way to verify the disk contents.

The desktop sync log reports recipe/team/goal counts. If it says the server
omitted snapshot fields, the API is still serving a legacy response. An older
desktop may instead report "Unexpected sync response from server" when the new
API returns fields its strict validator does not recognize.

## 3. Addon releases

From the repo root in PowerShell:

```powershell
.\scripts\package-addons.ps1
```

| Output | Send to | Contains |
| --- | --- | --- |
| `release\FlockSync-Addon-Bundle.zip` | Officers using the desktop app | `FlockSync/` and `FlockSync_AppHelper/` |
| `release\FlockSync-Raider-Only.zip` | Other guild members | `FlockSync/` only |

Extract directly into `Interface\AddOns` (not an extra bundle directory).
Enable the addons and log in: each account completes a short first-time
walkthrough (sharing explanation, feature toggles, role/main). Scanning and
broadcasting stay paused until **Finish**, including on installs upgraded from
earlier versions. Set availability under `/fs options`, and use
`/reload` to write SavedVariables. Raiders do not need the desktop app or an
API account just to broadcast guild data. The helper is only for officers.

The local testing override `forceOfficerMode` defaults to `false`. The addon
records guilds for which a character has native officer-note permission or a
sufficient guild rank; other characters in that same WoW account are catchers
only while in one of those guilds. The desktop-created authorization flag is
also restricted to guilds already recognized by the addon for that account.
When an Officer/Admin logs in to the desktop app or saves a WoW path, it creates
or authorizes `FlockSync_AppHelper.lua` in each discovered account
SavedVariables folder; restart WoW or `/reload` to load it.

## 4. Development and verification

### Updating and redeploying the Pi stack

On the development machine, package the current deployment sources:

```powershell
.\scripts\package-pi-deploy.ps1
```

Copy `release\FlockSync_Pi_Deploy.zip` to the Pi. There, from the directory
where you keep the deployment, extract it and redeploy while preserving
`data/sqlite`, `.env.production`, and the mounted NAS share:

```sh
unzip -o FlockSync_Pi_Deploy.zip
cd FlockSync
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Keep the existing `.env.production` and `data/sqlite` outside the overwritten
source archive; the ZIP intentionally excludes local secrets and database files.
The configured tunnel hostname remains `flocksync.gearduckdev.com`.

Build release addon archives from the development machine with:

```powershell
.\scripts\package-addons.ps1
```

The raider and officer ZIPs are written to `release\`.

```powershell
pnpm run typecheck
pnpm run build
pnpm --filter @flocksync/api test:production
```

Production web builds default to the relative `/api` endpoint. Override it with
`VITE_API_BASE_URL=https://host.example/api` at **build time** if needed.
Local Vite development defaults to `http://localhost:3001/api`. The old
`VITE_API_URL` origin setting remains supported for existing development setups.

To verify both CPU architectures with Buildx (requires emulation off the Pi):

```sh
docker buildx build --platform linux/arm64,linux/amd64 -f Dockerfile.api .
docker buildx build --platform linux/arm64,linux/amd64 -f Dockerfile.web .
```

Use `--push -t <registry/image:tag>` to publish multi-platform images, or
`--load` with **one** platform for local smoke tests.
