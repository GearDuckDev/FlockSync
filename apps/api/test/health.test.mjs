import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

test("health distinguishes SQLite readiness and verified, stale, failed, missing and corrupt backups", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const directory = await mkdtemp(join(tmpdir(), "flocksync-health-"));
  const backups = join(directory, "backups");
  await mkdir(backups);
  Object.assign(process.env, {
    DATABASE_URL: join(directory, "test.db"), BACKUP_DIRECTORY: backups,
    JWT_SECRET: "test-only-health-secret-not-for-deployment", TRUSTED_PROXY_IP: ""
  });
  const { healthRoutes } = await import("../dist/routes/health.routes.js");
  const { registerAuthPlugin } = await import("../dist/plugins/auth.js");
  const { createUser } = await import("../dist/services/users.service.js");
  const { sqliteConnection } = await import("../dist/db/index.js");
  const { createDatabaseBackup } = await import("../dist/services/databaseAdmin.service.js");
  const { readBackupHealth } = await import("../dist/services/backupHealth.js");
  const events = [];
  const app = Fastify({ logger: { stream: { write: (line) => events.push(JSON.parse(line)) } } });
  await app.register(rateLimit, { global: false });
  await registerAuthPlugin(app);
  await app.register(healthRoutes);
  const admin = await createUser({ email: "health-admin@example.com", username: "admin",
    password: "health-test-password", role: "ADMIN" });
  const member = await createUser({ email: "health-member@example.com", username: "member",
    password: "health-test-password", role: "MEMBER" });
  assert.ok(admin.ok && member.ok);
  const token = (user) => app.jwt.sign({
    id: user.id, email: user.email, username: user.username, role: user.role
  });
  const get = (url, user) => app.inject({ url,
    ...(user ? { headers: { authorization: `Bearer ${token(user)}` } } : {}) });
  try {
    assert.deepEqual((await get("/health")).json(), { status: "ok" });
    assert.deepEqual((await get("/ready")).json(), { status: "ok" });
    assert.equal((await get("/api/admin/health")).statusCode, 401);
    assert.equal((await get("/api/admin/health", member.user)).statusCode, 403);
    const missing = await get("/api/admin/health", admin.user);
    assert.equal(missing.json().status, "missing");
    assert.equal(missing.headers["cache-control"], "no-store");
    const backup = await createDatabaseBackup();
    assert.equal((await readBackupHealth()).status, "healthy");
    const receiptPath = join(directory, "backup-health-api-success.json");
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    assert.equal(receipt.sha256.length, 64);
    await writeFile(receiptPath, JSON.stringify({ ...receipt, verifiedAt: receipt.verifiedAt - 36 * 3600 }));
    assert.equal((await readBackupHealth()).status, "healthy");
    await writeFile(receiptPath, JSON.stringify({ ...receipt, verifiedAt: receipt.verifiedAt - 36 * 3600 - 1 }));
    assert.equal((await readBackupHealth()).status, "stale");
    await writeFile(receiptPath, JSON.stringify(receipt));
    await writeFile(join(directory, "backup-health-scheduled-attempt.json"), JSON.stringify({
      attemptedAt: receipt.verifiedAt, status: "failed"
    }));
    assert.equal((await readBackupHealth()).status, "failed");
    await rm(join(directory, "backup-health-scheduled-attempt.json"));
    await writeFile(join(backups, backup.filename), "corrupted backup");
    const corrupt = await get("/api/admin/health", admin.user);
    assert.equal(corrupt.statusCode, 503);
    assert.equal(corrupt.json().status, "unavailable");
    assert.ok(!corrupt.body.includes(directory));
    await rm(join(backups, backup.filename));
    assert.equal((await get("/api/admin/health", admin.user)).statusCode, 503);
    await writeFile(receiptPath, "not json");
    assert.equal((await get("/api/admin/health", admin.user)).statusCode, 503);
    await writeFile(join(directory, "admin-database-state.json"), JSON.stringify({
      backupDirectory: "..", databaseResetAt: 0
    }));
    await assert.rejects(createDatabaseBackup());
    assert.equal(JSON.parse(await readFile(join(directory, "backup-health-api-attempt.json"), "utf8")).status, "failed");
    await writeFile(join(directory, "admin-database-state.json"), JSON.stringify({
      backupDirectory: "", databaseResetAt: 0
    }));
    await createDatabaseBackup();
    assert.equal((await readBackupHealth()).status, "healthy");
    await rm(backups, { recursive: true });
    await assert.rejects(readBackupHealth());
    sqliteConnection.close();
    const notReady = await get("/ready");
    assert.equal(notReady.statusCode, 503);
    assert.deepEqual(notReady.json(), { status: "unavailable" });
    assert.deepEqual((await get("/health")).json(), { status: "ok" });
    assert.ok(events.some((entry) => entry.event === "readiness_failed"));
    assert.ok(events.some((entry) => entry.event === "backup_health_unavailable"));
    const brokenDatabase = join(directory, "broken.db");
    await writeFile(brokenDatabase, "not a SQLite database");
    const startup = spawnSync(process.execPath, ["dist/server.js"], {
      env: { ...process.env, DATABASE_URL: brokenDatabase },
      encoding: "utf8", timeout: 10_000
    });
    assert.notEqual(startup.status, 0);
    assert.match(startup.stderr, /sqlite_initialization_failed/);
  } finally {
    await app.close();
    if (sqliteConnection.open) sqliteConnection.close();
    await rm(directory, { recursive: true, force: true });
  }
});
