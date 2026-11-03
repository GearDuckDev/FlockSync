# FlockSync Security, Uptime, and Admin Alerts Plan

Status: **In progress — API entry protections implemented**
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
- Do not require paid services, subscriptions, or per-notification fees for this
  work. Use self-hosted tools or free services within their documented limits.
  Existing hosting/tunnel expenses are separate; any paid tunnel upgrade is an
  operator decision, not something FlockSync enables automatically.
- "Cost" in this plan means CPU time, memory, disk I/O, or network traffic, not
  a monetary charge.
- Public registration is enabled by default. Operators may explicitly disable
  it with `PUBLIC_REGISTRATION_ENABLED=false`; omitting the setting or setting
  it to `true` keeps registration enabled.

## Baseline before implementation

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

### Checklist evidence rule

Mark `[x]` only when the entire item is implemented and its required verification
has passed. Split partially completed items rather than marking the whole item
done. Reading code is not proof of runtime behavior; automated tests are not
proof of maintainer/device/production acceptance. Record which evidence exists
and leave untested scenarios unchecked. Reopen an item if later evidence
invalidates it.

### Commit workflow

Commit a small, coherent, verified checkpoint to this feature branch rather
than waiting for the entire project or committing every edit. A branch commit
is a saved development checkpoint, not a release or approval to deploy.

Before calling a checkpoint ready:

1. Finish its implementation, regression tests, related documentation, and
   acceptance checks. Keep incomplete work unchecked and document blockers.
2. Run focused regression tests, `pnpm run typecheck` for code changes, affected
   package builds, and container validation when deployment files change.
   Refresh the relevant test artifact from the final sources.
3. Review the diff for unrelated changes and secrets. Record test evidence and
   clearly separate automated checks from outstanding maintainer acceptance.
4. Report **Ready to commit: C<number> - <name>** in chat, explain the changes
   in plain language, suggest a concise commit message, and list outstanding
   manual tests. If an acceptance gate fails, report **Not ready to commit**
   with the specific blocker instead.
5. Wait for authorization before creating the commit. At authorized commit
   preparation, follow the repository's existing changed-component versioning
   rules, rebuild/retest if versions change, and never bump unchanged
   components solely because they were rebuilt. Documentation-only commits
   need no runtime version bump.
6. After an authorized commit, record its hash and completed checkpoint here.
   Pushing, merging to `main`, tagging, publishing, and production deployment
   require separate authorization.

| ID | Commit after | Required acceptance gate | Suggested commit message |
| --- | --- | --- | --- |
| C1 | Phase 1: API entry protections | Rate-limit/registration tests pass; trusted proxy sources are constrained and proxy-chain spoofing/isolation tests pass; deployment docs and artifact match final sources | Protect sign-in and account creation from excessive requests |
| C2 | Phase 2: health and backup visibility | Liveness/readiness and backup failure/staleness tests pass; public output stays minimal; affected container health checks pass | Show server readiness and backup health |
| C3 | Phase 3: resource safeguards and monitoring setup | Disposable deployment validates limits under representative load; monitoring/runbook is documented; any operator-only setup or acceptance remains explicitly pending | Add resource safeguards and uptime monitoring guidance |
| C4 | Phase 4: optional admin push | Subscription authorization and delivery-failure/cooldown tests pass; service-worker checks pass; device acceptance is reported separately, never assumed | Add optional administrator push alerts |
| C5 | Phase 5: final integration and handoff | Cross-phase regressions pass; final artifacts and numbered operator checklist are verified; unresolved manual checks remain explicit release blockers | Document security and health setup and testing |

**Current checkpoint: Ready to commit: C1 - API entry protections.**
Exact proxy trust, network isolation, regressions, builds, and candidate-archive
verification pass. C1 was saved as commit `2aa961b`. Live visitor separation and
forwarded-header resistance passed on the temporary tunnel on November 2, 2026;
the remaining operator checks below are not implied complete.

Verified development evidence:

- API production/auth/account/database/theme regressions: **9/9 passed**.
- API update regressions: **14/14 passed**.
- Deployment/backup regressions, including production Compose configuration:
  **6/6 passed**.
- Disposable Compose proxy-trust/isolation integration: **1/1 passed**;
  nginx configuration validation passed within that test.
