# Monitoring access and future notifications

Status: notification work **excluded from the security branch by operator request**.
Keep this future plan for a separate task or personal notes. Authenticated remote
dashboard access is working, as reported by the operator on November 3, 2026.
This supplements [the security and health plan](../SECURITY-HEALTH-PLAN.md);
it does not authorize deployment or mark untested acceptance complete.

## Current operator-reported checkpoint

- Kuma runs separately from FlockSync on a Debian 13 ARM64 Raspberry Pi.
- Its persistent local Docker volume is `flocksync-monitor-data`.
- Its dashboard is published only on Pi localhost: `127.0.0.1:3301`, forwarding
  to container port `3001`. SSH local forwarding remains a maintenance fallback.
- A separate `flocksync-monitor-tunnel` connector shares the dedicated
  `flocksync-monitor-net` network with Kuma. Its origin is `http://kuma:3001`;
  FlockSync's existing connector was not changed during this setup.
- The dedicated remote hostname is protected by Cloudflare Access with an
  exact-email owner Allow policy and Kuma's own login. The operator reported
  successful Access authentication, Kuma login, and dashboard access from a
  PC and then a phone using cellular data. The operator subsequently confirmed
  that the approved login requires MFA and incorrect identities are denied at
  both Cloudflare and Kuma. On November 4, the application screenshot showed
  the dedicated hostname with a blank path and one Allow policy. The operator
  confirmed an exact-email allowlist, an eight-hour session duration, and
  required reauthentication the following day. This confirms observed session
  expiry, not a precisely measured eight-hour boundary or absence of alternate
  routes. The operator subsequently confirmed that fresh private-window
  requests to `/`, `/dashboard`, and `/status` required Access, and dashboard
  monitor results updated without manually refreshing.
- The kernel memory controller was enabled and the running container reports
  `memory.max=1073741824` and `memory.swap.max=0` (1 GiB, no extra swap).
- The operator deployed the updated server using `deploy/update-server.sh`
  after a successful manual NAS backup, source/configuration rollback archive,
  staged Compose validation, and network-overlap checks. The updater completed
  its pre-update backup and ARM64 API/web builds; API/web reported healthy.
- Public `/ready` now returns HTTP `200` with JSON content type. After the
  instructed switch from `/health` to `/ready`, the operator reported Kuma's
  JSON readiness monitor green. The operator also confirmed website login,
  dashboard loading, and a fresh server backup saved/listed on Synology NFS.
  These checks do not certify sustained load or restore recovery.
- The operator subsequently verified actual cgroup v2 limits for API, web,
  tunnel, and backup: respectively 2 GiB/2 CPUs/128 tasks,
  256 MiB/1 CPU/128 tasks, 256 MiB/1 CPU/128 tasks, and
  512 MiB/1 CPU/64 tasks, all with zero additional swap.
- A manual host probe with `/mnt/nas` mount checking and notification delivery
  disabled returned `resource_check_ok`, verified backup status `healthy`,
  no disk pressure, and exit code `0`. This is a point-in-time check, not
  evidence of a working host schedule, future daily backups, or mount ordering.
- The operator created the backup storage marker on the verified Synology
  mount, confirmed both writers could read it, and enabled matching
  `BACKUP_STORAGE_ID` settings. After the backup-protected updater, both
  running containers reported the expected identifier; a fresh manual backup
  and resource/backup probe succeeded. Missing-mount behavior has not been
  tested on this host.
- The operator installed a FlockSync-only NAS-dependent systemd service and
  minute retry timer definition, plus a local Compose override using
  `on-failure`. The service was confirmed active and all four running restart
  policies matched; public readiness succeeded after the timer-enable step.
  The operator subsequently confirmed timer enablement and a scheduled next
  run. Missing-NAS boot/recovery is not tested. See the prominent
  [server operations quick reference](../SERVER-OPERATIONS.md) before stopping
  or updating this NAS-managed installation.
- The operator confirmed the backup container has a `0 0 * * *` cron entry
  and a running `crond -f -l 2` process. The operator subsequently temporarily
  changed the schedule and confirmed cron automatically triggered the backup,
  the backup appeared, and the resource/backup check reported healthy. The
  original `0 0 * * *` schedule was restored and confirmed. This verifies
  scheduled execution without waiting for midnight; it does not guarantee
  future runs if the host, storage, or scheduler becomes unavailable.
- On November 4, 2026, the operator completed a normal Pi reboot with the NAS
  available. After reconnecting, the Synology NFS mount, startup service, and
  retry timer were active; API/web were healthy, public readiness returned
  `{"status":"ok"}`, and Kuma reported green with a 171 ms response time.
  The post-reboot disk/backup probe also returned healthy with exit code `0`.
  Systemd timestamps showed the NAS mount active at 11:30:14 CST, FlockSync's
  main startup command at 11:30:28 CST, and its service active at 11:31:23 CST.
  This verifies normal recovery and mount-before-service startup for that boot,
  not startup with the NAS absent. Other applications were not checked.
