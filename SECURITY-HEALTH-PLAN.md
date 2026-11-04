# FlockSync Security and Uptime Plan

Status: **C1-C3 deployed and operator checks recorded; C5 handoff and 0.10.0 release preparation ready to commit**
Implementation branch: `security-and-health-controls`  
Scope: protect the public API from abuse, improve service/backup visibility, and
provide operator-owned monitoring. Email and notification delivery are outside
this branch's scope. Future notification details are retained in the
[separate future plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md).

## Goals and guiding decisions

- Reduce the chance that bots or accidental traffic can exhaust API, CPU, memory,
  database, or disk resources.
- Make public-service and backup failures visible before they become data loss
  or a prolonged outage.
- Keep operator-specific credentials and infrastructure configuration out of
  source control and release artifacts.
- Keep safeguards useful for every self-hosted guild server, not just a
  maintainer's deployment.
- Keep Discord, mobile/PWA push, and external alert delivery outside this
  branch's acceptance requirements. Preserve their future plan without
  installing or implementing them. Same-host monitoring is not independent
  outage detection.
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
| C4 | Removed from this branch | Future notifications are documented separately, not an unfinished branch gate | Not applicable |
| C5 | Phase 5: final integration and handoff | Cross-phase regressions pass; final artifacts and numbered operator checklist are verified; unresolved manual checks remain explicit release blockers | Document security and health setup and testing |
| Release | Authorized 0.10.0 preparation after C5 | Changed-component versions aligned; full six-asset package, container builds, regressions, archive/source hashes, and notes verified; publication and final deployment remain separately authorized | Protect sign-in, verify backups, and safeguard server uptime |

**Current checkpoint: Ready to commit: C5 and 0.10.0 release preparation.**
Notifications are excluded from this branch. Operator evidence and remaining
checks are tracked in the [monitoring plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md).
C1 was saved as `2aa961b` (live checks recorded in `6f2753e`), C2 as `32324d0`,
and C3 as `54baa09`. Current uncommitted work includes the C5 documentation,
authorized component-version bumps, release notes, and the packager default.
This checkpoint does not certify real NAS-outage behavior or sustained capacity.

**Historical C1 development checkpoint:**
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

**Ready to commit: C2 - health and backup visibility.** Public
liveness/readiness, admin-only backup diagnostics, and manual/scheduled
verification evidence are implemented. Regression/type/container checks pass.
The deployment ZIP was refreshed and all 200 archived source files matched
current hashes; private environment/data/evidence files and dependencies were
excluded. Disposable test containers/networks/volumes were removed.
No commit, production deployment or version change was performed.
Suggested commit message: **Show server readiness and verified backup health**.
Wait for authorized commit preparation before changed-component version bumps.

- [x] Separate basic liveness from readiness. Keep the public liveness response
  minimal; readiness should verify only dependencies needed to serve requests
  (including a small SQLite operation), with no secrets or infrastructure
  details in public output.
- [x] Keep container health checks aligned with those semantics so an
  unhealthy dependency is distinguishable from a process that is simply
  running.
- [x] Define a reliable backup-health signal: record/report the most recent
  successful backup and verification time, and surface a missing, failed, or
  stale backup. A log line or file's existence alone is not proof the backup is
  valid.
- [x] Show operational diagnostics only to authorized admins (or keep them in
  server logs); do not expose database paths, backup paths, stack traces,
  secrets, or detailed host information publicly.
- [x] Ensure restart and migration failures remain visible in structured logs.
  Add stable event names for rate limits, readiness failures, and backup
  failures to support log-based alerting.

**Acceptance checks**

- [x] Tests distinguish live-but-not-ready from healthy and verify responses do
  not disclose sensitive configuration.
- [x] Backup tests cover missing, failed, stale, and verified-success cases.
- [x] Existing `/health` consumers and Docker health checks are updated together.

