# Production deployment

For routine maintenance of your own installation, use the
[server operations quick reference](./SERVER-OPERATIONS.md) for everyday status,
maintenance stop/start, and backup-aware updates. All domains and storage paths
below are examples: substitute your own. No maintainer server, NAS, monitoring
installation, or existing database is required.

The committed `pnpm-lock.yaml` pins dependency versions for reproducible builds
on supported platforms; keep it. It contains relative workspace links, not
server credentials or a dependency on the maintainer's checkout. Real `.env`
files, local Compose overrides, databases, and `*.local.*` notes must remain
untracked. Only `.env.example` templates belong in source control.

## 1. Remote server and backup storage

To prepare a clean source archive on Windows, run
`.\scripts\package-remote-server-deploy.ps1` from the repository root. Transfer
`release\FlockSync_Remote_Server_Deploy.zip` to the remote server and extract it; the top-level folder is
`FlockSync`. The archive includes the pnpm lockfile but excludes dependencies,
build outputs, database files, local environment secrets and symlinks/junctions.
The script removes its temporary staging directory after packaging.
The ZIP also includes this guide, `SERVER-OPERATIONS.md`, and the license.
Development checklists and optional notification plans linked below are in
the public source repository rather than installed host configuration.

Use a **64-bit** Linux installation, Docker Engine and the
Docker Compose plugin. ARM64 and AMD64 hosts are supported, including virtual
machines and physical servers. Keep the repository and live SQLite data on a
local persistent disk (SSD recommended). Do **not** put the live database on
NFS/SMB; only backups go there. Images build natively for either architecture,
including better-sqlite3.

On the remote server (Linux terminal, from the repository):

```sh
cp .env.example .env
openssl rand -hex 32
```

Edit `.env`: replace `JWT_SECRET` with the generated value and choose
a unique admin email and password (16+ characters). Never commit this file.
Set `CLOUDFLARE_TUNNEL_TOKEN` using the tunnel setup below. Backup cron runs
daily at midnight UTC.
An admin is seeded only when the users table is empty. Changing the seed
password in the environment later does not reset an existing account.

The API limits login attempts to 10 per visitor IP per 15 minutes and
self-registration to 5 per visitor IP per hour. These in-memory limits are
per API process and reset when it restarts; the supported Compose deployment
runs one API instance. Successful, failed, and malformed attempts all count.
People sharing a public IP (for example a household, VPN, or guild LAN) share
its allowance. IPv6 addresses currently have separate allowances, not a shared
subnet quota; rotating addresses or a distributed botnet can evade per-IP limits.

