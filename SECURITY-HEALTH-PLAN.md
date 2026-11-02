# FlockSync Security, Uptime, and Admin Alerts Plan

Status: **Planning**  
Implementation branch: `security-and-health-controls`  
Scope: protect the public API from abuse, improve service/backup visibility, and
give opted-in administrators useful alerts. This plan does not include email.

## Goals and guiding decisions

- Reduce the chance that bots or accidental traffic can exhaust API, CPU, memory,
  database, or disk resources.
- Make public-service and backup failures visible before they become data loss
  or a prolonged outage.
- Keep operator-specific credentials and infrastructure configuration out of
  source control and release artifacts.
- Keep safeguards useful for self-hosted guild servers, not just
  `flocksync.gearduckdev.com`.
- Use mobile PWA push as an optional convenience for events the running server
  detects. Push is best-effort and is **not** the independent monitor for a
  completely unavailable server.
- Do not add email verification or require a third-party monitoring or push
  vendor for core FlockSync operation.

## Current baseline

- Fastify exposes `/health`, but it currently returns a static `{ status: "ok" }`.
- Authentication has public login and self-registration routes. Registration
  performs password hashing; the API currently has no auth-specific rate limit.
- Compose restarts services after exit, but does not define application resource
  limits or a host-level alerting service.
- SQLite backups run at startup and daily, and the update script requires a
  verified pre-update backup.
- The web app is an installable PWA with a registered service worker. The
  service worker currently caches the app shell; it does not subscribe to push
  or display push notifications.
- The deployment routes the public hostname through Cloudflare Tunnel to nginx
  and then to Fastify. Correct client-IP attribution must be verified across
  that entire proxy chain before IP-based limits or audit records are trusted.

## Implementation order

### 1. Protect API entry points

- [ ] Trace the client IP from Cloudflare through `cloudflared`, nginx, and
  Fastify. Configure trusted proxy handling only for known proxy hops; do not
  blindly trust arbitrary `X-Forwarded-For` or client-supplied headers.
- [ ] Add application rate limits for login and registration, applied before
  expensive password hashing/comparison where possible. Consider separate
  limits for other expensive or abuse-prone public endpoints after reviewing
  their cost.
- [ ] Key limits using verified client IP and, where useful, a privacy-safe
  normalized-account key. Do not log passwords, tokens, or raw request bodies.
- [ ] Make limits configurable with validated environment settings and safe
  defaults. Ensure a single abusive account/IP cannot cause a trivial denial
  of service to all users.
- [ ] Return a clear `429` response and `Retry-After` where appropriate. Log
  aggregated limit events without logging secrets; do not send an admin alert
  for every rejected request.
- [ ] Add an operator-controlled way to disable public self-registration
  without disabling existing-account login or environment-seeded initial-admin
  setup. Preserve current registration behavior by default unless a reviewed
  security decision chooses otherwise.
- [ ] Document optional Cloudflare edge rate limiting/WAF rules as an additional
  layer, not a requirement for the API's own protections. Keep rules
  self-hosting-aware and avoid assuming every operator has identical Cloudflare
  products or plan features.

**Acceptance checks**

- Automated tests prove limits apply to login and registration, return the
  expected status/headers, expire/reset as designed, and do not break a normal
  login or registration.
- Tests cover spoofed forwarding headers and verify that a client cannot evade
  limits by choosing its own IP header.
- Test repeated requests against a disposable test server/database; do not
  test against production.
- Existing accounts, admin-created accounts, and initial-admin seeding continue
  to work when public registration is disabled.

### 2. Make health and backup state observable

- [ ] Separate basic liveness from readiness. Keep the public liveness response
  minimal; readiness should verify only dependencies needed to serve requests
  (including a small SQLite operation), with no secrets or infrastructure
  details in public output.
- [ ] Keep container health checks aligned with those semantics so an
  unhealthy dependency is distinguishable from a process that is simply
  running.
- [ ] Define a reliable backup-health signal: record/report the most recent
  successful backup and verification time, and surface a missing, failed, or
  stale backup. A log line or file's existence alone is not proof the backup is
  valid.
- [ ] Show operational diagnostics only to authorized admins (or keep them in
  server logs); do not expose database paths, backup paths, stack traces,
  secrets, or detailed host information publicly.
- [ ] Ensure restart and migration failures remain visible in structured logs.
  Add stable event names for rate limits, readiness failures, and backup
  failures to support log-based alerting.

**Acceptance checks**

- Tests distinguish live-but-not-ready from healthy and verify responses do
  not disclose sensitive configuration.
- Backup tests cover missing, failed, stale, and verified-success cases.
- Existing `/health` consumers and Docker health checks are updated together.

### 3. Add independent monitoring and resource safeguards

- [ ] Configure an uptime check outside the FlockSync host/network against the
  public HTTPS health endpoint. Alert when it fails repeatedly, not on one
  transient probe. This is the monitor that can report a fully down server.