Evidence: 10 API production tests, 14 update tests, 6 deployment/backup tests,
1 proxy regression and 1 container health test pass. Workspace typecheck passes.
The final 10-test API production suite passed inside the built Linux container.
Windows reruns encountered the existing random-port account test selecting
reserved ports (`EACCES`); no application failure was hidden or treated as a pass.
API/web/backup images build on local Linux AMD64. Health tests exercise closed
SQLite, corrupt startup database logs, authorization, privacy, exact 36-hour
staleness threshold, manual failure/recovery, malformed/deleted/corrupt backup
evidence, and scheduled evidence read by the non-root API. The container test
also checks snapshot UID 1000 and mode 600. ARM64 and remote operator acceptance
are not claimed.

### C2 maintainer test handoff

1. Keep production and the previous Cloudflare test tunnel stopped/unchanged.
   C2 tests need no real tunnel token, real accounts, or SavedVariables.
2. With Docker Desktop running, from the checkout root build:
   ```powershell
   docker build -f Dockerfile.api -t flocksync-api:c2-tests .
   docker build -f Dockerfile.web -t flocksync-web:c2-tests .
   docker build -f deploy\Dockerfile.backup -t flocksync-backup:update-tests .
   node --test deploy\test\health.test.mjs
   ```
   Expect one passing test. It checks `/ready` through nginx, missing evidence,
   a verified scheduled backup, private ownership, and corruption rejection.
   Its uniquely named project uses temporary Docker volumes, no published
   ports, placeholder settings, and no connector. Cleanup removes only that
   test project's containers/networks/volumes automatically.
3. API tests: `pnpm --filter @flocksync/api test:production`;
   update tests: `pnpm --filter @flocksync/api test:updates`;
   types: `pnpm run typecheck`. These stop their temporary servers afterward.
   If Windows rejects the existing test's random port with `EACCES`, the same
   production suite can run in the built Linux image without host ports:
   ```powershell
   docker run --rm --entrypoint node flocksync-api:c2-tests --test test/production.test.mjs test/users.test.mjs test/themes.test.mjs test/databaseAdmin.test.mjs test/authControls.test.mjs test/health.test.mjs
   ```
