# Monitoring access and future notifications

Status: notification delivery is **outside the security branch's scope**.
This is a portable future plan, not an installed service or acceptance record
for any particular host. Store real deployment details in ignored local notes.
See [the security and health plan](../SECURITY-HEALTH-PLAN.md) and
[server operations](../SERVER-OPERATIONS.md).

## Optional authenticated monitoring access

Uptime Kuma can run independently from FlockSync with its own persistent
storage and resource limits. A NAS, particular Linux distribution, or specific
host model is not required. Measure limits on your own host.

Prefer a private VPN or SSH route. If choosing Cloudflare Access instead,
review current eligibility/limits; it is an external access dependency.
Use a dedicated hostname, such as `kuma.example.com`, separate from the public
FlockSync application.

1. Before publishing a tunnel route, create a self-hosted Access application
   covering the entire monitoring hostname, including live-update paths.
2. Allow only explicitly approved administrator identities. Avoid Everyone,
   broad domain allowances, or Bypass policies. Enforce MFA and a bounded
   session duration, and retain Kuma's own administrator login.
3. Keep the dashboard bound to loopback or an isolated connector network.
   A container's localhost refers to itself, not the host. Choose an origin
   reachable from your connector without exposing an unprotected host port.
4. Do not change FlockSync's trusted proxy networks to attach monitoring.
   Use separate infrastructure and protect its token/credentials outside Git.
5. Test unauthenticated entry, denied identities, approved login, cellular
   access, session expiry, and dashboard live updates. Check that no router
   forwarding or alternate hostname bypasses access protection.
6. Document private fallback access and rollback without removing persistent
   monitor data or weakening authentication.

Do not protect FlockSync's minimal public `/health` or `/ready` probes behind
an interactive login. Do not expose a public monitoring bypass just for a
heartbeat. Machine-authenticated probes require separately reviewed credentials.

Reference: [Cloudflare Access setup](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

## Future first notification destination: Discord

Prefer Kuma's built-in Discord notification integration for one-way alerts.
A webhook is not a custom bot and does not require a bot process or a
FlockSync account. Discord remains an external service.

1. Create a private alerts channel and restrict webhook management.
2. Store the webhook URL only in private notification settings. It is a sending
   credential: never put it in source, logs, screenshots, or release artifacts.
3. Attach the destination to intended monitors and verify actual test receipt.
4. Use a disposable failing monitor to verify failure/recovery delivery without
   stopping production. Configure retries and avoid unwanted mass mentions.
5. Add resource/verified-backup and missed-heartbeat alerts only after their
   probes, private routes, and schedules have been configured and tested.
6. Test receiver failure without blocking API requests or backups; document
   credential rotation and removal.

If interactive commands are wanted later, plan a separate least-privilege bot
with protected credentials and authorized guild/channel/user checks. Do not
implicitly add restore, shell execution, or other privileged actions.

## Future mobile destinations

- Android: consider authenticated self-hosted ntfy with private topics, HTTPS
  or VPN, persistent storage, and a tested background connection. Verify
  locked-screen receipt and battery/notification permissions; force-stop and
  offline behavior must not be presented as reliable delivery.
- iPhone/iPad: recheck ntfy/Web Push prerequisites when implemented. Background
  delivery generally involves platform push services and possibly an upstream
  relay; do not promise fully local closed-app delivery.
- FlockSync admin/PWA subscriptions are a separate feature. Require explicit
  permission, authenticated admin ownership, unsubscribe/expiry cleanup,
  validated subscription data, protected VAPID keys, non-blocking delivery,
  deduplication/cooldowns, and actual Android/iOS device tests.

Reference: [ntfy phone delivery](https://docs.ntfy.sh/subscribe/phone/).

## Probe contracts

- `/health`: process liveness, HTTP `200` and `{"status":"ok"}`.
- `/ready`: SQLite readiness, JSON with `200` or `503`; reject HTML/redirects.
- Admin backup diagnostics require authentication. Degraded states may use
  HTTP `200`, so inspect the JSON state rather than only the status code.
- The optional resource sender uses Kuma's push API, URL-encoded `status` and
  generic `msg`, with HTTP success and JSON `{"ok":true}` acknowledgement.
  It is not a universal Discord/ntfy webhook.
- Keep account data, paths, JWTs, and secrets out of messages. Destination
  adapters need explicit failure handling and timeouts.
- The shell/cron/Docker host wrapper targets Linux; operators validate their
  own architecture, storage, permissions, and kernel resource enforcement.

## Acceptance for each new installation

Nothing below is pre-accepted merely because it worked on another server.

- [ ] Dashboard access is authenticated on every route; unauthorized users fail.
- [ ] Approved remote login, MFA, session expiry, and live updates work.
- [ ] Host bindings and tunnel/router routes expose no authentication bypass.
- [ ] Readiness, login, backups, storage identity, and resource limits pass.
- [ ] Reboot ordering and dependency failure/recovery work on the chosen host.
- [ ] Scheduled backups and resource probes execute and report expected states.
- [ ] Notification tests arrive and failure/recovery messages are observed.
- [ ] Mobile locked-screen/background delivery is tested where applicable.
- [ ] An independent receiver detects loss of the host/network being monitored.

Same-host monitoring cannot alert through its own complete failure. A successful
dependency simulation does not establish real NAS/NFS outage recovery. Keep
actual outage tests controlled and explicitly authorized.
