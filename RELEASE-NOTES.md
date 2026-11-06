## FlockSync 1.0.0

### Shared kill lists and enemy awareness
- Add a player and reason to **Guild Shared** to send both automatically when
  saving. No separate Publish click for new additions. Existing old drafts
  remain private until explicitly published; personal lists never upload.
- Manage published targets through the website Kill List: search, read full
  reasons, edit permitted notes and confirm removal. Officers/admins can manage
  all targets; members can manage targets authored by their linked characters.
  Additions remain in game, not on the website.
- Enable local enemy popups and sound independently, with a 60-second
  per-target cooldown. Optional skulls are local nameplate overlays, not raid
  marks. Friendly players and NPCs do not trigger these features.
- View last-seen zones/times and shared battle history in game and on the
  website. History retains 90 days and up to 5,000 guild battles, with one
  latest sighting per active target. Duplicate reports are combined.
- Record battles only when readable player identities and killing-blow
  evidence are available. Stale recaps, restricted data and ambiguous killers
  are not guessed. Remote reports never trigger local nearby alerts.
- Preserve removals across stale/offline uploads. Re-added targets do not
  inherit the old creation's observations. Personal notes remain independent.

### Whole-player ownership and clearer guild information
- Character Links displays the same friendly-name groups as the roster.
  Officers can assign one website owner to a complete group; future synced alts
  in that group inherit access. Confirmation identifies current characters and
  ownership changes. Check grouping carefully: later grouping changes affect access.
- Members see group-play information for their linked characters; officers
  retain management controls. Ownership changes apply after refresh.
- Updated walkthrough and per-character settings explain sharing, privacy and
  alert controls. Existing saved choices, character paths and data are preserved.

### Upgrade instructions
1. Server operators: preserve deployed environment configuration, local SQLite
   data and independent backups. Verify configured backup storage is mounted
   and writable. Stage the new server source without replacing configuration.
2. Run `sh deploy/update-server.sh` from the deployed project directory. Require
   verified pre-update backup before rebuilding; stop on failure. Never bypass
   safeguards with direct restarts, `docker compose down -v`, or a database wipe.
3. Verify API/web health, `/ready`, normal login, existing roster and Character
   Links. Additive migrations preserve targets/ownership and add observation
   persistence. No wipe or restore is required for this upgrade.
4. Collectors: quit Desktop through its tray icon. Install **1.0.0** or choose
   the portable alternative. Preserve saved server/client settings; use the full
   guild server URL without `/api`. Upgrade server and Desktop together: an old
   server missing observation return data produces a visible sync error.
5. With WoW closed, update the main addon for every participating client.
   Collectors install both addons from the bundle. Extract directly into the
   actual client's `Interface\AddOns`, without extra ZIP folder nesting.
   Preserve SavedVariables; remove unwanted old test entries through the UI.
6. Use logout/exit -> successful Desktop sync -> login for server-returned
   edits and helper data, then automatic guild relay. Every account folder needs
   its own sync. Do not manually overwrite helper files while WoW runs.
7. Review per-character `/fs killoptions`. Kill List defaults off; popup/sound
   default on after opt-in, skull off. Friendly-entry TEST mode is disabled.
   Typed names remain supported without independently proving hostility.

### Download choices
- **FlockSync-Setup-1.0.0-x64.exe:** Windows collector installer.
- **FlockSync-Portable-1.0.0-x64.exe:** portable alternative; choose one Desktop
  download. Builds are unsigned; use normal trust checks, never disable OS protection.
- **FlockSync-Raider-Only.zip:** main addon **1.0.0** for members. Members do not
  need Desktop, AppHelper or a website account just to broadcast their character.
- **FlockSync-Addon-Bundle.zip:** main addon **1.0.0** plus AppHelper **1.0.0**
  for collectors, who also need Desktop and an authorized OFFICER/ADMIN login.
- **FlockSync_Remote_Server_Deploy.zip:** API/web **1.0.0** source and deployment
  tooling for 64-bit AMD64/ARM64 Linux Docker servers; not prebuilt images.
