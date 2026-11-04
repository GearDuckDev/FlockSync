# Server operations: Pi, NAS, and Uptime Kuma

**Normal operation: leave FlockSync and its startup timer running. Do not run
the stop commands unless you intentionally want the website offline.**

This is the operator quick reference for the configured Pi installation.
Commands below run in the **Pi's Linux terminal**, not Windows PowerShell.
These host-specific services are not automatically installed by FlockSync.

## Open the dashboards

- FlockSync: https://flocksync.gearduckdev.com
- Uptime Kuma: https://kuma.gearduckdev.com

Kuma requires Cloudflare Access authentication and then its own login.
No SSH tunnel is required for the remote URL. Notifications are currently
deferred: a green monitor does not mean alerts will be sent.

## Check status without changing anything

```sh
systemctl is-active flocksync-nas.service flocksync-nas.timer
systemctl list-timers --all flocksync-nas.timer --no-pager
cd /home/john/FlockSync
docker compose --env-file .env ps
curl --silent --show-error --max-time 15 https://flocksync.gearduckdev.com/ready
printf '\n'
```

Expected: service and timer `active`, healthy API/web, and readiness JSON
`{"status":"ok"}`. NEXT may be blank while the startup service is active.
The oneshot service may display
`active (exited)` normally; that is not continuous container-health monitoring.

Check disk space and verified backup health without sending notifications:

```sh
cd /home/john/FlockSync
MONITOR_CURL_CONFIG= BACKUP_MOUNTPOINT=/mnt/nas sh deploy/check-server.sh
printf 'Check exit code: %s\n' "$?"
```

Expected: `resource_check_ok`, backup `healthy`, exit code `0`. A healthy manual
check does not prove that the daily scheduled backup specifically is running.
The host resource-check schedule has not been installed.

## Intentionally stop FlockSync for maintenance

**These commands take the website offline. Stop the timer FIRST**, otherwise
it can attempt to start the service again at the next minute.

```sh
sudo systemctl stop flocksync-nas.timer
sudo systemctl stop flocksync-nas.service
```

This stops FlockSync containers without deleting data or volumes. It does not
stop Docker, Kuma, its separate tunnel, or other applications. Do not use
`docker compose down -v`, delete the database, or restart all of Docker.

Stopping the timer is temporary: it starts again on reboot if enabled.
For maintenance that must survive a reboot, explicitly disable it:

```sh
sudo systemctl disable --now flocksync-nas.timer
sudo systemctl stop flocksync-nas.service
```

## Start or resume FlockSync

Verify the intended Synology filesystem, not just the existence of a directory:

```sh
findmnt -T /mnt/nas/Backup/FlockSync
```

Continue only if this shows the intended Synology NFS share. Then:

```sh
sudo systemctl start flocksync-nas.service
```

Only if that succeeds, enable automatic boot startup/retries:

```sh
sudo systemctl enable --now flocksync-nas.timer
```

Repeat the status, readiness, login, and Kuma checks above. If startup fails,
leave the timer stopped while diagnosing; do not bypass the NAS checks with
direct Compose startup commands.

## Update this NAS-managed installation

Follow [the deployment guide](./DEPLOYMENT.md) for staging, backups, source
verification, configuration preservation, and rollback preparation. Keep the
local `docker-compose.override.yml`: it sets all four FlockSync services to
`restart: on-failure` and must not be overwritten by a future update.

1. Stop **only the timer** to avoid retries during the update:
   ```sh
   sudo systemctl stop flocksync-nas.timer
   ```
2. Verify the NAS mount and preserve `.env`, `data`, the override, and independent
   backups. Apply only the reviewed server source; never copy example settings
   over production secrets.
3. From the project directory, run the backup-protected updater:
   ```sh
   cd /home/john/FlockSync
   sh deploy/update-server.sh
   ```
   It verifies a fresh pre-update backup before rebuilding/recreating API/web.
   Expect a brief interruption. On any failure, keep the timer stopped and
   inspect the error; do not bypass the backup guard.
4. After success, check readiness, website login, fresh backup health, Kuma, and
   restart policies. If the startup service is inactive, use the start/resume
   procedure above rather than leaving startup management inactive.
5. Re-enable the timer only after those checks succeed:
   ```sh
   sudo systemctl enable --now flocksync-nas.timer
   ```

Never restore a database automatically just because an update fails. Preserve
the failed state and safety backups for a deliberate recovery decision.

## Startup configuration and limitations

| Item | Location / behavior |
| --- | --- |
| Project | `/home/john/FlockSync` |
| Local override | `/home/john/FlockSync/docker-compose.override.yml` |
| Startup service | `/etc/systemd/system/flocksync-nas.service` |
| Retry timer | `/etc/systemd/system/flocksync-nas.timer` |
| NAS mount | `/mnt/nas`, generated from `/etc/fstab` |
| Backup destination | `/mnt/nas/Backup/FlockSync` |
| Storage marker | `.flocksync-storage-id` in the backup destination; matches `BACKUP_STORAGE_ID` |

The service waits for the NAS mount and checks its marker before Compose
startup. The timer retries inactive/failed startup every minute; it does not
restart an already-active service. FlockSync uses `on-failure` so Docker can
restart failed processes but does not independently start them on daemon boot.
Kuma and unrelated applications retain separate startup management.

With the oneshot service active (`RemainAfterExit=yes`), the timer can report
`active (running)` with no NEXT time; that alone is not a failure. Defined
failed-service-dependency retries and automatic recovery were operator-tested.
A nonexistent required unit instead failed the timer: diagnose missing unit
files and reset/restart the timer only after correcting that configuration.

A mounted NFS share can remain marked active during a NAS/network outage;
startup ordering and the marker are not continuous NAS availability guarantees.
Actual missing-NAS boot/recovery testing remains pending. Do not unmount the
live NAS or reboot just to test without an approved maintenance window.

## Troubleshooting (read-only)

```sh
systemctl status flocksync-nas.service flocksync-nas.timer --no-pager
sudo journalctl -u flocksync-nas.service -n 60 --no-pager
cd /home/john/FlockSync
docker compose --env-file .env logs --tail 60 api web db-backup cloudflared
```

Inspect logs privately; redact credentials and sensitive details before sharing.
Never post `.env`, tunnel tokens, private backup archives, or notification URLs.

See [the monitoring checkpoint and future notification plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md)
for verified operator checks and deferred Discord/mobile work.