Public registration defaults to enabled. To require admin-created accounts,
set `PUBLIC_REGISTRATION_ENABLED=false` in the deployment `.env`; existing
users can still log in, admins can still create accounts, and an initial admin
can still be seeded. This does not add an invitation system. The defaults can
be adjusted with `AUTH_LOGIN_RATE_LIMIT_MAX`,
`AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, and
`AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`. Values are request counts and
milliseconds. Set these deliberately; very low limits can affect users sharing
one public IP. Cloudflare edge rules may add another layer, but are not a
replacement for the API limits.

### Trusted proxies and private networks

The traffic path is **visitor -> Cloudflare -> cloudflared -> nginx -> API**.
Nginx is the front desk: only the configured connector's exact private IP may
supply `CF-Connecting-IP`. Nginx replaces forwarded-IP headers before sending
API requests onward. Direct peers cannot choose a different quota by supplying
those headers. Missing/unparseable visitor addresses fall back to the socket
peer; non-IP characters and address lists are rejected with `400`.

The API trusts only nginx's exact private address, not every container or any
arbitrary one-hop proxy. Compose uses an internal `api_proxy` network between
API/nginx, a separate `tunnel_proxy` network between connector/nginx, and
`api_egress` for outbound API requests. The connector and backup service are not
on `api_proxy`. No API/web host ports are published. Do not publish them, attach
untrusted containers to these networks, or route the tunnel directly to API.
Docker/host administrators and operator-controlled Cloudflare Workers/config
remain trusted; these controls do not protect a compromised host or edge account.

Defaults reserve `172.30.90.0/29` and `172.30.91.0/29`. Before deployment,
check for overlaps with LAN/VPN/Docker networks. If needed, change
`API_PROXY_SUBNET` together with `API_PROXY_IP` (nginx), and
`TUNNEL_PROXY_SUBNET` together with both `TUNNEL_WEB_IP` (nginx) and
`TUNNEL_PROXY_IP` (connector). Use distinct, unused, non-gateway host addresses
inside each subnet. Compose sets API `TRUSTED_PROXY_IP` from `API_PROXY_IP`
and renders nginx's connector trust from `TUNNEL_PROXY_IP` at startup.
Standalone API development defaults to no proxy trust; set `TRUSTED_PROXY_IP`
only when an actual known private proxy sits in front.

Deployment validation locally emulates the connector's headers; it does not
certify a live Cloudflare tunnel. Before distributing this change, complete the
[C1 maintainer checklist](https://github.com/GearDuckDev/FlockSync/blob/main/SECURITY-HEALTH-PLAN.md#c1-maintainer-test-handoff).
For an existing deployment, preserve settings/data and use
`sh deploy/update-server.sh` after approval; network membership changes require
container recreation. Do not restart a live server just to test this candidate.

Existing installations using `.env.production`: rename it to `.env` before
using the updated Compose configuration. Use `mv -i .env.production .env` and do
not overwrite an existing `.env`; reconcile settings manually if both exist.
Remove any old `COMPOSE_ENV_FILES=.env.production` setting from `.env` or your
shell environment. Keep your existing secrets and backup storage path; do not replace them
with the example values. The root deployment `.env` is separate from the API's
local development `apps/api/.env`.

### Configure backup storage

Backup storage can be a mounted network share, an attached disk, or an existing
local directory. `NAS_BACKUP_PATH` remains the configuration key for compatibility;
it is not restricted to network storage. Existing installations must keep their actual
configured path: the new example path below does not require renaming or moving
any existing mount or backup.

For NFS storage, enable an export on the storage host and grant the application
server's LAN IP access. On Debian/Ubuntu, install `nfs-common`, then adapt this
example to your storage host's actual export:

```sh
sudo apt-get update && sudo apt-get install -y nfs-common
sudo mkdir -p /mnt/backup-storage/flocksync_backups
sudo mount -t nfs 192.168.1.20:/exports/flocksync_backups /mnt/backup-storage/flocksync_backups
mountpoint /mnt/backup-storage/flocksync_backups
```

For boot persistence, add the real export to `/etc/fstab`, for example:

```fstab
192.168.1.20:/exports/flocksync_backups /mnt/backup-storage/flocksync_backups nfs defaults,_netdev 0 0
```

Set `NAS_BACKUP_PATH=/mnt/backup-storage/flocksync_backups`. Ensure the backup
container and the API user can read/write there; storage-host root-squash mappings
and export permissions must allow it. Test creating a file as the API user too.
Never store storage credentials in the repository. Configure service startup
ordering so network storage is mounted **before** Compose; otherwise backups can
land on the remote server's mountpoint directory instead. For local backup
storage, set `NAS_BACKUP_PATH=./data/backups` and prepare its permissions before
starting Compose:

```sh
mkdir -p data/backups
sudo chown 1000:1000 data/backups
```

This is for a new local backup directory only. Do not recursively change an
existing share's ownership; verify its configured export permissions instead.

### Start the stack

Configure the Cloudflare tunnel below before starting. No host ports are
published by the stack.

```sh
mkdir -p data/sqlite
sudo chown 1000:1000 data/sqlite
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 api db-backup cloudflared
docker compose exec web wget -qO- http://127.0.0.1/ready
```

The API runs as UID 1000 and needs write access to `data/sqlite`. It is not
published directly. Nginx serves the SPA and proxies `/api/`, `/health`, and `/ready`.
Visit your own hostname (for example `https://flocksync.example.com`) and log in with the initial admin
credentials. The desktop app's **API URL** should be
`https://flocksync.example.com` (no `/api` suffix; the desktop app adds it).

Cloudflare provides public HTTPS and routes traffic through an outbound tunnel;
no router port forwarding is needed. Keep secrets and backups
restricted; backups contain account password hashes and guild records.

### Exposing to the Internet via Cloudflare Tunnels

Use a domain managed by Cloudflare for your public hostname.

1. Go to the **Cloudflare Zero Trust Dashboard -> Networks -> Tunnels**.
2. Create a new Cloudflared tunnel, for example **FlockSync**.
3. Copy its **Tunnel Token** and set `CLOUDFLARE_TUNNEL_TOKEN` in
   `.env`. Keep the token private; do not paste the entire
   Cloudflare installation command or commit the token.