- **flocksync-release.json:** generated component-version manifest. Attach beside
  the five payloads on one publicly readable GitHub release.

### Component versions
| Component | Version | Status |
| --- | --- | --- |
| Main addon | **1.0.0** | Updated from 0.6.0; TEST mode disabled |
| Desktop | **1.0.0** | Updated from 0.5.2 |
| API/web | **1.0.0** | Updated from 0.7.1; aligned |
| Shared types | **1.0.0** | Updated from 0.7.1 |
| AppHelper | **1.0.0** | Version aligned from 0.2.2; runtime code unchanged |
| Root workspace metadata | **1.0.0** | Version aligned from 0.2.2 |

AppHelper's code is unchanged: an existing compatible helper does not need
reinstallation for new behavior, although the combined bundle carries its
1.0.0 version label. Main addon, Desktop and server do require the update.

### First installation and channels
Members install the main addon and complete the walkthrough. Collectors also
install AppHelper and one Desktop download and configure their own server.
Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for first-install setup and recovery,
and [SERVER-OPERATIONS.md](./SERVER-OPERATIONS.md) for maintenance.
Collection requires an online authorized collector; broadcasts missed while
offline cannot be recovered from the server.

Prepared for the normal **Release** channel, without an alpha/beta suffix.
When separately authorized, publish one release tagged **v1.0.0**, titled
**FlockSync 1.0.0**, with GitHub prerelease unchecked and all six assets.
Checkers compare each component's own version. CurseForge main-addon publication
uses version **1.0.0** and Release type; do not create duplicate uploads.

### Verification and outstanding acceptance
This is local release preparation, not publication or a new live deployment.
Final 1.0.0 sources passed:
- Root typecheck and all component builds; Windows installer and portable packaging.
- All 31 API production/update checks, 27 web checks and two packaging checks.
- 34 Desktop checks; one optional live-GitHub test remains skipped because it
  asserts a specific historical public release, not this unpublished candidate.
- All 18 Lua 5.1 checks including dedicated gear persistence, plus both-addon
  syntax validation and the distributed TEST-off assertion.
- Actual API/web container builds, isolated readiness, Desktop -> SQLite ->
  generated Lua helper -> independent addon clients, restart persistence,
  deduplication and private-data exclusion.
- ZIP contents match final source files; all package/TOC/manifest versions are
  1.0.0. Root executable copies match built outputs; Desktop's packaged archive
  contains version 1.0.0. Local trackers/scratch files are excluded.

The update-check fixture now generates a server version newer than the installed
version; its previous fixed 1.0.0 was no longer newer after version alignment.
No runtime update-check behavior was changed.

Maintainer reported live server readiness, preserved roster/group ownership
display, Desktop sync/helper update, error-free game UI, shared note return,
automatic shared additions and deletion reaching the website on earlier
candidate versions. These results do not prove final-version installation.

**Hostile-player manual checks were waived by the maintainer because no enemy
players were available.** Real-client sightings, alerts, skull display/cleanup
and kill/death attribution remain unverified in game. Automated mocks are not
proof of actual client event availability. No universal detection/attribution
or zero-vulnerability claim is made.

Isolated API/web test services have stopped; their localhost test URL is no
longer available. Nothing was committed, tagged, pushed, published or redeployed.
The remote v1.0.0 tag was absent during preparation; recheck before publication.

### Final maintainer smoke checklist (distribution gate)
These checks are pending, not recorded as passed. Use only the final assets in
`release`; their manifest reports 1.0.0 for every component.
1. **Identify the candidate:** from the checkout, run
   `Get-FileHash .\release\FlockSync-Portable-1.0.0-x64.exe -Algorithm SHA256`.
   Expected hash:
   `3C55FA7AE9F65676CC1F34A460CD4EE1FEBA16D6388E67C61B7AF047E5D3F7FB`.
   Inspect `release\flocksync-release.json`: release and all components must be
   1.0.0. Report any mismatch; do not install a mismatched candidate.
