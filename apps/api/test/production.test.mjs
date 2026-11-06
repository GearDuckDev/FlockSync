import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import Database from "better-sqlite3";
import { migrateDatabase } from "../dist/db/migrate.js";
import { checkGuildSnapshot } from "./snapshotChecks.mjs";
import { checkStaleCharacters } from "./staleChecks.mjs";
import { checkGearSync } from "./gearSyncChecks.mjs";

test("migrations initialize fresh DBs, adopt legacy rows, and are idempotent", async () => {
  const baseline = await readFile(new URL("../drizzle/0000_production_baseline.sql", import.meta.url), "utf8");
  for (const legacy of [false, true]) {
    const db = new Database(":memory:");
    try {
      if (legacy) {
        const oldSchema = baseline.split("\n").filter((line) =>
          !/`(?:availability|lockouts|professions|gear_goals|attunements)_(?:json|updated_at)`/.test(line)
          && !/`main_character_name`|`team_type`/.test(line)).join("\n");
        db.exec(oldSchema);
        db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run("kept", "kept@example.com", "kept", "hash", "ADMIN", 1);
        db.prepare(`INSERT INTO characters
          (guid, name, realm, class_id, level, primary_role, off_spec_enabled,
           role_updated_at, gear_json, gear_updated_at, last_seen_at, updated_by_officer_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run("kept-character", "Kept", "Realm", 1, 60, "DPS", 0, 1, "[]", 1, 1, "kept");
      }
      migrateDatabase(db);
      migrateDatabase(db);
      assert.equal(db.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get().n, 8);
      assert.ok(db.pragma("table_info(character_ownerships)").some((column) => column.name === "revision"));
      assert.ok(db.pragma("table_info(character_ownership_audit)").some((column) => column.name === "actor_id"));
      const columns = db.pragma("table_info(characters)").map((c) => c.name);
      assert.ok(columns.includes("attunements_json"));
      assert.ok(columns.includes("auto_stale"));
      assert.ok(columns.includes("main_character_name"));
      assert.ok(db.pragma("table_info(raid_teams)").some((c) => c.name === "team_type"));
      assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, legacy ? 1 : 0);
      if (legacy) {
        const character = db.prepare("SELECT name, gear_json, attunements_json FROM characters").get();
        assert.deepEqual(character, { name: "Kept", gear_json: "[]", attunements_json: "null" });
      }
    } finally {
      db.close();
    }
  }
});

test("built server boots an empty DB, seeds once, and serves authenticated routes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-production-"));
  const database = join(directory, "flocksync.db");
  const port = String(35000 + Math.floor(Math.random() * 10000));
  const origin = `http://127.0.0.1:${port}`;
  const email = "production-test@example.com";
  const password = "test-only-password-not-for-deployment";
  let child;
  let output = "";
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  };
  try {
    for (let pass = 0; pass < 2; pass++) {
      child = spawn(process.execPath, [resolve("dist/server.js")], {
        env: {
          ...process.env, DATABASE_URL: database, PORT: port, HOST: "127.0.0.1",
          JWT_SECRET: "test-only-jwt-key-not-for-deployment-1234",
          TRUSTED_PROXY_IP: "",
          INITIAL_ADMIN_EMAIL: email,
          INITIAL_ADMIN_PASSWORD: pass === 0 ? password : "different-password-for-second-start",
          PUBLIC_REGISTRATION_ENABLED: "false"
        },
        stdio: ["ignore", "pipe", "pipe"]
      });
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("error", (error) => { output += error.message; });
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          ready = (await fetch(`${origin}/health`)).ok;
        } catch { /* Startup is asynchronous; retry until the bounded deadline. */ }
        if (ready) break;
        if (child.exitCode !== null) break;
        await delay(100);
      }
      assert.ok(ready, output);
      const login = await fetch(`${origin}/api/auth/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      assert.equal(login.status, 200, output);
      const { token, user } = await login.json();
      assert.equal(user.role, "ADMIN");
      const registration = await fetch(`${origin}/api/auth/register`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "blocked@example.com", username: "blocked", password: "secret1" })
      });
      assert.equal(registration.status, 403, output);
      const roster = await fetch(`${origin}/api/roster`, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(roster.status, 200);
      assert.deepEqual(await roster.json(), []);
      const character = {
        guid: `officer-test-${pass}`, name: "Officer", realm: "Test", classId: 1, level: 60,
        isActive: true, role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 1 },
        gear: { items: [], updatedAt: 1 }, lastSeenAt: 1
      };
      const sync = await fetch(`${origin}/api/sync`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          addonVersion: "test", officerCharacter: character, characters: [], exportedAt: 1
        })
      });
      assert.equal(sync.status, 200);
      assert.equal((await sync.json()).isAuthorizedOfficer, true);
      await checkGuildSnapshot(origin, token, character);
      await checkStaleCharacters(origin, token, character);
      await checkGearSync(origin, token, character);
      const cleanup = await fetch(`${origin}/api/roster/${character.guid}`, {
        method: "DELETE", headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(cleanup.status, 204);
      await stop();
    }
    const db = new Database(database);
    try { assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 1); }
    finally { db.close(); }
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("auth rate limits use the socket IP, return retry headers, and expire", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-auth-limits-")), database = join(directory, "flocksync.db");
  const port = String(35000 + Math.floor(Math.random() * 10000)), origin = `http://127.0.0.1:${port}`;
  let output = "";
  const child = spawn(process.execPath, [resolve("dist/server.js")], {
    env: {
      ...process.env,
      DATABASE_URL: database,
      PORT: port,
      HOST: "127.0.0.1",
      JWT_SECRET: "test-only-jwt-key-not-for-deployment-1234",
      TRUSTED_PROXY_IP: "",
      PUBLIC_REGISTRATION_ENABLED: "true",
      AUTH_LOGIN_RATE_LIMIT_MAX: "1", AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: "5000",
      AUTH_REGISTER_RATE_LIMIT_MAX: "1", AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: "5000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  };
  const call = (path, body, headers = {}) =>
    fetch(`${origin}${path}`, {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body)
    });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
      try { ready = (await fetch(`${origin}/health`)).ok; } catch { await delay(100); }
    }
    assert.ok(ready, output);

    assert.equal((await call("/api/auth/login", { email: "missing@example.com", password: "wrong" })).status, 401);
    const blockedLogin = await call("/api/auth/login",
      { email: "missing@example.com", password: "wrong" }, { "x-forwarded-for": "203.0.113.1" });
    assert.equal(blockedLogin.status, 429);
    assert.ok(Number(blockedLogin.headers.get("retry-after")) > 0);

    await delay(5100);
    assert.equal((await call("/api/auth/login", { email: "missing@example.com", password: "wrong" })).status, 401);

    assert.equal((await call("/api/auth/register",
      { email: "first@example.com", username: "first", password: "secret1" })).status, 201);
    const blockedRegistration = await call("/api/auth/register",
      { email: "second@example.com", username: "second", password: "secret1" },
      { "x-forwarded-for": "203.0.113.2" });
    assert.equal(blockedRegistration.status, 429);
    assert.ok(Number(blockedRegistration.headers.get("retry-after")) > 0);
    await delay(5100);
    assert.equal((await call("/api/auth/register",
      { email: "second@example.com", username: "second", password: "secret1" })).status, 201, output);
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