- No notification destination, resource heartbeat schedule, or independent
  outage receiver has been accepted. Do not interpret green as alert delivery.
- On November 4, the operator tested a defined, deliberately failing runtime
  service dependency without unmounting the NAS. FlockSync remained stopped;
  the active timer retried at 11:48, 11:49, and 11:50 CST. Changing only that
  dependency to succeed and reloading systemd restored FlockSync automatically,
  without manually starting FlockSync or restarting the timer. Readiness and
  Kuma returned healthy. Both temporary files were removed and the final
  dependency list contained no simulation references.
  An earlier nonexistent-unit simulation caused the timer itself to fail and
  required a reset; it is not evidence of automatic failed-mount recovery.
  The successful test proves failed-service-dependency retries, not actual
  NFS mount failure, hard-mount hangs, or a physical NAS outage.
- Same-Pi monitoring cannot send alerts during its own host/power/network
  failure; another machine on the same LAN still shares some failure risks.
- On November 4, the operator ran the capped disposable resource test on ARM64:
  `C3_LIMITED=1 node --test deploy/test/resources.test.mjs`. It passed in
  56.1 seconds with no failures. The harness asserts sync of 501 synthetic
  characters, backup creation, exact 128 MiB restore through test nginx,
  request guards, healthy API/web, zero restarts/OOM exits, and disk-pressure
  detection. A pasted sample showed test API memory at 383.1 MiB of 2 GiB and
  test web at 7.094 MiB of 256 MiB; these samples are not measured peaks.
  The operator observed about 10 ms additional production Kuma response time.
  Test traffic was private/disposable, not sustained public-tunnel traffic.
  The operator subsequently confirmed no test containers, volumes, or networks
  remained for that project. The production disk/backup probe returned
  `resource_check_ok`, backup `healthy`, and exit code `0` after the test.

## Current priority: Cloudflare Access dashboard

The operator selected browser access through Cloudflare Access rather than a
VPN client. Cloudflare is an external access dependency, not a fully local
solution. Check current free-plan eligibility/limits; do not activate a paid
subscription as part of this setup.

Use a dedicated hostname, for example `kuma.YOUR-DOMAIN`, separate from
FlockSync's public application/API hostname.

1. Before publishing a tunnel route, create a self-hosted Access application
   for that exact hostname, covering all paths.
2. Create an Allow policy for explicitly approved owner identities only.
   Never use Everyone, a broad email-domain allowance, or a Bypass policy.
   Choose an available identity provider and enforce MFA there or through
   supported Access settings. Email one-time codes, if chosen, are an Access
   login method, not FlockSync account email functionality.
3. Keep Kuma's own administrator login enabled. Access authenticates entry;
   it does not replace Kuma accounts. Use a bounded Access session duration.
4. Inspect the active connector's networking before choosing its origin.
   A host-native connector can reach `http://127.0.0.1:3301`; a bridge-network
   container's `127.0.0.1` refers to itself, not the Pi.
   Do not blindly use localhost as a Docker connector origin.
5. Select an isolated connector path without changing FlockSync's trusted
   proxy networks or publishing Kuma on all host interfaces. Options include a
   separately managed host connector reaching loopback, or a dedicated private
   Docker network shared only by Kuma and its connector. Review the chosen
   configuration before changing services; never run two copies of the same
   tunnel with inconsistent origin reachability.
6. Publish only after the Access policy exists. Validate that unauthenticated
   requests reach Access rather than Kuma, an unapproved identity is denied,
   and the approved owner reaches Kuma's login and working dashboard.
7. Test from cellular or another outside network, including dashboard live
   updates/WebSockets and session expiry. Verify no router port forwarding or
   alternate unprotected hostname exposes the dashboard.
8. Retain the SSH route as a private maintenance fallback. Document rollback:
   remove the dedicated public route/DNS if needed, retain Access protection,
   and leave Kuma's volume, monitors, and FlockSync untouched.

Do not put Access on FlockSync's public `/health` or `/ready` probes. Do not
create a public bypass to Kuma's heartbeat route as a shortcut. A future host
probe can use a reviewed private route or a separate machine-auth policy with
protected credentials; browser sessions are not unattended authentication.

