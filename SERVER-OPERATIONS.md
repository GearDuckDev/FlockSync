# Server operations

This guide is for any operator's Linux Docker installation. Run commands from
your extracted `FlockSync` project directory. Example hostnames and paths are
placeholders, not a connection to a maintainer's server.

For first installation, follow [DEPLOYMENT.md](./DEPLOYMENT.md). Configure your
own `.env`, domain/tunnel, initial administrator credentials, and writable
backup directory. Live SQLite belongs on local persistent storage; a NAS is
optional and is used only for backups. No monitoring service or custom systemd
unit is installed automatically.

## Read-only status checks

```sh
docker compose ps
docker compose logs --tail 60 api web db-backup cloudflared
docker compose exec web wget -qO- http://127.0.0.1/ready
```

Expect healthy API/web and readiness JSON `{"status":"ok"}`. Public readiness
can also be checked at `https://flocksync.example.com/ready` after substituting
your hostname. Readiness checks SQLite, not backup freshness or alert delivery.

Check disk and verified backup health without sending notifications:

```sh
MONITOR_CURL_CONFIG= sh deploy/check-server.sh
printf 'Check exit code: %s\n' "$?"
```

For a mounted backup filesystem, explicitly supply its actual mountpoint:

```sh
MONITOR_CURL_CONFIG= BACKUP_MOUNTPOINT=/mnt/your-backup-mount sh deploy/check-server.sh
```

Expected: `resource_check_ok`, backup `healthy`, exit `0`. A nonzero wrapper exit
means a failed/degraded check or delivery error; inspect the structured output.
No host probe schedule is installed automatically.

## Intentional maintenance

**Stopping services takes the website offline.** If you configured an external
startup/retry timer or supervisor, stop that trigger first so it does not undo
your maintenance. Record its actual unit names in ignored local operator notes.
Do not copy unit names from someone else's installation.

For the standard Compose installation:

```sh
docker compose stop
# When ready to resume:
docker compose up -d --no-build
```

This preserves database files and volumes. Do not use `docker compose down -v`,
delete the database, or restart all of Docker. Resume any custom supervisor
only after checking the required backup mount, readiness, login, and backups.

## Updating an existing installation

1. Stage and inspect the new source archive. Preserve your `.env`, `data`,
   independent backups, optional `docker-compose.override.yml`, and any custom
   host services/timers. Do not overwrite working settings with example values.
2. Verify the intended backup storage is mounted and writable by the API user.
   If `BACKUP_STORAGE_ID` is enabled, verify its matching
   `.flocksync-storage-id` marker on the destination.
3. If an external startup/retry timer is configured, pause only that trigger
   during the update. Do not stop an active mount-dependent service merely to
   pause retries: its stop action may take the application down.
4. From the deployed project directory, run:
   ```sh
   sh deploy/update-server.sh
   ```
   It verifies a fresh pre-update backup before rebuilding/recreating API/web.
   Expect a brief interruption. On failure, inspect the error; never bypass
   the backup guard or automatically restore just because an update failed.
5. Verify readiness, login, collector sync, fresh backup health, and any local
   monitoring. Re-enable paused startup/retry automation only after success.

Fresh installation uses `docker compose up -d --build` after following the
deployment guide; the update script is for a server with an existing database.

## Optional mounted-storage startup

Operators using network backup storage must arrange mount-before-application
startup for their own host. This repository does not ship a configured
`fstab`, systemd service/timer, NAS address, storage credentials, or restart
override.

If configuring a mount-dependent supervisor, coordinate Docker restart policies
with it. A retry timer should retry failed/inactive startup, not restart an
already-active service. Preserve custom units and overrides across source
updates and test dependency refusal/recovery in an approved maintenance window.

A mounted NFS share can remain marked active during an outage. A startup marker
or successful simulated dependency test does not certify real NFS recovery or
protection against hard-mount hangs.

## Optional monitoring

Configure Uptime Kuma or another monitor independently for your own server.
Keep its dashboard private or behind authenticated access; do not publish
unauthenticated diagnostics. Test receipt before claiming alerts work.
Notifications are not enabled by this release.

Monitoring on the application host cannot independently detect that host's
complete power/network loss. External receivers and resource-check scheduling
require separate operator setup.

Keep actual hostnames, mount inventories, identities, access policies, and
local troubleshooting records in ignored `*.local.md` files, not public guides.
Inspect logs privately and redact sensitive details before sharing them.
