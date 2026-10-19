# FlockSync

**FlockSync is a guild management and synchronization platform for WoW Forever (Interface 16001)**, by GearDuckDev. In-game addons collect player data, officer addons aggregate it, a desktop app syncs it to the API, and the web dashboard provides guild-wide roster and planning tools.

**Live production web dashboard:** [https://flocksync.gearduckdev.com](https://flocksync.gearduckdev.com)

## Getting started for guild members

1. Download `FlockSync-Raider-Only.zip` from the guild-provided release.
2. Extract the `FlockSync` folder into your WoW Forever installation's
   `Interface\AddOns` directory. Ensure the resulting path is
   `Interface\AddOns\FlockSync\FlockSync.toc`.
3. Log in to your character. The **first-time walkthrough** opens automatically
   (or with `/fs`): it explains what is shared, lets you turn off tooltips or
   individual features, and sets your primary/off-spec role and Main. Nothing is
   scanned or broadcast until you click **Finish**, which sends your first update.
4. Later changes live in **Options** (`/fs options` or right-click the minimap
   button): role, availability, display/feature toggles and **Force Scan & Broadcast**.
5. Use `/reload` or log out to write SavedVariables so the officer's desktop
   client can sync the latest character data.

Raiders only need the main `FlockSync` addon; they do not need the desktop app
or `FlockSync_AppHelper`.

## Getting started for guild officers

1. Install the officer desktop sync client using `FlockSync-Setup.exe`, or run
   the portable executable from the guild-provided release.
2. Enter the API Server URL provided by your guild administrator. For the
   GearDuckDev-hosted service, use `https://flocksync.gearduckdev.com`; for a
   self-hosted guild server, use that server's URL.
3. Log in with your officer credentials. (If you self-registered on the
   dashboard, ask an admin to promote your account to `OFFICER` first.)
4. Select your World of Warcraft installation directory if it was not
   automatically detected.
5. Install both `FlockSync` and `FlockSync_AppHelper` from the Officer Addon
   Bundle. The desktop client runs in the background and watches WoW's
   SavedVariables. It syncs changes whenever `/reload` or logout writes them.

Keep the desktop client running and logged in while playing. The API URL is
also the live [FlockSync dashboard](https://flocksync.gearduckdev.com).

**Tray, startup and updates:** closing the window hides FlockSync to the system
tray, where syncing continues. Right-click the tray icon for *Open FlockSync*,
*Sync Now*, *Check for Updates...*, the *Run on Windows Startup* and
*Minimize to Tray on Close* toggles, and *Quit FlockSync*. Double-click the
icon to reopen the window. By default the app starts with Windows, quietly in
the tray. Both toggles are also under **App Settings** on the dashboard, next to
**Check for Updates** and the current version. The app checks GitHub Releases
15 seconds after launch and every 6 hours. When a newer version exists, a banner
offers **Download on GitHub** or **Remind Me Later**, which mutes automatic
checks until the next launch. Manual checks always run.

## How it works

```
Players' FlockSync addon ──(hidden GUILD addon messages)──▶ Officer's FlockSync addon
                                                                  │ writes FlockSync.lua (SavedVariables, on /reload or logout)
                                                                  ▼
                                                  Desktop app (Electron, watches the file)
                                                                  │ POST /api/sync  (JWT)
                                                                  ▼
                                                  API (Fastify + SQLite)  ◀── Web dashboard (React)
                                                                  │ returns culled characters
                                                                  ▼
                              Desktop app writes FlockSync_AppHelper.lua ──▶ applied in game on /reload
```

1. **Addon (`FlockSync`)** scans the logged-in character: gear, role/off-spec, availability, raid lockouts, professions and recipes, gear goals and attunement progress. It broadcasts the data to the guild over a hidden addon channel, chunked to stay under the 255-byte limit.
2. **Officers** (guild rank at or above the threshold) merge everything they receive into `FlockSyncDB`. Officers also record boss-kill attendance and epic raid loot.
3. **Desktop app** watches `WTF/Account/*/SavedVariables/FlockSync.lua`, parses it, validates it, and posts it to the API. It writes the server's reply to `FlockSync_AppHelper.lua`.
4. **`FlockSync_AppHelper`** addon ingests that reply on `/reload` (e.g. characters culled on the web).
5. **API** stores everything in SQLite. Newer data wins: a record is only overwritten when its epoch timestamp is greater than the stored one.
6. **Web dashboard** reads from the API.

WoW only writes SavedVariables on `/reload` or logout, so run `/reload` in game before expecting new data to sync.

## Features

**Web dashboard tabs**

| Tab | What it does |
| --- | --- |
| Roster & Gear | Players grouped under a custom alias with their Main marked and alts beneath. Gear drawer with Wowhead tooltips, lockout and availability badges, cull/restore, permanent delete, create task |
| Team Builder | Raid (10/20/40), Dungeon (any number of 5-man parties) and PvP lineups with role targets, class and buff coverage, and main/alt conflict guard |
| Availability & Recruitment | Weekly availability heatmap by role, and plain-English recruitment gaps |
| Crafter Directory | Search recipes, professions or item IDs and see who can craft them tonight |
| Gear Goals | Dungeon matcher grouping players who want the same item or run |
| Attunements | Progress per attunement chain, with players grouped by the step they are stuck on |
| Loot & Attendance | Paginated loot history and 30/60/90-day attendance per player (Main plus alts) |
| Officer Tasks | Open / In progress / Completed board, optionally linked to a character (officers only) |

**In-game windows:** *Features* (`/fs`, minimap left-click) holds the daily-use tabs *Raid Schedule*, *Crafter Search*, *LFG Matcher* and *Professions & Goals*; disabled features hide their tab. *Options* (`/fs options`, minimap right-click) holds *Role & Main* (with Force Scan and the Local Test Officer Mode checkbox, which asks for confirmation), *Availability & Lockouts* and *Display & Features* (minimap/tooltip/feature toggles and **Reset First-Time Walkthrough**). A first-time walkthrough must be finished before anything is scanned or broadcast.

### Adding gear goals in game

In *Professions & Goals*, drag an item onto a slot, enter an item ID/link, or
type at least two letters of an item name and click a suggestion underneath.
Suggestions filter as you type and show up to six matches, with item IDs to
distinguish items with identical names.

The name search uses a local cache of up to 2,000 encountered items from your
equipment, bags (when the client exposes `C_Container`), tracked guild gear,
saved goals and raid loot. This cache persists between sessions. It is **not a
complete item database**: WoW addons cannot search game files directly. For an
item that has never been encountered, use its ID or link instead. Search is
debounced and does not brute-force IDs, make network requests, or poll each frame.

## Requirements

For Docker hosting, NAS backups, Windows executables and addon release archives,
see [DEPLOYMENT.md](./DEPLOYMENT.md).

- Windows, WoW Forever client (Interface 16001)
- Node.js 20 or newer
- [pnpm](https://pnpm.io/)
- For hosting: any machine that can run the API (designed for a Raspberry Pi 5 in Docker)

## Repository layout

| Path | Description |
| --- | --- |
| `packages/shared-types` | Zod schemas and TypeScript types shared by every app |
| `apps/api` | Fastify + Drizzle + SQLite (WAL) REST API with JWT auth |
| `apps/desktop` | Electron sync client (login, WoW path setting, Lua parser, file watcher) |
| `apps/web` | React + Vite + Tailwind dashboard |
| `apps/addon/FlockSync` | Main addon |
| `apps/addon/FlockSync_AppHelper` | Bridge addon that receives server updates |
| `scripts/link-addons.ps1` | Junctions the addons into the WoW AddOns folder |

## Setup

Run everything from the repo root.

```powershell
pnpm install
```

Create `apps/api/.env` (see `apps/api/.env.example`):

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | Where the API listens (default port 3001) |
| `DATABASE_URL` | Path to the SQLite file |
| `JWT_SECRET` | Long random secret for signing tokens |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Admin account created on first start |

Then create the database and link the addons into WoW:

```powershell
pnpm --filter @flocksync/api db:push
.\scripts\link-addons.ps1
# custom WoW location:
.\scripts\link-addons.ps1 -WowAddonsPath "D:\WoW\_classic_beta_\Interface\AddOns"
```

The web app reads `VITE_API_BASE_URL` (production default `/api`, development
default `http://localhost:3001/api`) and `VITE_WOWHEAD_PATH` (default `forever`).
The legacy `VITE_API_URL` origin setting is also supported.

## Running

Use one terminal per app:

```powershell
pnpm dev:api       # http://localhost:3001
pnpm dev:web       # http://localhost:5173
pnpm dev:desktop   # Electron sync client
```

Typical loop: start the apps, play, `/reload` in game, let the desktop app sync, then click **Refresh** on the web dashboard.

## Development commands

```powershell
pnpm --filter @flocksync/shared-types build
pnpm --filter @flocksync/api typecheck
pnpm --filter @flocksync/desktop typecheck
pnpm --filter @flocksync/web typecheck
pnpm --filter @flocksync/web build
pnpm build                                  # every workspace
pnpm run typecheck                          # every workspace
pnpm --filter @flocksync/api db:push        # apply schema changes
pnpm --filter @flocksync/desktop package:win # installer + portable executable
.\scripts\package-addons.ps1                # officer + raider addon archives
```

If `db:push` prompts about new NOT NULL columns, add the columns with `ALTER TABLE` first and re-run it.

## In-game commands

| Command | Action |
| --- | --- |
| `/fs` | Open/close the Features window |
| `/fs options` (`config`, `setup`) | Open the Options window |
| `/fs role` (`main`) | Options → Role & Main |
| `/fs raid` (`schedule`) | Features → Raid Schedule |
| `/fs craft` | Features → Crafter Search |
| `/fs prof` | Features → Professions & Goals |
| `/fs minimap` | Show/hide the minimap button |
| `/fs help` | List commands in chat |
| `/fs debug officer` | Force Officer Mode for this session only (`/fs debug officer off` to clear) |
| `/reload` | Write data to disk so the desktop app can sync it |

Until the walkthrough is finished, every `/fs` command and minimap click opens it.
Opening a disabled feature's tab prints a hint and shows the first enabled tab.

**Minimap button:** left-click opens/closes Features, right-click opens/closes
Options, and dragging moves it around the minimap edge. Its angle is saved in
`FlockSyncDB.minimap.minimapPos`; visibility follows `FlockSyncDB.config.showMinimap`
(mirrored to `minimap.hide`).

**Settings** (`FlockSyncDB.config`, account-wide): `hasCompletedOnboarding`,
`showMinimap`, `showTooltips`, `enableSchedule`, `enableCrafterSearch` and
`enableLfgMatcher`. Turning off tooltips or a feature only hides it in game;
your character data is still broadcast once onboarding is complete.

**Addon messages:** character/ledger broadcasts (prefix `FLOCKSYNC`) are queued and
sent one message every 0.5 seconds. Every message carries the sender's guild
name; receivers drop messages from other guilds and everything received while
unguilded. Cached snapshot relays are hidden on characters in a different guild.

**Inactive characters:** when an officer logs in, characters unseen for 30+ days
are marked inactive (tracked in `FlockSyncDB.staleCharacters`) and the server
removes them from the Team Builder on the next sync. They return automatically
when they log in again. Manual culls from the web stay inactive until reactivated.
Reactivating a 30+ day idle character on the web lasts only until the next sync.

## Guild snapshots returned to the desktop

Officer sync replies include `craftersIndex` (one entry per accepting crafter/recipe),
`upcomingRaids` (weekly RAID teams with named assignments and benches), and
`goalMatches` (gear goals grouped by item ID). Inactive characters are excluded,
and duplicate recipes/goals per character are collapsed. Saved teams recur weekly,
so all RAID teams occur within the next 14 days; there is currently no dated-event
or team active/inactive field. Dungeon and PvP teams are not included.
Bench entries have `isBench: true` and group/slot indexes of `0`.

The desktop writes these optional arrays as nested Lua 5.1 tables in
`FlockSync_AppHelper.lua` beside the synced account's `FlockSync.lua`.
Old replies without snapshots remain supported. The data is available on the
next `/reload` or login.

### In-game snapshot features

- **Tooltips:** item tooltips gain `FlockSync Goal:` (guildmates with the item as a
  Gear Goal) and `FlockSync Crafter:` (accepting crafters) lines. Crafter lookups
  match crafted item IDs; enchant recipes are spell IDs and only appear in search.
- **Features window tabs** (each is built the first time it is opened):
  - *Raid Schedule* — weekly raid teams with your status
    (`ASSIGNED: Group X (Role)`, `STANDBY / BENCH`, or `NOT SCHEDULED`). Officers get
    **Auto-Invite Assigned Team**, which invites online non-bench assignees and
    converts the party to a raid once someone joins.
  - *Crafter Search* — filter by item/enchant or crafter name, with **Whisper**.
  - *LFG Matcher* — online guildmates who share your Gear Goals, with **Invite**.
- Tooltip lines and each tab can be turned off under Options → Display & Features.
- **Members without the desktop app:** a PC with desktop-linked helper data relays
  the snapshot over guild addon messages (prefix `FLOCKSNAP`, 1 chunk/second) about
  30 seconds after login and whenever a member asks for a newer copy. Members cache
  it in `FlockSyncDB.guildSnapshot`; only newer, non-future timestamps replace it.
  Any guild member running the addon could send a crafted relay, so treat the
  in-game snapshot as informational.

## Roles and security

Officer detection in game accepts a session-only `/fs debug officer` override,
the saved `forceOfficerMode` dev override (off by default; existing installs are
reset to off once by the config v2 migration), a desktop-created helper
authorization flag, native officer-note permission,
or the configured guild-rank threshold. Options → Role & Main shows the active
reason. Enabling the saved override through **Local Test Officer Mode** requires
confirming a warning popup. Officer/Admin desktop login, path saves and app
resume initialize missing helper files in discovered account SavedVariables
folders without overwriting existing data; restart WoW or `/reload` to load
them. Existing helper files receive the flag on the next successful sync.
This flag persists on disk (it is not a live login or automatic logout
revocation), and the local testing override is not production access control.
API authentication and Officer/Admin authorization are still required to sync.

- Roles are `MEMBER`, `OFFICER` and `ADMIN`. Writes (sync, raid teams, tasks, aliases, cull/delete) require Officer or Admin.
- Anyone can create an account from the dashboard's **Create account** tab. Self-registered accounts are always `MEMBER` (read-only roster, lineups, ledger; no Officer Tasks).
- Admins manage accounts in **Admin Settings**: add users with any role, promote/demote, or delete. The root admin (the first account, seeded from `INITIAL_ADMIN_EMAIL`) cannot be demoted or deleted, admins cannot change or delete their own account, and the last admin cannot be demoted.
- Every authenticated request re-reads the account from the database, so role changes and deletions take effect immediately for existing logins (including the desktop client).
- Users can change their own username using **Account** in the dashboard header. The root/main admin can also **Rename** any account in **Admin Settings**; other admins cannot rename someone else's account. Usernames must be 2-32 characters and unique (case-insensitive). Renaming does not change email, password, role or character data.
- All request bodies are validated with Zod. Database access uses parameterized Drizzle queries only.
- Secrets come from environment variables, never from source.

## Troubleshooting

- **Port 3001 busy:** `Get-NetTCPConnection -LocalPort 3001`, then `Stop-Process -Id <PID>`.
- **Data missing on the web:** `/reload` in game, check the desktop app synced, then Refresh.
- **Quest or attunement data looks wrong:** attunement quest IDs in `apps/addon/FlockSync/Attunements.lua` should be verified against the Forever client.