Reference: [Cloudflare self-hosted Access application setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

## Future first notification destination: Discord

Prefer Kuma's built-in Discord notification integration for one-way alerts.
A Discord webhook is not a custom bot and does not need a bot process, broad
server permissions, or a FlockSync account. Discord remains an external service.

When this work is resumed:

1. Create a private operator alerts channel. Restrict channel access and
   webhook management to intended administrators.
2. Create an incoming webhook for that channel and store its URL only in
   Kuma's private notification settings. Treat it as a sending credential:
   never paste it into chat, source, logs, screenshots, or release artifacts.
3. Add a Discord notification method in Kuma, attach it to the intended
   monitors, and send a test. Verify actual receipt, not just a success banner.
4. Use a disposable failing monitor to verify failure and recovery delivery;
   never stop production just to test alerts. Keep retries to avoid transient
   alert floods and disable unwanted mass mentions.
5. Add resource/verified-backup and missed-heartbeat alerts only after the
   newer server tools and schedule are deployed and tested.
6. Test receiver failure without blocking API requests or backups. Document
   webhook rotation/removal and retention of Kuma's private settings.

If interactive commands or acknowledgements are later required, plan a real
Discord bot separately: least-privilege permissions, protected bot token,
authorized guild/channel/user checks, and read-only commands first. Do not add
database restore, shell execution, or other privileged actions implicitly.

## Future mobile destinations

- Android: consider self-hosted ntfy, with authentication, private topics,
  HTTPS or VPN access, persistent storage, and a tested background connection.
  Verify locked-screen receipt and battery/notification permissions; force-stop
  and offline behavior must not be presented as reliable delivery.
- iPhone/iPad: recheck ntfy or Web Push prerequisites when implemented. Prompt
  background delivery generally involves platform push services and possibly
  an upstream relay. Do not promise entirely local closed-app delivery.
- FlockSync administrator/PWA subscriptions are a separate future feature.
  If implemented, require authenticated admin ownership, explicit permission,
  unsubscribe/expired-subscription cleanup, and private server-held VAPID keys.
  Validate subscription data, deduplicate/cool down events, and keep delivery
  non-blocking. Test service-worker display/click behavior, authorization,
  failures, and actual Android/iOS receipt. Infrastructure alerts must not
  require adding that feature.

Reference: [ntfy phone delivery documentation](https://docs.ntfy.sh/subscribe/phone/).

## Portable contracts and pending acceptance

Keep HTTP/JSON probes separate from destination-specific senders:

- `/health`: process liveness, HTTP `200` with `{"status":"ok"}`.
- `/ready`: SQLite readiness, expected JSON with `200` or `503`; reject HTML
  and redirects rather than accepting any HTTP `200`.
- Admin backup diagnostics remain authenticated; degraded backup states may
  use HTTP `200`, so inspect their JSON status.
- Current resource sender uses Kuma's push API: URL-encoded `status=up|down`
  and generic `msg`, with HTTP success and JSON `{"ok":true}` acknowledgement.
  It is not a universal Discord/ntfy/other-provider webhook.
- Keep detailed paths, account data, JWTs, and secrets out of messages.
  Receiver-specific adapters need explicit failure handling and timeouts.
- Protocols are architecture-neutral; the current `sh`/cron/Docker host wrapper
  targets Linux, not native Windows/macOS. Validate ARM64 behavior on the Pi.

Acceptance (operator-reported checks are distinct from automated evidence):

- [x] Unauthenticated browser entry displays the Cloudflare Access gate.
- [x] Approved owner passes Access and reaches Kuma's login/dashboard.
- [x] Remote dashboard access works from a phone using cellular data.
- [x] Unapproved identities are denied at Cloudflare and Kuma.
- [x] Access application configuration covers the whole Kuma hostname with an
  exact-email allowlist and an eight-hour session duration.
- [x] Session expiry prompts reauthentication, as observed by the operator.
- [x] Unauthenticated probes to multiple Kuma paths require Access.
- [x] Dashboard live updates are explicitly tested without a manual refresh.
- [x] Approved remote login requires MFA, confirmed by the operator.
- [x] Reviewed Docker bindings are localhost-only; the operator confirmed no
  router forwarding or other unprotected tunnel hostname routes to Kuma.
- [x] Updated server deploys on ARM64 and public readiness monitor is green.
- [x] Updated website login/dashboard and manual Synology backup succeed.
- [x] Running FlockSync container resource limits are verified in the kernel.
- [x] Capped disposable sync/backup/128 MiB restore and request-guard workload
  passes on the operator's ARM64 Pi without reported production disruption.
- [x] Manual disk/verified-backup probe with NAS mount check exits successfully.
- [x] Storage identity is configured in both running backup writers and the
  configured deployment passes manual backup/probe checks.
- [x] NAS-dependent startup service is active with the intended restart
  policies, and its retry timer is enabled with a scheduled next run.
- [x] Daily midnight-UTC backup cron entry and running scheduler are confirmed.
- [x] Normal reboot with NAS available restores readiness and Kuma, with
  healthy backup evidence and mount-before-service timestamps confirmed.
- [x] Defined failing-service dependency blocks startup, retries automatically,
  and recovers after the dependency succeeds; simulation cleanup is confirmed.
- [ ] Actual NAS mount failure/recovery and NFS hang behavior are tested.
- [x] Cron-triggered backup succeeds at a temporary scheduled time, with healthy
  verification evidence; the original midnight-UTC cron entry is restored.

Future work outside this branch (not incomplete branch acceptance):

- Automated resource/backup heartbeat scheduling and its receiver.
- Discord setup and test/failure/recovery/delivery-failure checks.
- Android/Apple/PWA setup and device delivery tests.
- Independent outage monitoring and alert delivery.

Do not mark these complete from documentation, a green health check, or an
Access policy merely being saved.
