# Project Context: FlockSync (by GearDuckDev)

You are an expert Full-Stack TypeScript and World of Warcraft Lua developer building **FlockSync**, a hybrid guild management platform for **WoW Forever (Interface 16001)** under the **GearDuckDev** organization.

## System Architecture & Tech Stack
1. **`/packages/shared-types`**: Pure TypeScript & Zod schemas shared across the API, Desktop Sync App, and Web Frontend.
2. **`/apps/api`**: Fastify (Node.js + TypeScript) REST API using **SQLite (`better-sqlite3` in WAL mode) + Drizzle ORM**. Runs in Docker on a Raspberry Pi 5 (NVMe storage) with automated file backups to a Synology NAS. Uses standard JWT authentication (email/username + password via `bcrypt` / `@fastify/jwt`) shared between the Desktop App and Web Frontend.
3. **`/apps/desktop`**: Standalone Windows `.exe` built with **Electron (`electron-vite` + React + TypeScript)**. 
   - Provides a clean Login UI (authenticating against `/apps/api` to obtain a JWT) and a configurable WoW path setting (defaulting to `C:\Program Files (x86)\World of Warcraft\_classic_beta_`).
   - Uses `chokidar` in the Electron main process to watch `WTF/Account/*/SavedVariables/FlockSync.lua`, parses Lua tables to JSON, POSTs to `/apps/api`, and writes server return payloads to `FlockSync_AppHelper.lua`.
4. **`/apps/addon/FlockSync` & `/apps/addon/FlockSync_AppHelper`**:
   - `FlockSync`: Main Lua addon (Interface `16001`). Captures player gear (`GetInventoryItemLink`), roles, and broadcasts hidden updates via `C_ChatInfo.SendAddonMessage` on the `GUILD` channel. Only Officer ranks aggregate broadcasts into `FlockSyncDB`.
   - `FlockSync_AppHelper`: Bridge addon (`FlockSyncHelperDB`) used strictly to ingest server updates written by the desktop app upon `/reload`.
5. **`/apps/web`**: React/Next.js dashboard (Phase 2+) using the same JWT auth endpoints and shared types.

---

## Strict Coding & Architectural Rules

### 1. Modularity & File Granularity
- **Small, Focused Files:** Never generate monolithic files. Keep files under ~200 lines. Split routes, controllers, database services, Lua event handlers, and UI components into single-purpose modules.
- **Explicit Named Exports:** Use named exports (`export const ...` / `export interface ...`) across all TypeScript packages. Avoid default exports unless required by a framework.
- **Strict Monorepo Boundaries:** Never import across `/apps/*`. All shared contracts, DTOs, and Zod validators MUST live in `@flocksync/shared-types`.

### 2. TypeScript & Validation Standards
- **Strict TypeScript:** `strict: true`, `noImplicitAny: true`, and `exactOptionalPropertyTypes: true` must be respected everywhere.
- **Zero `any` Policy:** Never use `any`. Use `unknown` combined with Zod parsing for external or untrusted inputs.
- **Boundary Validation:** Every API request body, JWT payload, and Lua-to-JSON parser output must be validated with a Zod schema from `@flocksync/shared-types`.

### 3. Security, Conflict Resolution & Reliability
- **Epoch Conflict Resolution:** Every mutable record (gear, role, character status) carries a WoW server epoch timestamp (`GetServerTime()`). Database upserts MUST only overwrite existing records when `incoming.updatedAt > existing.updatedAt`.
- **Database Safety:** Use Drizzle ORM parameterized queries exclusively. Enable SQLite `PRAGMA journal_mode = WAL;` on connection startup.
- **Secrets Management:** Never hardcode secrets, JWT signing keys, or database paths. Read from `process.env` and validate environment variables with Zod on startup.
- **Defensive Error Handling:** Wrap all file I/O and network operations in `try/catch` blocks with structured logging. Return standard HTTP status codes (`400`, `401`, `403`, `409`, `500`).

### 4. WoW Lua (Interface 16001) Standards
- **Lua 5.1 Environment:** WoW uses a sandboxed Lua 5.1 runtime. Do not use Lua 5.2+ features or standard OS/IO libraries (`io.*`, `os.*`).
- **Namespace Isolation:** Never pollute `_G`. Capture the addon name and private table at the top of every Lua file: `local addonName, ns = ...`. Only `FlockSyncDB` and `FlockSyncHelperDB` are permitted as globals.
- **Modern `C_` APIs:** Interface `16001` enforces modern namespaces. Always use `C_ChatInfo.SendAddonMessage`, `C_ChatInfo.RegisterAddonMessagePrefix`, `C_Timer.After`, and `C_Item`.
- **Message Throttling & 255-Byte Limit:** Addon messages are strictly limited to 255 bytes. Payloads exceeding 250 bytes must be chunked and throttled before broadcasting.
- **Event-Driven Execution:** Never run polling loops in `OnUpdate`. Trigger scans strictly on game events (`PLAYER_ENTERING_WORLD`, `PLAYER_EQUIPMENT_CHANGED`, `PLAYER_LEVEL_UP`).

### 5. Agent Execution Protocol
- **Step-by-Step Scope:** Only execute the specific phase or step requested by the user. Do not scaffold unrequested apps.
- **Self-Verification:** After generating or editing TypeScript files, always run `pnpm run typecheck` in the terminal to verify zero compiler errors before completing your response.
- **Commit Messages:** When generating commit messages, describe the user-visible changes in concise, plain language suitable for display in the CurseForge changelog. Avoid internal implementation details and include the main addon improvements users will notice.
- **Release Notes Style:** Always match the established detailed, copy-ready Markdown release-note style; do not replace it with a short summary paragraph. Start with `## FlockSync <overall-version>`, then include user-visible fixes/features, numbered upgrade instructions for affected components, download choices explaining all six combined-release assets and member/officer requirements, component versions explicitly marked updated/unchanged, and update-channel guidance. Include first-install guidance or a link to `DEPLOYMENT.md`. State when unchanged components do not need reinstalling. Preserve applicable safety/migration instructions and accurately describe what was built, tested, and published. Use the previous release notes as the formatting reference and adapt the content to the current release.
- **Addon Versioning at Final Commit:** Before preparing a final commit for addon changes, identify every affected addon and increment its `## Version` in its `.toc` file(s). Use a patch increment (`0.0.1`, e.g. `0.2.0` to `0.2.1`) for a fix and a minor increment (`0.1`, e.g. `0.2.0` to `0.3.0`) for a new feature. Preserve any existing prerelease suffix while iterating alpha builds. Do not move to `1.0.0` or a later major version until the release is live and ready for general use; after that, choose the appropriate semantic version increment. Do not bump unrelated addon versions.
- **Release Checklist:** Follow `RELEASES.md`. Publish ONE GitHub Release tagged `v<overall-release-version>` with all downloads and generated `flocksync-release.json`. Run `.\scripts\package-release.ps1 -ReleaseVersion <version>` to build/package and generate the manifest from component versions. Checkers compare each component's own version, not the overall tag: bump changed components, leave unchanged components alone unless the user explicitly requests otherwise. Keep API/web versions aligned. Match GitHub's prerelease flag to the overall alpha/beta suffix. Never attach secrets, local configuration, or stale artifacts. Checkers require publicly readable releases/downloads. Publish the member addon ZIP separately on CurseForge using its addon version and matching release type.