4. In the tunnel's **Public Hostname** configuration, route
   your hostname, for example `flocksync.example.com`, to **HTTP** service **`http://web:80`**. This is the
   internal Docker service, not `localhost` or the remote server's IP address.
5. On the remote server, from the extracted project folder, start the stack:

   ```sh
   docker compose up -d
   ```

   Include `--build` on first deployment or when updating source code.
   Compose automatically loads the deployment directory's `.env` for the tunnel
   token and backup storage path. Plain `docker compose down` works from this directory too;
   no `--env-file` flag is needed.

Confirm the tunnel is healthy in Cloudflare and visit
`https://flocksync.example.com/health` (replace the hostname). The web and API containers have no
published host ports, so direct access at the remote server's IP/port no longer works.
Remove any old `WEB_PORT` setting; it is no longer used.

FlockSync's JWT login and Officer/Admin authorization still apply. If you add
Cloudflare Access policies, browser-only login challenges will also affect the
desktop app's API calls; the desktop app does not implement Cloudflare Access
service-token authentication.

### Optional free edge protection

Application limits above need no paid service. Cloudflare edge protection is an
extra layer, not a guarantee of uptime and not a requirement for self-hosting:

1. In the zone's **Security rules -> Create rule -> Rate limiting rules**, check
   the rules/options included in your current free plan. Do not enable a paid
   upgrade. If unavailable, keep application limits and skip this optional step.
