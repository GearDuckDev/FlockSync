# FlockSync screenshot and publishing kit

## What was captured

**24 PNG screenshots:** eight developer-supplied in-game addon captures,
14 web views at 1440 x 1050, and two desktop views at 1000 x 800.
The web/desktop images capture the existing built React interfaces in Chromium /
Electron, not redesigned mockups. The web and desktop components are 0.4.0 in
the FlockSync 0.6.0 release set; addon versions remain unchanged.

Every web/desktop image carries a **DEMO DATA** caption. Characters, account details,
availability, quests, equipment, loot, and tasks are fictional fixtures.
Lineups and simplified attunement steps demonstrate layout, not actual encounter
requirements or quest-chain accuracy. Desktop watcher/activity responses are
simulated; the screenshot is not evidence of a real guild sync.

Web/desktop captures used isolated temporary profiles. No live account, real game directory,
production server, or private guild information was used. External requests
were blocked. The example guild artwork was not added to themes.
The addon captures are a separate, user-supplied set with visible character names;
review permission to publish those names before posting.

## Gallery

Click any link to view/download the original PNG. Images are viewport captures;
long pages may continue below the visible area.

| Image | Suggested caption |
| --- | --- |
| [Addon walkthrough](./screenshots/addon-walkthrough.png) | First-time setup introduces sharing and guild features. |
| [Addon roles and main](./screenshots/addon-role-options.png) | Choose roles/main and see same-guild desktop-linked collection status. |
| [Addon crafter search](./screenshots/addon-crafter-search.png) | Recipe results with in-game Whisper controls. |
| [Addon professions/goals](./screenshots/addon-professions-goals.png) | Captured professions and an item goal with a note. |
| [Addon tooltip](./screenshots/addon-tooltip.png) | Added guild goal and crafter lines on an item tooltip. |
| [Addon raid schedule](./screenshots/addon-raid-schedule.png) | Test lineup snapshot, Not Scheduled status, and officer invite control. |
| [Addon LFG Matcher](./screenshots/addon-lfg-matcher.png) | Matching view with no current matches; not a populated group example. |
| [Addon display options](./screenshots/addon-display-options.png) | Minimap, tooltip, feature, and walkthrough controls. |
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

**Discord:** use addon crafter search, addon tooltip, web roster, and desktop
sync/settings as a four-image introduction. Add roles, Team Builder,
attunements, and themes in a follow-up.
Copy the announcement from [DISCORD.md](./DISCORD.md), and attach the PNGs as
files; Discord does not render local Markdown image paths.

**CurseForge:** lead with the addon walkthrough or crafter-search capture. Companion
screenshots should have titles beginning **Web dashboard** or **Windows
companion** so they are not mistaken for addon UI. Suggested companion images:
roster, expanded attunements, and desktop sync/settings.

## Where to put images for CurseForge

### Option A: use the GitHub URLs already in the description

1. Keep all PNGs in this repository's `docs/screenshots` directory. The role image
   is named `addon-role-options.png` (the duplicate `.png` extension was removed).
2. Commit/push the images and updated Markdown to the publicly readable `main`
   branch. Local files alone cannot appear in a CurseForge description.
3. Open an image URL in a logged-out/private browser. It must display the image
   without authentication, for example:
   `https://raw.githubusercontent.com/GearDuckDev/FlockSync/main/docs/screenshots/addon-crafter-search.png`
4. Copy [CURSEFORGE.md](../CURSEFORGE.md) into the project's description editor
   in Markdown/source mode if offered. If using a visual editor, use its image
   insertion control with the same direct image URL.
5. Preview before saving. Confirm both addon and companion images render.

The existing syntax is ready to use:

```markdown
![In-game guild crafter search](https://raw.githubusercontent.com/GearDuckDev/FlockSync/main/docs/screenshots/addon-crafter-search.png)
```

Do not use a local Windows path, GitHub `/blob/` page, or ZIP attachment URL as
the image source. A description needs a public direct image URL.

### Option B: host the images on CurseForge

1. Open your CurseForge project's management area and its Images/gallery
   management section (the exact navigation label may vary).
2. Upload selected PNGs from `docs/screenshots`, giving each a descriptive title.
   Addon images should lead; prefix companion titles with Web dashboard or
   Windows companion.
3. Gallery uploads are separate from inline description images. Insert the
   uploaded image through the description editor, or obtain its public direct
   image URL and replace the matching raw GitHub URL in the Markdown.
4. Preview and save. Verify the public project page while logged out.

No text, images, or messages have been uploaded or posted for you.

## Optional stronger addon shots

All eight requested addon views are now present. The current raid capture
shows a test lineup and **Not Scheduled**, and LFG shows **no matches**.
For richer follow-ups, capture a real assigned/bench state and populated goal
matches when available. These are optional replacements, not missing files.
Review visible character names before publishing; do not stage false successful
invites or grants. Current captions do not claim those actions occurred.

## Scope and release safety

The pack covers every current top-level web tab, gear inspection, desktop
sign-in, and desktop settings. It does not cover every modal, error, tray menu,
Windows installer step, live sync, or in-game interaction. A capture is a
visual illustration, not an end-to-end production test.

Screenshots and copy do not require a runtime version bump. The existing
release executables/manifest were not changed or republished for this task.
Documentation/media is excluded from the CurseForge addon package.
