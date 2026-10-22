# FlockSync screenshot and publishing kit

## What was captured

**16 PNG screenshots:** 14 web views at 1440 x 1050 and two desktop views at
1000 x 800. These capture the existing built React interfaces in Chromium /
Electron, not redesigned mockups. The web and desktop components are 0.4.0 in
the FlockSync 0.6.0 release set; addon versions remain unchanged.

Every image carries a **DEMO DATA** caption. Characters, account details,
availability, quests, equipment, loot, and tasks are fictional fixtures.
Lineups and simplified attunement steps demonstrate layout, not actual encounter
requirements or quest-chain accuracy. Desktop watcher/activity responses are
simulated; the screenshot is not evidence of a real guild sync.

Captures used isolated temporary profiles. No live account, real game directory,
production server, or private guild information was used. External requests
were blocked. The original addon/example guild artwork was not added to themes.

## Gallery

Click any link to view/download the original PNG. Images are viewport captures;
long pages may continue below the visible area.

| Image | Suggested caption |
| --- | --- |
| [Web roster](./screenshots/web-roster.png) | Keep mains, alts, roles, and availability together. |
| [Character gear](./screenshots/web-gear.png) | Inspect a character's synced equipment. |
| [Team Builder](./screenshots/web-team-builder.png) | Arrange groups and review role/class coverage. |
| [Availability](./screenshots/web-availability.png) | See weekly coverage and recruitment gaps. |
| [Professions](./screenshots/web-professions.png) | Browse the guild's synced professions. |
| [Crafter search](./screenshots/web-crafters.png) | Find guildmates who know a recipe. |
| [Gear goals](./screenshots/web-goals.png) | Find players chasing shared items and runs. |
| [Attunements, collapsed](./screenshots/web-attunements-collapsed.png) | Alts start collapsed beneath their main. |
| [Attunements, expanded](./screenshots/web-attunements-expanded.png) | Expand to see each alt's individual progress. |
| [Loot and attendance](./screenshots/web-loot-attendance.png) | Review recorded loot and player-level attendance. |
| [Officer tasks](./screenshots/web-officer-tasks.png) | Keep officer follow-up on a shared task board. |
| [Administration](./screenshots/web-admin.png) | Manage website accounts and review server update notices. |
| [Theme default](./screenshots/web-theme-default.png) | The initial background is None. |
| [Optional Alliance theme](./screenshots/web-theme-alliance.png) | Choose a personal emblem without replacing the admin default. |
| [Desktop sign-in](./screenshots/desktop-login.png) | Connect to your guild's server with your website login. |
| [Desktop sync/settings](./screenshots/desktop-sync-settings.png) | Desktop sync controls and independent startup/tray preferences. |

## Recommended public selections

**Discord:** use web roster, Team Builder, expanded attunements, and desktop
sync/settings as a four-image introduction. Add crafters/themes in a follow-up.
Copy the announcement from [DISCORD.md](./DISCORD.md), and attach the PNGs as
files; Discord does not render local Markdown image paths.

**CurseForge:** lead with genuine addon captures once available. Companion
screenshots should have titles beginning **Web dashboard** or **Windows
companion** so they are not mistaken for addon UI. Suggested companion images:
roster, expanded attunements, and desktop sync/settings.

Use [CURSEFORGE.md](../CURSEFORGE.md) as the copy-ready description. Its inline
images use public raw GitHub URLs and will work only after these exact files
are committed/pushed to `main` in a publicly readable repository. Preview the
description in the site's editor; upload PNGs to the project's image gallery
separately and replace inline URLs with hosted image URLs if necessary.
No text, images, or messages have been uploaded or posted for you.

## Addon captures still needed

A running, logged-in WoW Forever client was not available to this capture
workflow. **No genuine addon screenshots were produced.** Browser-rendered Lua
recreations would misrepresent the in-game UI and were not substituted.

Take the following in WoW using the normal screenshot key (usually Print Screen).
Do not use Alt+Z: that hides the UI you are trying to show.

| Suggested file | How to get the shot |
| --- | --- |
| `addon-walkthrough.png` | On a test profile, open the first-time walkthrough. Reset it only if you intend to redo setup. |
| `addon-role-options.png` | `/fs role`; show role/main selection and the collection-status explanation. |
| `addon-raid-schedule.png` | `/fs raid` after a real synced guild snapshot; show an assignment and bench state where available. |
| `addon-crafter-search.png` | `/fs craft`; search an actually synced recipe and show the whisper control. |
| `addon-professions-goals.png` | `/fs prof` after opening profession windows; show captured professions and chosen gear goals. |
| `addon-lfg-matcher.png` | `/fs`, then LFG Matcher; capture real matching guild goals if available. |
| `addon-tooltip.png` | Hover a real matching item while tooltips are enabled; show the added crafter/goal lines. |
| `addon-display-options.png` | `/fs options`, Display & Features; show minimap/tooltips/feature controls. |

Use a clear scene and consistent resolution/UI scale. Close whispers and
sensitive chat; hide or redact real account names and private roster details.
Obtain permission before publishing other players' identifying information.
Keep enough game context to establish that these really are in-game captures.
Do not stage false successful invites, grants, or update notices.

Place approved PNGs beside the current screenshots and add only existing files
to the README/CurseForge copy. A member-facing addon overview should be the first
CurseForge image once genuine captures are available.

## Scope and release safety

The pack covers every current top-level web tab, gear inspection, desktop
sign-in, and desktop settings. It does not cover every modal, error, tray menu,
Windows installer step, live sync, or in-game interaction. A capture is a
visual illustration, not an end-to-end production test.

Screenshots and copy do not require a runtime version bump. The existing
release executables/manifest were not changed or republished for this task.
Documentation/media is excluded from the CurseForge addon package.