- `pnpm run typecheck`: passed across the workspace.
- Final API/web Docker images: built successfully on local Linux AMD64.
  ARM64 execution is not certified by these local builds.
- Rebuilt `release\FlockSync_Remote_Server_Deploy.zip`: all **193** archived
  files matched their current source hashes, required proxy/auth files were
  present, obsolete nginx config absent, and no real environment files,
  databases, dependencies, or build outputs were included.
- `git diff --check`: passed. Test containers/networks and package staging
  were removed; temporary API servers stopped. No root `.env` was created.

Suggested commit message: **Protect sign-in and account creation from excessive
requests**. Wait for authorization, then prepare changed-component versions
under the existing versioning policy and refresh affected validation/artifacts.

### 1. Protect API entry points

- [x] Constrain nginx to the exact connector IP and Fastify to the exact nginx
  IP on separate Compose networks. Test the connector-to-nginx-to-API path
  with an emulated connector, not arbitrary forwarded headers.
- [x] Verify visitor attribution through an approved live Cloudflare tunnel.
  On November 2, 2026, the operator reported PC attempt four was rate-limited
  while the phone's first cellular attempt returned invalid credentials.
  API logs contained two distinct login client addresses (not recorded here).
  Automated requests through the test HTTPS hostname returned `401` three times,
  then `429` with positive `Retry-After`. Changing `X-Forwarded-For` and
  `X-Real-IP` still returned application `429`; a forged `CF-Connecting-IP`
  received a Cloudflare `403` block page, not an application response.
  No forged documentation-range addresses appeared as API login client IPs.
- [x] Add application rate limits for login and registration, applied before
  password hashing/comparison using the rate-limit plugin's `onRequest` hook.
- [x] Review other expensive or abuse-prone public endpoints and decide whether
  separate limits are needed based on CPU, memory, disk I/O, and network usage.
- [x] Key limits using locally verified client IP and, where useful, a privacy-safe
  normalized-account key. Do not log passwords, tokens, or raw request bodies.
- [x] Make limits configurable with validated environment settings and defaults.
- [x] Verify distinct clients have separate allowances through the local proxy chain,
  including resistance to forged client-IP headers. Document shared-public-IP
  limitations; per-IP limiting alone cannot guarantee uptime.
- [x] Return a clear `429` response and `Retry-After` where appropriate.
- [x] Implement rate-limit warning sampling with at most one added warning per
  auth endpoint per minute, without explicit IP/account fields or push alerts.
- [x] Test warning cooldown behavior and added warning fields. Current warnings sample
  events, not aggregate counts; ordinary Fastify request logs remain enabled.
- [x] Add an operator-controlled way to disable public self-registration
  without disabling existing-account login or environment-seeded initial-admin
  setup. Public registration must default to enabled
  (`PUBLIC_REGISTRATION_ENABLED=true`); disabling it requires the operator to
  explicitly set `PUBLIC_REGISTRATION_ENABLED=false`.
- [x] Mention optional Cloudflare edge rules as an additional layer in deployment
  documentation.
- [x] Document actionable optional Cloudflare rate-limit/WAF setup using
  available free features, without assuming identical provider plans.

**Acceptance checks**

- [x] Automated tests prove limits apply to login and registration, return the
  expected status/headers, expire/reset as designed, and do not break a normal
  login or registration.
- [x] Tests cover spoofed forwarding headers throughout the local proxy chain and
  verify that a client cannot evade limits by choosing its own IP header.
  verify network isolation. Cloudflare-supplied headers are emulated, not live.
- [x] Test repeated requests against a disposable test server/database; do not
  test against production.
- [x] Initial-admin seeding and that account's login after restart pass with
  public registration disabled.
- [x] Test admin-created accounts and their login with public registration
  disabled, including a non-admin account created before disabling it.

The login/register limits are currently in-memory and assume the documented
single API instance. A future multi-instance deployment needs a shared rate-limit
store before scaling out. Added rate-limit warnings are sampled to at most one
event per auth endpoint per minute without explicit IP/account fields; ordinary
Fastify request logs still contain request details and are not globally sampled.