- [ ] Establish a baseline for CPU, memory, container restarts, disk free space,
  SQLite database growth, and backup destination capacity before choosing
  hard limits.
- [ ] Add conservative, documented Compose resource/log safeguards based on
  measured usage. Preserve enough headroom for migrations, backups, database
  restore, and supported ARM64/AMD64 hosts; do not guess a tight memory cap.
- [ ] Document how the operator checks Compose health/logs, Docker resource
  use, SQLite volume space, and backup freshness. Alert on disk pressure and
  failed backups before the filesystem is full.
- [ ] Audit request/body limits and timeouts for costly endpoints. Preserve
  explicitly larger, bounded payload needs such as database restore and
  officer sync; do not apply a blanket limit that breaks valid use.
- [ ] Keep backups on their configured backup storage. Do not silently fall
  back to the database disk when the intended backup mount is missing.

**Acceptance checks**

- Compose configuration validates and container builds pass.
- Run a disposable local deployment/test with representative sync and backup
  activity; confirm limits do not restart healthy services or prevent restore.
- Runbook identifies which checks require host access and which can be done
  from the admin UI.

### 4. Add optional admin push notifications

- [ ] Keep this phase optional and after the API protections and monitoring
  design are stable. Do not treat push as an uptime guarantee.
- [ ] Let an authenticated admin explicitly subscribe a supported browser/PWA
  installation, inspect/manage subscriptions, and unsubscribe. Require a user
  gesture for browser notification permission.
- [ ] Use Web Push with server-held VAPID credentials supplied through validated
  deployment environment configuration. Never include private keys in the web
  bundle, repository, logs, or release artifacts.
- [ ] Store subscriptions against the admin account in SQLite. Treat
  subscription endpoints and keys as sensitive credentials; validate requests,
  authorize subscription management, and remove expired/invalid subscriptions.
- [ ] Extend the existing service worker with a minimal push handler and
  notification-click behavior. Do not cache push payloads or include passwords,
  JWTs, personal data, or sensitive database details in notification text.
- [ ] Start with only actionable events: a verified backup failure/staleness
  threshold, sustained auth-abuse threshold, or critical resource warning.
  Aggregate repeated events, deduplicate them, and apply per-event cooldowns
  to avoid alert floods.
- [ ] If push delivery fails, log it and continue serving the application. Do
  not let notification delivery block login, backups, or health checks.
- [ ] Document platform prerequisites: HTTPS, installed/permission-enabled PWA,
  browser/OS support, and best-effort delivery. On iPhone/iPad, web push
  requires the web app to be added to the Home Screen and a supported OS
  version; exact platform support should be rechecked at implementation time.
- [ ] Keep a separate external uptime monitor for total outage detection.

**Acceptance checks**

- Tests cover authenticated subscription ownership, authorization, duplicate
  subscriptions, unsubscribe, invalid/expired endpoints, send failures,
  deduplication, and cooldowns.
- Service-worker tests or focused manual checks verify notification display
  and click behavior with the page closed.
- Verify on supported Android and iOS devices before claiming mobile push
  acceptance. Push delivery must remain non-blocking if a platform rejects a
  notification.

### 5. Release and operator handoff

- [ ] Update deployment/environment examples and the deployment guide for
  every new setting and operational procedure. Never include real credentials.
- [ ] Add regression tests for all behavior changes and run
  `pnpm --filter @flocksync/api test:production`,
  `pnpm --filter @flocksync/api test:updates`, and `pnpm run typecheck`.
- [ ] Build only affected packages and validate changed Docker/Compose
  configuration. Rebuild the remote-server deployment ZIP after API/web source
  changes.
- [ ] Provide separate maintainer checklists for local/disposable tests,
  server-operator setup, and device-dependent push tests.
- [ ] Do not deploy to production, publish artifacts, or change component
  versions as part of implementation unless separately requested and ready.

## Security and reliability constraints

- No secrets, tokens, push endpoints, or passwords in logs or notification text.
- No request-by-request push alerts. Apply thresholds, deduplication, and
  cooldowns.
- Do not rely on browser push for total outage detection; the application may be
  unavailable when an alert is needed.
- Do not use a self-hosted mail server or make email a dependency.
- Do not expose detailed health, backup, or host diagnostics to unauthenticated
  users.
- Keep API safeguards functional even when Cloudflare-specific protections or
  browser notifications are unavailable.

## Decisions to revisit during implementation

- Rate-limit values and window lengths after reviewing expected guild usage
  and testing through the actual proxy chain.
- Whether public registration should remain enabled by default, and the exact
  operator configuration name/default.
- Which health data belongs in an admin-only view versus logs.
- Resource limits after collecting representative deployment measurements.
- Which admin events justify push alerts and their thresholds/cooldowns.
- Whether push credentials are required only when push is enabled or can be
  omitted with the feature disabled (recommended: optional).
