# FlockSync: Guild & Raid Management for WoW Forever

**FlockSync** connects your in-game guild activity with a private guild web
dashboard, helping you manage character gear, roles, professions, raid
assignments, and gear goals without juggling spreadsheets.

Built for **WoW Forever**, FlockSync combines an in-game addon for everyone with
an optional Windows desktop companion for officers collecting guild data.

**Currently in beta.** Features and installation requirements may change during
testing.

---

## 📦 Which download do I need?

### Regular guild members

**Install FlockSync from this CurseForge page.**

You do **not** need AppHelper, the desktop application, or a server account just
to use the addon and share your character data with guild catchers.

Enable FlockSync, log in, and complete the first-time walkthrough. Your guild
needs an officer catcher and configured server for shared dashboard and
server-supplied features.

### Officers collecting guild data

You need three components:

1. **FlockSync** — the same main addon everyone installs from CurseForge.
2. **FlockSync AppHelper** — the companion addon that loads information returned
   by your guild's server.
3. **FlockSync Desktop** — the Windows application that transfers saved addon
   data to and from the server.

**[Download officer components from GitHub](https://github.com/GearDuckDev/FlockSync/releases).**

The GitHub officer download, **FlockSync-Addon-Bundle.zip**, contains both
FlockSync and AppHelper. There is no separate officer edition of the main addon.

**Using CurseForge to manage FlockSync?** Keep that installation and copy only
the **FlockSync_AppHelper** folder from the GitHub bundle into your AddOns
directory.

---

## 🦅 For Raiders — No Desktop App Required

- 📅 **Raid Schedule:** View upcoming raids and your assigned group/role or
  standby placement.
- 🛠️ **Guild Crafter Search:** Search synced guild recipes and contact available
  crafters.
- 🎒 **Item Tooltips:** See relevant guild crafting and gear-goal information
  while browsing items.
- 🎯 **Gear Goals & LFG Matching:** Record desired items and find guildmates with
  matching goals.
- 🚦 **First-Time Walkthrough:** Choose your main character, role, and preferred
  features.
- ⚙️ **Configurable Interface:** Manage feature tabs, tooltips, and the minimap
  button.

Shared information depends on your guild's configured sync setup and the latest
received snapshot. It is not a continuous live connection to the website.

---

## 👑 Officer Setup

### 1. Install the addons

Exit WoW before replacing addon files.

Install **FlockSync** from CurseForge, then download
**FlockSync-Addon-Bundle.zip** from GitHub and extract the **FlockSync_AppHelper**
folder alongside it.

Your addon directory should contain:

```text
Interface\AddOns\FlockSync\FlockSync.toc
Interface\AddOns\FlockSync_AppHelper\FlockSync_AppHelper.toc
```

Alternatively, for a fully manual installation, extract both addon folders from
the GitHub bundle into AddOns.

Do not leave these inside an extra ZIP-named folder. Keep existing SavedVariables
when upgrading.

### 2. Install the desktop companion

Choose one Windows download from the GitHub release:

- **FlockSync-Setup-\<version\>-x64.exe** — installer.
- **FlockSync-Portable-\<version\>-x64.exe** — portable alternative.

You only need one. Close any existing FlockSync desktop instance, including its
system-tray icon, before upgrading.

### 3. Connect to your guild's server

Ask your guild administrator for:

- Your guild's full server URL.
- An authorized **Officer** or **Admin** login.

Enter the server URL without an `/api` suffix. Select your WoW client folder —
the folder containing **Interface** and **WTF** — and save your settings.

Use your own guild's server address; `flocksync.gearduckdev.com` is not
automatically a shared service for every guild.

### 4. Load and sync your data

1. Enable both addons in WoW.
2. Complete FlockSync's first-time walkthrough.
3. Log in on a character with the required guild officer permissions so the
   addon can recognize that guild.
4. Same-account alts can inherit catcher status within a recognized guild; this
   does not grant catcher status in unrelated guilds.
5. Use `/reload` or log out to write your addon data to disk.
6. Wait for the desktop app to report a successful sync.
7. Refresh the web dashboard to see the latest uploaded data.

Server-returned information is written to AppHelper's SavedVariables. Logging
out, waiting for desktop sync, and then logging back in is the clearest way to
load the return payload without WoW overwriting it with an older in-memory copy.

**Installing AppHelper or logging into the desktop app does not by itself grant
in-game officer permissions.**

### 5. Use your raid tools

View assigned teams in-game and use **Auto-Invite Assigned Team** to invite
online assigned characters. Invites and raid-group management remain subject to
WoW's normal group and leadership restrictions.

For server hosting, NAS backups, Cloudflare setup, and restore instructions, see
the **[deployment guide](https://github.com/GearDuckDev/FlockSync/blob/main/DEPLOYMENT.md)**.

---

## 🔄 How Synchronization Works

**Addon → SavedVariables → Desktop → Guild Server → AppHelper → Addon**

The main addon records your character's information and broadcasts updates
through hidden guild addon messages. Officer catchers collect guild broadcasts.

WoW writes SavedVariables when you log out or reload. The desktop app watches
**FlockSync.lua**, uploads its saved data, and writes the server's return payload
for AppHelper to load later.

- Removing equipment is reflected after a fresh scan, disk save, and successful
  sync.
- **Last seen** is the character's scan time — not the time an old file was
  uploaded.
- The web roster currently requires **Refresh** to display newly uploaded
  information.
- Other addons' SavedVariables are not parsed or uploaded.

---

## 💬 Slash Commands

- `/fs` — Open or close the main window.
- `/fs options`, `/fs config`, `/fs setup` — Open settings.
- `/fs role`, `/fs main` — Character roles and main-character setup.
- `/fs prof` — Professions and gear goals.
- `/fs craft` — Guild crafter search.
- `/fs raid`, `/fs schedule` — Raid schedule.
- `/fs minimap` — Show or hide the minimap button.
- `/fs help` — List available commands.

`/fs debug officer` is a temporary local testing override, not normal officer
setup or server authorization. Use `/fs debug officer off` to disable it;
reload/relog also clears it.

---

## 🧪 Beta Updates

Allow **Beta** files in CurseForge if you want current beta addon builds.

Desktop and server update settings offer **Release**, **Beta**, and **Alpha**
channels. Each component checks its own version, so a server-only release does
not unnecessarily prompt you to update an unchanged addon or desktop app.

Addon chat notices rely on synced release metadata and appear only at initial
character login — not repeatedly during play or on reload.

Officers with AppHelper installed also receive a separate notice when its own
version needs updating. That notice points to the FlockSync GitHub releases for
the officer bundle. Main addon and AppHelper versions are checked independently;
updating FlockSync through CurseForge does not update AppHelper. This requires
the server, desktop app, and main addon builds that support helper notices.

Website **ADMIN** and **OFFICER** accounts can also act as guild data collectors
on low-ranked alts. With the updated server, desktop app, and addons installed,
sync once from a character in your guild, then `/reload` after the desktop app
reports success. Other characters on that WoW account can then catch broadcasts
in the same guild and realm without an in-game officer rank. Characters outside
that guild do not inherit collection access. Each WoW account folder must sync
separately; broadcasts are collected only while you are logged in.

---

## 🔒 Lightweight & Privately Hosted

- Throttled, hidden guild addon messages.
- No desktop application required for regular members.
- Guild-controlled server deployment and backups.
- Public source repository; **proprietary, not open source**. Use and hosting
  are subject to the repository's license.

**[Downloads, documentation, and development](https://github.com/GearDuckDev/FlockSync)**