Public-endpoint review: login/register perform password/database work and are
limited before parsing/hashing. `/health` is currently a small static response;
SPA assets are served by nginx. Other registered API routes require JWT
authentication, with role checks where appropriate. No further public-route
limits are added in C1. Body parsing occurs before existing `preHandler` auth,
so large unauthenticated payloads still need the phase 3 body/timeout audit.
Account-key lockouts are not added: attackers could otherwise lock a targeted
account. Distributed clients and rotating IPv6 addresses remain limitations.

### C1 maintainer test handoff

**Candidate:** `release\FlockSync_Remote_Server_Deploy.zip`, development build
from this branch, not a published release. Component versions are intentionally
unchanged until authorized commit preparation. No addons/desktop reinstall is
needed for C1.

**Possible now, without production or game data**

1. From this checkout with Docker Desktop running, build the disposable images:
   `docker build -f Dockerfile.api -t flocksync-api:c1-tests .` and
   `docker build -f Dockerfile.web -t flocksync-web:c1-tests .`.
   Do not copy production secrets or SavedVariables into the checkout.
2. Run `node --test deploy\test\proxyTrust.test.mjs`. It uses temporary database
   storage, placeholder credentials, no tunnel connection or host ports, and
   separately allocated test networks. Expect one passing test covering IPv4,
   IPv6, separate quotas, header spoofing, malformed/list headers, and network
   isolation. An overlap error is a test-network conflict, not a reason to
   modify a live network.
3. Run `pnpm --filter @flocksync/api test:production`,
   `pnpm --filter @flocksync/api test:updates`, and `pnpm run typecheck`.
   Expect no failures. API tests start/stop temporary local servers/databases.
   These are not persistent browser URLs.
4. Cleanup is automatic for those tests; report the failing test, command,
   status/error, and any leftover `flocksync-proxy-test-*` project if cleanup
   fails. Never include tokens, real credentials, or database files.

**Deferred operator acceptance / distribution blockers**

1. With explicit approval, use a separate staging host/project, staging tunnel
   and hostname, independent test accounts/database, and verified backup
   storage. Extract the candidate into a new directory; preserve the deployed
   `.env` and data untouched. Check subnet overlap before startup.
2. Through the real staging HTTPS hostname, confirm browser and desktop login,
   default registration, admin-created accounts when signup is disabled, and
   `/health`. Two genuinely different public IPs must have separate allowances;
   clients behind one public IP share limits. Send forged forwarding headers
   only to this approved staging environment; they must not reset allowances.
3. If enabling the optional edge rule, follow [DEPLOYMENT.md](./DEPLOYMENT.md#optional-free-edge-protection);
   confirm no browser challenge breaks desktop requests. Report the browser/
   desktop versions, statuses, Retry-After, edge settings (no secrets), and logs
   with sensitive values removed.
4. Stop only the explicitly named staging project and disable/remove its test
   tunnel/rules afterward. Roll back using the saved pre-change sources/config
   and verified backups if needed; do not delete production volumes.

Local tests alone do not prove live edge attribution. The live attribution
check above now passes. On November 2, 2026, the operator also confirmed normal
browser admin login after the limit expired, dashboard access, and opening Admin
Settings through the temporary hostname. The operator also confirmed public
registration, dashboard access, sign-out/subsequent login, and lack of admin
access for the new member account. With public registration disabled, the
operator confirmed signup rejection, existing member/admin login, Admin Settings
access, admin creation of a new MEMBER, and login by that new account.
The operator also confirmed desktop login to the test hostname without issues.
No optional edge rule was tested. The operator confirmed finishing the desktop/
browser restoration steps. The isolated `flocksync-security-live-test` project
was stopped; Docker confirmed no project containers or networks remained.
Test database/backups and the private local environment file were preserved.
On November 2, 2026, the operator confirmed Cloudflare test tunnel/hostname/DNS
cleanup. C1 live acceptance and staging cleanup are complete; no optional edge
rule was enabled or tested. Do not treat this result as full deployment/distribution approval.
No game-specific test is needed for C1; mobile push/device acceptance belongs
to phase 4.

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
  Use a free monitoring service within its free limits or an operator-owned
  independent host; do not require a paid monitoring subscription. A monitor
  on the same host cannot detect that host's total outage.
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
- Which health data belongs in an admin-only view versus logs.
- Resource limits after collecting representative deployment measurements.
- Which admin events justify push alerts and their thresholds/cooldowns.
- Whether push credentials are required only when push is enabled or can be
  omitted with the feature disabled (recommended: optional).