4. See [DEPLOYMENT.md](./DEPLOYMENT.md#liveness-readiness-and-backup-diagnostics)
   for states, log events, and the admin-only diagnostic endpoint. No new UI
   panel or automatic alerts are included. A healthy backup is not proof of
   an actual restore or of the daily scheduler specifically.
5. Before any authorized remote rollout, preserve `.env`, live data and
   independent backups; verify backup storage supports the database UID/GID
   and mode 600. Existing snapshots are not automatically re-owned or certified.
   Use the backup-gated updater, then privately inspect logs, `/ready`, normal
   login and a fresh verified backup. Remote rollout/ARM64 checks remain pending
   and do not block saving this verified development checkpoint.

No new paid services, email, push, resource caps or independent monitor are
introduced in C2. Those later-phase checkboxes remain unchanged.

### 3. Add independent monitoring and resource safeguards

#### Local-first monitoring and interoperability decision

Prefer free, operator-owned monitoring over a required hosted subscription.
[Uptime Kuma](https://github.com/louislam/uptime-kuma) is the initial reference
receiver: it supports HTTP/JSON checks, push heartbeats, and notification
integrations. Each installation owns its monitor and notification credentials;
GearDuckDev does not operate a central monitoring service for other servers.
The operator subsequently installed same-Pi Kuma and reported a green public
`/health` JSON monitor and an enforced 1 GiB memory ceiling. This is limited
local monitoring evidence, not independent outage or notification acceptance.
Notifications are now deferred; the current priority is remote dashboard
access through an owner-only Cloudflare Access application. See the
[monitoring access and future notification plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md)
for the operator checkpoint, safe access sequence, future Discord setup, and
remaining acceptance checks.

- Raspberry Pi deployments must use a supported **64-bit Raspberry Pi OS /
  Debian ARM64** installation, consistent with FlockSync's deployment guide.
  Do not assume a Pi implies a 64-bit OS. Before installation, verify the
  selected monitor image's ARM64/AMD64 manifests, supported OS, and available
  memory/storage. Existing local AMD64 tests do not certify the actual Pi.
- A separate local machine can host the monitor without a cloud monitoring
  vendor. Same-Pi monitoring is an optional reduced-coverage setup: it can
  report application/resource failures while the host and receiver still run,
  but cannot send alerts during its own power, OS, or connectivity failure.
  Another machine on the same LAN still shares power/router/Internet risks.
  Keep independent-outage acceptance unchecked unless that coverage is tested.
- Do not add a monitor implicitly to the core Compose stack. Keep optional
  monitoring separately managed, with bounded retention/resources and a
  protected management UI. Do not grant Docker-socket access just for HTTP
  checks; host collectors need a separate least-privilege review.
- Monitoring and phone delivery are separate layers. Kuma can route alerts
  to self-hosted tools such as ntfy/Gotify, but phone support and background
  delivery differ. Android local delivery may require a persistent connection;
  ordinary iOS/Web Push background delivery involves platform push services.
  Do not promise fully local, immediate notifications on every closed phone
  app. Test the chosen device, permissions, VPN/network reachability, and
  failure/recovery receipt before claiming delivery.

Keep the application-facing contract portable:

| Surface | Contract and compatibility boundary |
| --- | --- |
| `GET /health` | Minimal HTTP `200` with `{"status":"ok"}` for process liveness; no monitor-specific dependency. |
| `GET /ready` | HTTP `200` with `{"status":"ok"}` or `503` with `{"status":"unavailable"}` for SQLite readiness. A monitor must reject redirects/login pages and unexpected JSON, not merely accept any successful HTML response. This is not a full end-to-end feature check. |
| `GET /api/admin/health` | Existing authenticated backup diagnostics, including degraded states that can return `200`. Inspect the JSON status, not HTTP alone. Keep this private; do not distribute full administrator JWTs to monitoring vendors. Any future unattended diagnostic credential needs a separately reviewed, read-only scope. |
| Outbound resource/backup heartbeat | Current sender uses Kuma's `GET /api/push/<token>` with URL-encoded `status=up` or `down` and generic `msg`; it requires HTTP success and JSON `{"ok":true}`. This is a Kuma adapter, not a universal webhook protocol. |

Preserve the core probe independently of receiver-specific delivery. Add another
receiver adapter only when needed, using its documented method, authentication,
payload, and acknowledgement; never assume generic JSON is accepted everywhere.
Delivery must remain bounded by timeouts and report failures explicitly. Keep
tokens, paths, account data, and detailed errors out of heartbeat messages.

HTTP/JSON contracts are architecture-neutral and usable by monitors on Linux,
Windows, and macOS where the chosen tool supports them. The existing host
wrapper is **Linux-specific** (`sh`, Docker Compose, `mountpoint`, cron); it is
not a native Windows/macOS agent. Future collectors must map to the same health
semantics without pretending those host commands are portable. Existing automated
probes cover disk/backup health, not continuous host CPU/RAM/restart alerting.
Select and test a bounded host collector if those alerts are required.

Before marking compatibility complete, test actual HTTP/JSON assertions,
explicit down reports, missed heartbeats, rejected acknowledgements, notification
failure/recovery, and the selected ARM64 deployment. Monitor reference:
[installation guide](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install).
Phone-delivery reference:
[ntfy self-hosting and delivery documentation](https://docs.ntfy.sh/config/).

**Historical C3 development checkpoint: resource safeguards and monitoring tools.**
The paragraph below records the original pre-deployment validation. Subsequent
Pi deployment and acceptance evidence is in the linked monitoring plan; the
current checklist below reflects the narrowed, notification-free branch scope.

Development safeguards, synthetic baseline, workload tests, and monitoring
tools/runbook are implemented. All 35 regression tests pass (10 API production,
14 updates, 7 backup/deployment, and one each for container health, proxy trust,
resource workload, and monitor failure handling). Workspace typecheck, affected
API/web/backup image builds, and diff checks pass. The refreshed deployment ZIP
contains 208 files matching current source hashes, excluding private local files.
Disposable project containers/networks/volumes were cleaned up.
No independent monitor or real notification destination was configured, no host
schedule was installed, and production was not touched. Keep these operator
acceptance tasks unchecked.
Suggested commit message: **Add resource safeguards and uptime monitoring tools**.
No commit, version bump, publication or deployment was performed. Authorized
commit preparation must follow existing changed-component versioning rules.

- [x] Configure same-Pi Kuma with protected remote access and a public HTTPS
  JSON readiness monitor. This is reduced-coverage monitoring, not independent
  outage detection. An independent receiver and alert delivery are future work
  outside this branch, retained in the separate notification plan.
- [x] Establish a disposable local baseline for CPU, memory, container restarts, disk free space,
  SQLite database growth, and backup destination capacity before choosing
  hard limits.
- [x] Record an ARM64 idle baseline and run the bounded disposable sync,
  backup, restore, and request-guard workload on the operator's Pi. The test
  passed in about 56 seconds; production Kuma response time changed by about
  10 ms according to the operator. This is not sustained public-tunnel load
  or general production-capacity certification.
- [x] Add conservative, documented Compose resource/log safeguards based on
  measured usage. Preserve enough headroom for migrations, backups, database
  restore, and supported ARM64/AMD64 hosts; do not guess a tight memory cap.
- [x] Document how the operator checks Compose health/logs, Docker resource
  use, SQLite volume space, and backup freshness.
- [x] Implement tested disk/backup probes and optional external heartbeat
  delivery, including explicit probe/mount/delivery failure handling.
- [x] Run the host disk/verified-backup probe manually on the Pi and confirm
  healthy output. Automated resource-probe scheduling and alert delivery remain
  future work outside this branch; no automatic resource alerts are claimed.
- [x] Audit request/body limits and timeouts for costly endpoints. Preserve
  explicitly larger, bounded payload needs such as database restore and
  officer sync; do not apply a blanket limit that breaks valid use.
- [x] Implement an optional storage identity check in API and scheduled/pre-update
  backups; tests reject missing/wrong markers before using a backup destination.
- [x] Configure `BACKUP_STORAGE_ID` on the operator's verified backup filesystem
  and startup mount dependency. Empty settings preserve compatibility but do
  not detect a mounted directory silently falling back to local storage.
- [x] Verify normal reboot recovery and failed-service-dependency retries,
  automatic recovery, and temporary simulation cleanup.
- [x] Verify cron-triggered backup execution at a temporary scheduled time,
  healthy backup evidence, and restoration of the midnight-UTC cron entry,
  as confirmed by the operator.
Actual NAS mount failure/recovery and hard-NFS hang testing are not claimed
passed. The operator elected to proceed on the isolated dependency evidence;
retain this as an untested operational limitation, not an outstanding request
to disrupt the shared NAS. See the operations guide before future outage tests.

**Acceptance checks**

- [x] Compose configuration validates and container builds pass.
- [x] Run a disposable local deployment/test with representative sync and backup
  activity; confirm limits do not restart healthy services or prevent restore.
- [x] Runbook identifies which checks require host access and which can be done
  from the admin UI.

### C3 development evidence and handoff

Local Linux AMD64 baseline used disposable Docker storage, synthetic accounts
and data, no real tunnel or production files. Before caps, the API peaked at
735,100,928 cgroup bytes (about 701 MiB including cache), 22 tasks, and roughly
2.56 CPU-seconds for setup/workload/probes. Final bounded run synced 501
characters with 600 recipe IDs each; its verified backup was 2,183,168 bytes.
An exact 134,217,728-byte SQLite upload restored successfully through nginx.
API peak was 783,192,064 cgroup bytes (about 747 MiB including cache), CPU usage
about 3.88 seconds, and peak tasks 22; API/web had zero restarts/OOM exits.
Web sampled around 14 MiB; scheduled backup peaked at 9,424,896 bytes.
These synthetic fixtures do not model sustained bot floods or every large
database/real-guild workload. Disk free space and database/WAL sizes were also
measured in the test volumes, not on the operator's remote server.

Configured ceilings: API 2 GiB/2 CPUs/128 tasks; nginx 256 MiB/1 CPU/128 tasks;
tunnel 256 MiB/1 CPU/128 tasks; backup 512 MiB/1 CPU/64 tasks. Equal memory/swap
ceilings avoid additional swap. Rotating Docker local logs use 3 x 10 MiB per
container, plus overhead. Builds/host-wide disk use still need operator budgets.

Regression evidence includes early authentication before malformed expensive
bodies, ordinary/auth/sync/upload body ceilings, one-byte-over-limit rejection,
valid 128 MiB restore, concurrent-upload `409` and abort release, storage marker
rejection/recovery, actual probe disk-pressure exit `2`, and mocked
up/down/missing-mount/delivery-rejection paths. Invalid SQLite headers are now
rejected explicitly; the guard test exposed that tiny inputs could otherwise be
treated by SQLite as an empty database during restore.

Reproduce without real credentials/tunnel:

```powershell
docker build -f Dockerfile.api -t flocksync-api:c2-tests -t flocksync-api:c1-tests .
docker build -f Dockerfile.web -t flocksync-web:c2-tests -t flocksync-web:c1-tests .
docker build -f deploy\Dockerfile.backup -t flocksync-backup:update-tests .
$env:C3_LIMITED='1'
node --test deploy\test\resources.test.mjs deploy\test\monitoring.test.mjs deploy\test\updates.test.mjs deploy\test\health.test.mjs deploy\test\proxyTrust.test.mjs
Remove-Item Env:\C3_LIMITED
```

The test fixtures reuse C1/C2 image labels; those are local test names, not
component version bumps. The resource test temporarily creates a 128 MiB
fixture and several snapshots in uniquely named disposable volumes, then removes
only its project. Baseline mode (omit `C3_LIMITED`) disables API/web runtime caps
and sends the large restore directly to API; capped mode verifies nginx too.
API production/update regressions and workspace typecheck must also pass.
Use [the operator runbook](./DEPLOYMENT.md#resource-safeguards-and-monitoring)
for the separate host/monitor setup. Do not point these workload tests at a live
deployment, change real backup mounts, or reuse the retired test tunnel token.
Runtime versions remain unchanged until authorized commit preparation.

### 4. Notifications: removed from this branch

Discord webhook/bot setup, ntfy, administrator/PWA push, notification receivers,
and their delivery tests are not branch completion requirements. Retain the
[future notification plan](./docs/MONITORING-NOTIFICATIONS-PLAN.md) for a separate
task. This is a scope exclusion, not completed notification functionality.

### 5. Release and operator handoff

- [x] Update deployment/environment examples and the deployment guide for
  every new setting and operational procedure. Never include real credentials.
- [x] Add regression tests for all behavior changes and run
  `pnpm --filter @flocksync/api test:production`,
  `pnpm --filter @flocksync/api test:updates`, and `pnpm run typecheck`.
- [x] Build only affected packages and validate changed Docker/Compose
  configuration. Rebuild the remote-server deployment ZIP after API/web source
  changes.
- [x] Provide separate maintainer checklists for local/disposable tests,
  server-operator setup, and the remaining in-scope acceptance checks.
- [x] Keep production changes separately authorized and operator-executed;
  no commit, push, tag, publication, or new version change is authorized by
  this documentation handoff.

### C5 verification and handoff (November 4, 2026)

- Fresh local workspace typecheck passed; API production regressions passed
  10/10 and update regressions passed 14/14. These commands rebuilt API and
  shared types only; unchanged desktop/web packages were not rebuilt.
- Earlier C3 evidence includes container builds and 35 passing regressions.
  The operator subsequently built/deployed API/web/backup on ARM64 and passed
  the capped disposable workload, including 128 MiB restore and request guards.
  Cleanup checks found no remaining test containers, volumes, or networks.
- The refreshed deployment ZIP's 208 source files were hash-verified before
  transfer; the operator verified the ZIP hash and staged Compose configuration
  before using the backup-protected updater. No runtime source changed during
  this documentation handoff, so no additional runtime build is required.
- Operator checks cover protected remote Kuma access, MFA, denied identities,
  expiry, path checks, live updates, exposure review, readiness, manual and
  cron-triggered backups, kernel resource limits, normal reboot ordering, and
  isolated dependency refusal/retry/recovery. Detailed evidence is in the
  [monitoring checkpoint](./docs/MONITORING-NOTIFICATIONS-PLAN.md).
- [Server operations](./SERVER-OPERATIONS.md) is linked prominently from README
  and deployment documentation. It is generic guidance; preserve each host's
  own optional Compose override, systemd service/timer, production environment,
  storage marker, and backups. The ZIP does not install host-specific files.
- Remaining limitations: actual NFS outage/hangs and sustained real-traffic
  capacity are not certified; notifications, automated resource alert delivery,
  and independent outage monitoring are outside branch scope.
- Suggested documentation commit: **Document secure monitoring and safe server maintenance**.
  Documentation needs no runtime version bump. A later combined release must
  follow changed-component versioning and packaging rules separately.

### Authorized 0.10.0 release preparation (November 4, 2026)

This supersedes the earlier documentation-only checkpoint's version hold.
Preparation was authorized; committing, merging, pushing, tagging, publishing,
and applying the final versioned release to production were not.

- [x] Increment API/web 0.6.1 -> 0.7.0 and shared types 0.6.0 -> 0.7.0.
  Keep desktop 0.5.1, addon 0.6.0, AppHelper 0.2.2, and root 0.2.2 unchanged.
- [x] Prepare detailed 0.10.0 notes with upgrade steps, six download choices,
  safety/migration guidance, component versions, stable-channel guidance,
  and explicit limitations. Preserve the maintainer handoff.
- [x] Run the complete release packager: workspace typecheck, API/web builds,
  desktop installer/portable packaging, both addon ZIPs, server source ZIP,
  and generated 0.10.0 manifest all passed.
- [x] Rebuild API/web/backup Docker images on local x86_64 Linux Docker.
  All 11 deployment regressions passed, including capped workload/128 MiB
  restore, proxy trust, readiness, backup evidence/storage identity, and
  update gating. No live stack was started or restarted.
- [x] API production 10/10 and updates 14/14 passed on final versions.
  A Windows-reserved port initially blocked one API startup; isolated and
  full-suite reruns passed. Web tests passed 15/15; desktop passed 21 with
  one opt-in live-network test skipped.
- [x] Verify every archived file against its source: server 208, member addon
  37, collector bundle 39. Confirm expected paths/TOCs, final package versions,
  no private environments/databases/config artifacts or links, and complete
  server source coverage after intentional exclusions. Both EXEs match the
  desktop packaging output and identify version 0.5.1.
- [x] Confirm the release directory contains exactly the six current assets;
  no superseded downloads require removal. Published latest remains v0.9.0;
  no remote v0.10.0 tag existed during preparation.
- Remaining manual checks: packaged installer/portable UI, in-game behavior,
  and final versioned Pi deployment. Physical NAS/NFS outage testing and
  sustained-capacity certification are not claimed. Notifications remain
  excluded. Re-check publication state before creating an authorized release.
- Suggested release commit: **Protect sign-in, verify backups, and safeguard server uptime**.
  The prepared versions are final for this checkpoint; do not bump them again
  solely when committing the same changes.

### Portable distribution follow-up

- Replace instance-specific public runbooks, host inventories, domain examples,
  and editor-library paths with generic guidance. Preserve operator records
  privately outside the repository; public monitoring acceptance starts unchecked
  for every new installation.
- Keep the dependency lockfile and relative workspace links. Broaden Git/package
  exclusions for private environment variants, local overrides/notes, SQLite
  sidecars, data directories, and stale output.
- Include generic deployment/operations guides and the license in the server
  ZIP. It now contains 212 source/document files rather than the earlier 208.
- Two packaging/ignore regressions and four desktop configuration regressions
  passed, including empty URL/auth on fresh desktop setup; workspace typecheck
  passed. Runtime/component versions did not change.
- A new isolated Docker project extracted from the ZIP built API/web/backup
  using the frozen lockfile and new example-derived credentials/settings.
  Empty-database migrations, new administrator login, empty roster, SPA,
  readiness, and verified startup backup all passed without existing instance
  configuration. Test containers/images/networks and temporary data were removed.
- Public DNS/tunnel activation was not tested: operators must provide their own
  Cloudflare account, token, and domain under the documented deployment model.

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
- Notification events, credentials, and delivery belong to the separate
  future notification plan, not implementation on this branch.