2. Match `POST` requests with paths `/api/auth/login` or `/api/auth/register`
   (use the dashboard's method/path fields), counting by visitor IP. Choose an
   available short window and a burst threshold comfortably above normal guild
   activity; for example, 20 attempts per 10 seconds if those options exist.
   This is a separate burst filter, not a replacement for the longer API windows.
3. Use a short temporary **Block**, where included. Do not apply a browser
   challenge or Under Attack mode to the whole API: Electron clients cannot
   complete browser interstitials. No custom paid JSON response is required.
4. Review the rule, deploy only to an approved staging hostname first, and
   verify normal browser/desktop login, signup, and health requests still work.
   Check security events for false positives, especially shared IPs. Disable
   the new rule to roll it back; do not disable application protections.

Cloudflare plan options change. Consult its
[rate-rule setup guide](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/)
and [security-level guidance](https://developers.cloudflare.com/waf/tools/security-level/).
Do not run burst tests against production without explicit operator approval.

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

The shared kill-list migration adds guild/realm-scoped records and durable
removal markers. Update the API, Desktop and main addon together for this
preview; AppHelper code is unchanged. Personal entries/drafts do not upload.
New additions selected as Guild Shared send their target and note automatically
on save. Older local drafts remain private until explicitly published. A missing
guild roster identity or full sending queue rejects the entire add (including
the personal copy if both were selected); the editor reports the error for retry.
Any current online guild member can add, edit, remove, or publish shared
targets in game; guild roster identity is still required. Any signed-in website
user can add shared targets, edit notes, and remove entries. There is no public
view. Website changes return through collector sync. Officers/admins retain
the guild relay role for server-returned snapshots.
Backup/restore includes shared targets; restore advances their sync epochs
past the reset fence without rewriting original authors/creation time.
Preserve backups and do not use a production wipe/restore to test this candidate.

The additive `kill_observations` migration stores only published-target
observations: one latest sighting per target and at most 5,000 guild battle
events from the latest 90 days. The authenticated Kill List page shows
last-seen zones/times and read-only battle history; permission to edit targets
is unchanged. Reports are trusted collector/client claims, not independently
verified game combat. Personal lists, personal observations and shared drafts
are excluded by the Desktop allowlist. Target removal also retires its reports;
old creation history cannot be attached to a re-added target.

Update the API/web, Desktop and main addon as one candidate. An old API that
omits observation return data causes a visible Desktop error, preserving the
previous helper file rather than claiming success. AppHelper code is unchanged.
Backups include observation history and restore preserves original evidence
timestamps (it does not rewrite a past battle as a new one). Guild-data wipe
clears shared observations, and pre-reset uploads cannot restore them.
Game checks still need real client evidence: restricted event values and death
recap fields can prevent attribution; the addon does not guess a killer or
bypass restrictions.

For every server upgrade, select/extract the new source while preserving
`.env` and `data`, then run from that deployed project directory:

```sh
sh deploy/update-server.sh
```

The script builds backup tooling, runs a one-shot SQLite backup in the configured
`NAS_BACKUP_PATH`, verifies it, and only then builds/recreates API and web containers.
It also starts the backup service and Cloudflare tunnel, including when they
were previously stopped or removed. The tunnel waits for healthy web and receives
`CLOUDFLARE_TUNNEL_TOKEN` as its `TUNNEL_TOKEN` environment variable.
An unchanged running tunnel is left running; a whole-stack shutdown is not needed.
Check `docker compose logs --tail 100 cloudflared`
and the public hostname after the update; container startup alone does not prove
Cloudflare accepted the token or established a connection.
Backup failure aborts the upgrade without rebuilding or restarting API/web.
This guard applies when using the script; direct Docker commands bypass it.
The script does not download a release or change tags for you.

`NAS_BACKUP_PATH` must be set in `.env`, and that directory must
already exist. Compose refuses to silently create a missing destination or use
a fallback. Mount the backup storage first if that is your chosen destination; verify the
mount is actually live before upgrading. A local trial directory must be
created manually, for example `mkdir -p data/backups`.

### Liveness, readiness, and backup diagnostics

- **`GET /health`** keeps the existing minimal `{"status":"ok"}` response. It
  means the API process can respond, not that SQLite or backups are healthy.
- **`GET /ready`** performs a small SQLite schema read. It returns
  `{"status":"ok"}` with `200`, or `{"status":"unavailable"}` with `503`.
  Both public checks disable caching and omit paths, stack traces and secrets.
  API and web Docker health checks use `/ready`; web checks the nginx-to-API path.
  Use the public HTTPS `/ready` endpoint for future availability monitoring.
- **`GET /api/admin/health`** requires a current ADMIN JWT. MEMBER/OFFICER
  accounts cannot read it. This is an API/log diagnostic in C2, not a new
  Admin Settings panel, notification service, or external uptime monitor.
  It reports `status`, `lastVerifiedAt`, `lastAttemptAt` (Unix seconds or null),
  and `staleAfterSeconds` (129600 = 36 hours). Do not paste a JWT into chat,
  URLs, screenshots or shell history; use the existing authenticated client
  or a private HTTP client with an Authorization Bearer header.

Backup states:

| State | Meaning / operator action |
| --- | --- |
| `healthy` | A verified backup in the selected folder is no older than 36 hours and matches its recorded SHA-256 digest. |
| `missing` | No verification evidence exists for the selected folder. Create a new verified backup; old files alone do not count. |
| `failed` | The most recent recorded attempt failed (including ties with a success timestamp). Inspect backup/API logs and storage permissions; retry after fixing the cause. |
| `stale` | The latest verified backup is more than 36 hours old. Check cron, storage, and container state. |
| `unavailable` | Evidence is malformed/unreadable, the folder/file is missing/inaccessible, timestamps are in the future, or backup contents no longer match. This returns `503`; details stay in server logs. |

Other diagnostic states return `200` with the explicit state, not a generic
success flag. Backup trouble does **not** make `/ready` fail: a backup destination
is not required to serve normal requests. Manual, pre-restore, pre-wipe, startup,
daily, and pre-update backups contribute evidence; a healthy result does not
prove that the scheduled job specifically is running. It does not certify
off-host disaster recovery or a successful restore.

The API and scheduled writer keep separate atomic `backup-health-*.json` files
beside the live database. These are operational evidence, not secrets or
database records. Preserve the data directory during upgrades. Existing
backups are not retroactively called verified; make a fresh backup after upgrade.
Changing the selected folder requires verified evidence for that folder.
The SHA-256 check streams the selected latest snapshot on each admin diagnostic
request, so this endpoint is limited to 6 requests/IP/minute and is not intended
for frequent polling or a public monitor. Staleness and errors are reported
when the endpoint is queried; C2 does not yet send background alerts.

Useful structured log event names: `readiness_failed`, `backup_verified`,
`backup_failed`, `backup_evidence_write_failed`, `backup_health_degraded`,
`backup_health_unavailable`, `api_startup_failed`, `sqlite_initialization_failed`,
and `sqlite_migration_failed`. Existing `auth_rate_limit_exceeded` remains.
Use `docker compose ps` and `docker compose logs --tail 100 api db-backup web`
privately. Docker health status alone does not restart unhealthy running
containers; restart policy handles process exits. Independent outage alerts
and resource limits are the next phase.

### Resource safeguards and monitoring

The supplied Compose file bounds each running service (not image builds):

| Service | Memory ceiling | CPU ceiling | Processes/threads |
| --- | --- | --- | --- |
| API | 2 GiB | 2 CPUs | 128 |
| nginx/web | 256 MiB | 1 CPU | 128 |
| tunnel | 256 MiB | 1 CPU | 128 |
| scheduled backup | 512 MiB | 1 CPU | 64 |

Memory ceilings are not reservations; equal memory/swap limits prevent these
containers from consuming additional swap. The host must support Docker memory/
CPU/PID controls. Local Linux AMD64 tests measured a roughly 701 MiB API cgroup
peak (including cache) before caps during a 128 MiB restore; a bounded rerun
with 501 characters and recipe data peaked around 747 MiB, with 22 API threads/
processes and no restarts/OOM. Scheduled backup measured about 10 MiB.
This is synthetic test evidence, not a production or ARM64 capacity guarantee.
The tunnel's ceiling is conservative configuration, not a measured live-traffic
capacity claim. Re-measure real guild/large-database workload before rollout.

Set `API_MEMORY_LIMIT`, `WEB_MEMORY_LIMIT`, `TUNNEL_MEMORY_LIMIT`,
`BACKUP_MEMORY_LIMIT` and their matching `*_CPU_LIMIT` variables to override.
Use Docker size syntax (`2g`, `512m`); do not lower limits just to fit an
undersized host. Leave memory/CPU/disk headroom for the OS, other services,
parallel backups and image builds. A host that cannot spare the runtime budget
needs separate capacity planning; these ceilings do not create free RAM.
An OOM exit/restart is a failure requiring investigation, not normal operation.

All four services use Docker's rotating `local` log driver, three 10 MiB files
per container (roughly 30 MiB plus overhead, not a whole-host disk quota).
`docker compose logs` still works. Existing log collectors depending on Docker
`json-file` paths must be adapted before deployment. Restart policies still
handle process exits only; no automatic restart loop for readiness failures
has been added.

Request boundaries now align API and nginx:

| Request | Maximum body |
| --- | --- |
| Login / public signup | 4 KiB at API |
| Ordinary requests / theme upload JSON | 1 MiB |
| Officer sync | 10 MiB |
| Admin SQLite restore upload | 128 MiB |

Sync/themes/database mutation authorization runs before body parsing. Restore
uploads stream through nginx to the authenticated API rather than buffering
the entire file at nginx, and only one authenticated restore upload may be
admitted per API process at a time. Another receives `409` with `Retry-After`.
Admission clears on response, error, timeout, or aborted upload; the existing
database operation lock still serializes backup/restore/wipe. Invalid SQLite
headers are rejected rather than treating tiny/empty inputs as a new database.
Other protected endpoints retain their existing auth hooks and the 1 MiB cap.

Nginx header timeout is 15 seconds; body/read-to-client inactivity timeouts are
60 seconds, and upstream send/read inactivity timeouts are 300 seconds. The API
sets a 300-second request receive timeout and socket inactivity timeout, with
5-second keep-alive. These are bounded receives/inactivity timers, **not**
cancellation of a running SQLite operation or a complete slow-request defense.
Very slow uploads or huge database operations may require offline recovery.
Cloudflare plan upload/response limits can be lower than the origin's limits:
do not buy an upgrade just to restore; use the documented offline recovery
procedure if the tunnel rejects the file.

#### Refusing an accidental local backup fallback

An unmounted NAS can leave an ordinary empty directory at its mountpoint.
The existing bind-path check cannot distinguish that from the intended disk.
For production, configure an identity marker **after verifying the mount**:

1. Use `mountpoint /your/actual/mount` and `findmnt -T /your/backup/directory`
   to confirm the expected source. For local/attached backup storage, verify
   the intended filesystem with `findmnt -T` instead.
2. Choose a non-secret identifier, such as `guild-backups`, and create
   `.flocksync-storage-id` containing exactly that ID and a newline at the
   **root of the configured backup directory**, while its correct storage is
   mounted. Make it readable by API UID 1000, not writable by untrusted users.
3. Set `BACKUP_STORAGE_ID=guild-backups` in the private deployment environment.
   The API and scheduled/pre-update backup writer both require a matching,
   regular, non-symlink marker before using that backup root.
4. Do not copy the marker into the underlying unmounted local directory.
   A missing/wrong marker must fail a test backup; remount/fix storage rather
   than creating a fallback. Never unmount live production storage to test.

Empty/unset `BACKUP_STORAGE_ID` preserves existing installations until this
operator setup is performed; **it does not protect against that mount fallback**.
Keep service startup ordered after the mount, and complete marker setup before
claiming mount-fallback protection. Protect the parent path against tampering;
the marker detects accidental absence/wrong storage, not host compromise or
mount changes during an already-running operation.

#### Host checks and resource/backup alerts

From the deployed Linux project directory:

```sh
docker compose ps
docker stats --no-stream
docker compose exec -T api node --input-type=module < deploy/check-resources.mjs
sh deploy/check-server.sh
```

The resource probe prints structured free-space/free-percent readings for both
data and backup filesystems, database/WAL sizes, and verified backup state.
It exits `0` only when backup health is good and both filesystems have at
least **1 GiB and 10%** free. Exit `2` means pressure/degraded backup; exit `1`
means the check could not run. The wrapper exits `1` for any failure.
Missing/inaccessible storage is an error, never a healthy default.
Thresholds can be overridden with `RESOURCE_MIN_FREE_BYTES` and
`RESOURCE_MIN_FREE_PERCENT`; choose earlier warnings for larger databases.
No automatic deletion, VACUUM, restore, or restart is performed.

Inspect database/WAL trends and restart counts with host access:

```sh
docker inspect --format '{{.RestartCount}} {{.State.OOMKilled}}' "$(docker compose ps -q api)"
df -h /your/project/data /your/actual/backup/directory
du -sh /your/project/data /your/actual/backup/directory
```

Monitor the **host Docker filesystem too**, including image/build caches and
other containers; these may differ from API mounts. Retain several multiples
of the live database size for snapshots, uploads, pre-restore safety copies,
WAL and staging. Never prune backups/build caches automatically based on one
probe. Ordinary admins can create/list backups in Admin Settings; Docker stats,
mounts, scheduling and capacity planning require the host operator.

#### Independent, no-subscription monitoring setup

For optional remote dashboard access and deferred Discord/mobile delivery, see
the [monitoring access and future notification plan](https://github.com/GearDuckDev/FlockSync/blob/main/docs/MONITORING-NOTIFICATIONS-PLAN.md).
Protect the monitor's dashboard separately; do not put browser-only Access
authentication in front of FlockSync's public health probes.

This is operator-owned setup, not an automatically activated FlockSync service.
Use an existing machine on a **different host/network/power connection**, or
an available free external monitor. Do not purchase hosting or subscriptions
as part of this setup. Without an independent running monitor and a tested
notification destination, there are **no outage alerts**.

One free self-hosted option is [Uptime Kuma](https://github.com/louislam/uptime-kuma);
follow its current installation guide on that independent machine. Do not add it
to the FlockSync Compose stack or expose an unsecured monitor admin port.

1. Create an HTTPS monitor for `https://YOUR-HOSTNAME/ready`. Require status
   `200` and, if supported, the expected `status: ok` JSON. Use a 60-second
   interval, 10-second timeout, two retries (three consecutive failures), and
   recovery notifications. Do not challenge the monitor with browser-only
   Cloudflare Access; it checks public availability just like the desktop.
2. Configure a notification destination included at no charge in your chosen
   setup (for example an existing self-hosted Gotify instance or a free
   supported messaging integration). Keep its credentials private and send a
   test notification. Merely saving a notification method is not acceptance.
3. Add a **Push/heartbeat** monitor for host resource/backup checks, expecting
   a report every five minutes with sufficient grace (for example ten minutes).
   Missing heartbeats must alert as well as explicit down reports.
4. On the FlockSync host, store only that heartbeat's base endpoint in a
   root-owned curl config outside the checkout, mode `600`:
   ```text
   url = "https://YOUR-MONITOR/api/push/PRIVATE-TOKEN"
   ```
   Omit prefilled query parameters: the wrapper supplies `status` and `msg`.
   Treat the endpoint token as a secret. Do not commit it or put it in chat,
   shell history, public screenshots, or packaged configuration.
5. Test the wrapper privately with `MONITOR_CURL_CONFIG` pointing to that file.
   If using NAS storage, also set `BACKUP_MOUNTPOINT` to its actual mountpoint.
   The wrapper sends only a generic up/down message, never disk paths, JWTs,
   backup filenames or account data. Curl timeouts/failures are explicit errors.
6. After approval, schedule it under the host's service account/root every five
   minutes, using the **actual project path**, for example:
   ```cron
   */5 * * * * cd /srv/flocksync && MONITOR_CURL_CONFIG=/etc/flocksync-monitor.conf BACKUP_MOUNTPOINT=/mnt/your-backup-mount sh deploy/check-server.sh 2>&1 | logger -t flocksync-resources
   ```
   Ensure cron has Docker/curl/mountpoint permissions/PATH, and that host
   syslog/journal retention is bounded. For local backup storage, omit
   `BACKUP_MOUNTPOINT`. Alert delivery uses the monitor, not cron email.
7. Test a deliberately high free-space threshold on staging:
   `RESOURCE_MIN_FREE_BYTES=9000000000000000 sh deploy/check-server.sh`.
   Expect a degraded result, down heartbeat, and received notification.
   Restore normal thresholds and confirm recovery. Simulate a missed heartbeat
   and an HTTPS outage on an approved staging monitor, not by stopping production.
8. Record actual notification receipt, failure/recovery timing, monitor location,
   and scheduled execution (no secrets). These manual checks remain required.
   A same-host probe/monitor or an asleep laptop cannot guarantee outage alerts.

These are generic infrastructure notifications, not the optional administrator
PWA push feature planned for C4.

### Backups, retention and restore

See [Resource safeguards and monitoring](#resource-safeguards-and-monitoring)
for disk-pressure checks, backup mount identity, and independent outage alerts.

The backup sidecar uses the Alpine 3.24 branch (3.24.4 at the November 5, 2026
validation), with SQLite installed from that branch's package repository.
This changes container tooling, not database paths, backup settings or scheduling.
Keep existing data and backup mounts when upgrading; use the backup-verifying
updater below rather than restarting production solely to test an image.

The Alpine sidecar runs once at startup, then daily at midnight UTC via cron. SQLite's
online `.backup` API takes a consistent snapshot while WAL writes continue.
The source directory is mounted writable so SQLite can create WAL/shared-memory
coordination files even after the API has stopped. The backup command opens the
source database with `-readonly`; it does not change application records. Do not
make this directory mount read-only or delete WAL/shared-memory files manually.
It verifies `PRAGMA quick_check`, renames the temporary file only on success,
and then deletes daily backups older than 30 days. Successful daily runs publish
`flocksync-YYYYMMDD.db`; rerunning on the same day replaces that day's backup
only after validation. Failed backups log an error and leave existing backups
untouched; cron retries at the next daily run. Inspect logs and backup storage contents regularly.
New scheduled snapshots use mode `600` and inherit the live database's UID/GID
so the API can read/restore them without making account hashes world-readable.
Backup storage must permit this ownership change; failure aborts publication
and is logged. Existing backup file ownership is not changed automatically.
Success evidence records the published snapshot's digest after integrity
verification; recording failures are explicit failures, not silent success.

Pre-update backups are published as
`flocksync-pre-update-<UTC timestamp>-<unique suffix>.db` and are not overwritten
by daily runs or deleted by automatic retention. Review/remove these rollback
snapshots manually when no longer needed. They contain the database, not your
production environment file: keep a separate secure configuration backup.

### Admin backup, restore and wipe controls

Admins can manage the live database in **Admin Settings** without stopping the
stack. Backup, restore, and wipe are implemented; the operator reported successful
restore/wipe tests in a smaller private environment. Guild identity from collector
syncs is stored in SQLite and shown in the dashboard header. New backups preserve
it, restore recovers it, and wipe clears it. Older backups need a collector sync
to populate the name after migration.

Server backups are written beneath the mounted `NAS_BACKUP_PATH`; choose
or create a subfolder there as the default destination. The selected folder is
stored in the persistent `data` directory, so it remains in effect across
deployment updates and is also used by scheduled and pre-update backups.
The browser can optionally download a second copy to the admin's device; it
cannot write directly to an arbitrary path on the remote server.
The folder dialog browses the server's mounted volume, not the Windows PC;
`/backups` is the container path mapped to `NAS_BACKUP_PATH`. A native Windows
folder picker cannot select this server destination. Restore choices display
backup dates/times in the browser's local time zone. **Refresh backups** clears
previous success messages and reports the current listing status or error.

Restore defaults to the newest valid backup in the selected server folder. An
admin can instead choose another listed backup or upload a local FlockSync
SQLite backup (maximum 128 MB). The API validates the backup, makes a
pre-restore safety backup, and applies the restore to the running database.
Restoring replaces current application data and user accounts, so log in again
if the selected backup has different credentials. For an offline/manual
recovery, use the stop-and-replace procedure below.

Wiping guild data first saves a
`flocksync-final-<UTC timestamp>-<unique suffix>.db` backup, then clears guild/application records while retaining user
accounts so admins can still sign in. The reset epoch is returned to addon
syncs; characters and ledger entries older than that epoch are rejected, and
the addon clears pre-reset cached data when it receives the marker. Have a
collector sync after the wipe and follow the normal logout -> desktop sync ->
login flow to load the reset marker into the addon.

The source volume is mounted read-only. With a live WAL database, SQLite needs
readable WAL/SHM files already created by the API, which Compose waits for
before starting the backup service. Missing or inaccessible WAL/SHM files cause
an explicit backup failure; the backup never uses `immutable=1`, which could
miss live WAL changes. This does not run a checkpoint or copy raw database files.
backup storage unmounts/network failures must be monitored separately.

For offline/manual recovery, stop the stack, preserve the current database and
its WAL/SHM files elsewhere, put a selected verified backup at
`data/sqlite/flocksync.db`, ensure no old WAL/SHM files remain alongside it,
set ownership to 1000:1000, then start the stack. Never replace a database file
while the API has it open.

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
one-command packaging. See [RELEASES.md](https://github.com/GearDuckDev/FlockSync/blob/main/RELEASES.md) for the full tagging,
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
and an existing remote server ZIP does not update itself after source changes.

1. Regenerate the remote server ZIP with `.\scripts\package-remote-server-deploy.ps1`, copy and extract
   it on the remote server, preserving `.env` and `data`.
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

If desktop sync reports `Failed to parse URL from /api/sync`, set the full
server origin (for example `https://flocksync.example.com`, without `/api`)
in desktop settings and save. Older clients could clear that previously
documented hostname when reloading configuration; install a corrected desktop
build to retain it. Sync watches only `FlockSync.lua`; unrelated addon saves,
temporary files, and AppHelper writes are excluded from file watching.

### Gear and last-seen freshness

The addon saves the logged-in character's own scan regardless of catcher status.
Only officers aggregate other players' guild broadcasts. Equipment changes
capture the affected slot immediately and schedule a broadcast. Logout or
`/reload` captures character metadata while preserving the last valid equipment
snapshot, since inventory APIs may be unavailable during character teardown.
WoW itself writes SavedVariables on reload/logout; addons cannot force a disk
write during normal play. The desktop cannot read unsaved in-game state.
While running and signed in, it automatically syncs changed/replaced
`FlockSync.lua` files after writes settle, including reload, logout, and
character-switch saves. It does not need a manual Sync click for those saves.
Allow the resulting desktop sync to finish, then use **Refresh** on the web
dashboard (it does not currently refresh roster data automatically).
Last seen is the character's game scan time, not the desktop upload time;
uploading an unchanged file must not make an offline character look recently seen.

The desktop accepts both positional and explicitly indexed Lua equipment tables.
Missing or malformed equipment lists fail sync validation instead of being
uploaded as empty gear; a genuinely empty table still records unequipped items.
If an older desktop build uploaded empty gear, install a corrected desktop build,
scan the affected character again in game, log out, wait for successful sync,
and refresh the dashboard. Each affected character needs a fresh scan (collected
by an online catcher for other guild members); a web refresh cannot recover gear
already overwritten by an earlier sync.

When changing characters, gear remains attached to each character's own profile.
Incomplete item-cache results do not replace valid gear. An explicitly reported
unequip still removes that slot, including removal of the final equipped item.

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

### Updating and redeploying the remote server stack

On the development machine, package the current deployment sources:

```powershell
.\scripts\package-remote-server-deploy.ps1
```

Copy `release\FlockSync_Remote_Server_Deploy.zip` to the remote server. There, from the directory
where you keep the deployment, extract it and redeploy while preserving
`data/sqlite`, `.env`, and the mounted backup storage share:

```sh
unzip -o FlockSync_Remote_Server_Deploy.zip
cd FlockSync
sh deploy/update-server.sh
docker compose ps
```

Keep the existing `.env` and `data/sqlite` outside the overwritten
source archive; the ZIP intentionally excludes local secrets and database files.
Keep your own configured tunnel hostname; the source archive does not select
or change it.

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

To verify both CPU architectures with Buildx (requires emulation off the remote server):

```sh
docker buildx build --platform linux/arm64,linux/amd64 -f Dockerfile.api .
docker buildx build --platform linux/arm64,linux/amd64 -f Dockerfile.web .
```

Use `--push -t <registry/image:tag>` to publish multi-platform images, or
`--load` with **one** platform for local smoke tests.