2. **Desktop:** quit the old app through its tray icon. Only after authorizing
   use of the existing installation/settings, launch
   `release\FlockSync-Portable-1.0.0-x64.exe` (or choose the matching Setup
   alternative). Expect 1.0.0, preserved server/client settings and normal login.
   Do not post config files/tokens. Report displayed version and exact errors.
3. **Server, only after separately authorizing the update:** privately preserve
   configuration and data; verify writable backup storage. Use the final
   `release\FlockSync_Remote_Server_Deploy.zip`, stage source as described in
   [DEPLOYMENT.md](./DEPLOYMENT.md), then run `sh deploy/update-server.sh`.
   Stop on failed/missing verified backup. Expect healthy API/web from
   `docker compose ps` and `{"status":"ok"}` from
   `docker compose exec web wget -qO- http://127.0.0.1/ready`.
   Check existing roster/ownership/kill entries without changing real records.
4. **Addon/helper and sync, game required:** after authorizing this installation
   check, close WoW before replacing addons. Existing junction-linked addons
   already point at this checkout: do not extract ZIPs over those links.
   Other clients install Raider Only or the collector bundle into the actual
   AddOns directory, preserving SavedVariables. Expect 1.0.0 and no friendly
   TEST indicator. Use logout -> successful Desktop sync -> login; check
   existing notes and history. No reset or manual helper overwrite.
5. **Sharing and cleanup, game required:** only with a consented typed test
   player entry, save Guild Shared with a distinctive note. Expect automatic
   guild delivery without Publish, then website appearance after collector sync.
   Remove only that test entry and verify removal after relay/sync. Friendly
   typed entries test transport only, not detection. Report UI errors, sync
   result, add/note/removal results and any missing existing data.

Quit test Desktop instances afterward. If installation fails, stop testing and
report errors before retrying or rolling back. Keep previous downloads/backups
available outside the current upload folder; never overwrite a running helper,
delete SavedVariables or restore a live database casually. Server rollback uses
the recovery instructions in [DEPLOYMENT.md](./DEPLOYMENT.md).
Hostile-player detection/skull/kill/death checks remain waived/deferred until
appropriate players are available. Final smoke acceptance and separate
publication authorization remain distribution blockers.

---

### Maintainer / next-agent handoff
Read [RELEASES.md](./RELEASES.md), [DEPLOYMENT.md](./DEPLOYMENT.md),
[README.md](./README.md) and the existing workspace instructions. Inspect branch,
status, package/TOC versions, generated manifest and actual publication state.
Never reuse a published tag or infer ZIP freshness from filenames.
Local trackers and operator notes remain ignored, not release assets.

Build source of truth: committed format-9 lockfile, pnpm **12.16.1**,
TypeScript strict shared contracts, Vite React SPA (not Next.js), Fastify,
parameterized Drizzle and WAL SQLite, Lua **5.1**, Interface **16001**.
Docker API/web builders use Node 22 Bookworm; API builds native SQLite with
Python 3/make/g++, runner UID 1000; web runs nginx; backups use Alpine.
Use host-appropriate commands; editor extensions do not establish runtimes.

Desktop settings/auth live in Electron userData configuration: preserve them,
never dump, commit or package them. Preserve saved client paths. Addons go into
the actual client's `Interface\AddOns`; SavedVariables stay in their account
folder. Logout -> Desktop sync -> login remains the safe helper-loading flow.

No host ports are exposed in production Compose. Cloudflare Tunnel routes to
`http://web:80`; nginx proxies `/api` and `/health` to `api:3001`. Live WAL SQLite
must remain on local persistent storage; configured backup storage is for
backups only. Verify storage availability and permissions before upgrades.
Preserve deployed environment/data; use the guarded updater, not direct restarts.
Keep pre-update snapshots until intentionally removed. Instance runbooks,
host inventories and access details belong only in ignored local notes.
