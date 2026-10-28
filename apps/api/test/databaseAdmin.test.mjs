import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import Database from "better-sqlite3";

test("admin backup, restore, folder setting, and wipe preserve safety", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-database-admin-"));
  const database = join(directory, "flocksync.db");
  const backupDirectory = join(directory, "backups");
  await mkdir(backupDirectory);
  const port = String(37000 + Math.floor(Math.random() * 10000));
  const origin = `http://127.0.0.1:${port}`;
  const adminEmail = "database-admin@example.com";
  const password = "test-only-database-admin-password";
  const child = spawn(process.execPath, [resolve("dist/server.js")], {
    env: {
      ...process.env, DATABASE_URL: database, BACKUP_DIRECTORY: backupDirectory,
      PORT: port, HOST: "127.0.0.1", JWT_SECRET: "test-only-jwt-key-not-for-deployment-1234",
      INITIAL_ADMIN_EMAIL: adminEmail, INITIAL_ADMIN_PASSWORD: password
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  const call = async (method, path, token, body) => {
    const headers = {};
    if (token) headers.authorization = "Bearer " + token;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${origin}${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  };

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
      try { ready = (await fetch(`${origin}/health`)).ok; } catch { await delay(100); }
    }
    assert.ok(ready, output);
    assert.equal((await call("GET", "/api/admin/database")).status, 401);
    assert.equal((await fetch(`${origin}/api/admin/database/restore-upload`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array([0])
    })).status, 401);
    const login = await call("POST", "/api/auth/login", undefined, { email: adminEmail, password });
    assert.equal(login.status, 200, output);
    const token = login.body.token;
    assert.deepEqual((await call("GET", "/api/guild", token)).body, { guild: null });
    const syncedGuild = { name: "Test Guild", realm: "Realm" };
    const guildSync = await call("POST", "/api/sync", token, {
      addonVersion: "test", exportedAt: 100, collectorGuild: syncedGuild,
      officerCharacter: {
        guid: "guild-character", name: "Guild Member", realm: "Realm", classId: 1, level: 60,
        isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 100 },
        gear: { items: [], updatedAt: 100 }, lastSeenAt: 100
      },
      characters: []
    });
    assert.equal(guildSync.status, 200, JSON.stringify(guildSync.body));
    assert.deepEqual((await call("GET", "/api/guild", token)).body, { guild: syncedGuild });
    const initial = await call("GET", "/api/admin/database", token);
    assert.equal(initial.status, 200);
    assert.equal(initial.body.backups.length, 0);

    const folder = await call("POST", "/api/admin/database/directories", token, { relativeDirectory: "manual" });
    assert.equal(folder.status, 200, JSON.stringify(folder.body));
    const setting = await call("PUT", "/api/admin/database/location", token, { relativeDirectory: "manual" });
    assert.equal(setting.status, 200);
    assert.equal(setting.body.selectedDirectory, "manual");
    assert.equal(JSON.parse(await readFile(join(directory, "admin-database-state.json"), "utf8")).backupDirectory, "manual");

    await writeFile(join(directory, "admin-database-state.json"), JSON.stringify({
      backupDirectory: "missing-folder", databaseResetAt: 0
    }));
    const unavailableFolder = await call("GET", "/api/admin/database", token);
    assert.equal(unavailableFolder.status, 400);
    assert.match(unavailableFolder.body.error, /no longer exists/i);
    const resetFolder = await call("PUT", "/api/admin/database/location", token, { relativeDirectory: "" });
    assert.equal(resetFolder.status, 200, JSON.stringify(resetFolder.body));
    const restoreFolder = await call("PUT", "/api/admin/database/location", token, { relativeDirectory: "manual" });
    assert.equal(restoreFolder.status, 200, JSON.stringify(restoreFolder.body));

    const writable = new Database(database);
    try { writable.prepare("INSERT INTO theme_defaults (id, theme_json) VALUES (?, ?)").run("test", "{}"); }
    finally { writable.close(); }
    const created = await call("POST", "/api/admin/database/backup", token);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const backup = created.body.backup;
    assert.match(backup.filename, /^flocksync-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\.db$/);
    assert.equal(backup.relativeDirectory, "manual");

    const backupPath = join(backupDirectory, "manual", backup.filename);
    const bytes = await readFile(backupPath);
    const writableAfterBackup = new Database(database);
    try {
      writableAfterBackup.prepare("DELETE FROM theme_defaults").run();
      writableAfterBackup.prepare("DELETE FROM guild_identity").run();
    }
    finally { writableAfterBackup.close(); }
    const restored = await call("POST", "/api/admin/database/restore", token, {
      filename: backup.filename, relativeDirectory: "manual"
    });
    assert.equal(restored.status, 200, `${JSON.stringify(restored.body)}\n${output}`);
    assert.ok(restored.body.databaseResetAt > 0);
    assert.deepEqual((await call("GET", "/api/guild", token)).body, { guild: syncedGuild });
    const verifyRestored = new Database(database, { readonly: true });
    try { assert.equal(verifyRestored.prepare("SELECT count(*) AS n FROM theme_defaults WHERE id = 'test'").get().n, 1); }
    finally { verifyRestored.close(); }

    const customRestore = await fetch(`${origin}/api/admin/database/restore-upload`, {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/octet-stream" },
      body: bytes
    });
    assert.equal(customRestore.status, 200, await customRestore.text());

    const wiped = await call("POST", "/api/admin/database/wipe", token);
    assert.equal(wiped.status, 200, JSON.stringify(wiped.body));
    assert.match(wiped.body.backup.filename, /^flocksync-final-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\.db$/);
    assert.ok(wiped.body.databaseResetAt > restored.body.databaseResetAt);
    assert.deepEqual((await call("GET", "/api/guild", token)).body, { guild: null });
    const verifyWiped = new Database(database, { readonly: true });
    try {
      assert.equal(verifyWiped.prepare("SELECT count(*) AS n FROM theme_defaults").get().n, 0);
      assert.equal(verifyWiped.prepare("SELECT count(*) AS n FROM users").get().n, 1);
    } finally { verifyWiped.close(); }

    const stale = await call("POST", "/api/sync", token, {
      addonVersion: "test",
      exportedAt: wiped.body.databaseResetAt,
      officerCharacter: {
        guid: "pre-wipe-character", name: "Old", realm: "Realm", classId: 1, level: 60,
        isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 1 },
        gear: { items: [], updatedAt: 1 }, lastSeenAt: wiped.body.databaseResetAt
      },
      characters: [{
        guid: "pre-wipe-alt", name: "Old Alt", realm: "Realm", classId: 1, level: 60,
        isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 1 },
        gear: { items: [], updatedAt: 1 }, lastSeenAt: wiped.body.databaseResetAt - 1
      }]
    });
    assert.equal(stale.status, 200, JSON.stringify(stale.body));
    assert.equal(stale.body.databaseResetAt, wiped.body.databaseResetAt);
    const roster = await call("GET", "/api/roster", token);
    assert.deepEqual(roster.body, []);
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
