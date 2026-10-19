import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";

test("registration, admin user management, and role guards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-users-"));
  const port = String(45000 + Math.floor(Math.random() * 10000));
  const origin = `http://127.0.0.1:${port}`;
  const adminEmail = "root-admin@example.com";
  const adminPassword = "test-only-root-admin-password";
  let output = "";
  const child = spawn(process.execPath, [resolve("dist/server.js")], {
    env: {
      ...process.env, DATABASE_URL: join(directory, "flocksync.db"), PORT: port, HOST: "127.0.0.1",
      JWT_SECRET: "test-only-jwt-key-not-for-deployment-1234",
      INITIAL_ADMIN_EMAIL: adminEmail, INITIAL_ADMIN_PASSWORD: adminPassword
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  const call = async (method, path, token, body) => {
    const headers = {};
    if (token) headers.authorization = "Bearer " + token;
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${origin}${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
      try { ready = (await fetch(`${origin}/health`)).ok; } catch { await delay(100); }
    }
    assert.ok(ready, output);

    const admin = await call("POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword });
    assert.equal(admin.status, 200, output);
    const adminToken = admin.body.token;

    const reg = await call("POST", "/api/auth/register", undefined, {
      email: "Raider@Example.com", username: "raider", password: "secret1"
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.user.role, "MEMBER");
    const memberToken = reg.body.token;
    const memberId = reg.body.user.id;

    assert.equal((await call("POST", "/api/auth/register", undefined, {
      email: "raider@example.com", username: "other", password: "secret1"
    })).status, 409);
    assert.equal((await call("POST", "/api/auth/register", undefined, {
      email: "x@example.com", username: "x", password: "123"
    })).status, 400);
    assert.equal((await call("POST", "/api/auth/register", undefined, {
      email: "sneaky@example.com", username: "sneaky", password: "secret1", role: "ADMIN"
    })).status, 400);
    assert.equal((await call("POST", "/api/auth/login", undefined, {
      email: "raider@example.com", password: "secret1"
    })).status, 200);

    // Members can read shared data but not officer/admin routes.
    assert.equal((await call("GET", "/api/roster", memberToken)).status, 200);
    assert.equal((await call("GET", "/api/raids", memberToken)).status, 200);
    assert.equal((await call("GET", "/api/ledger/loot", memberToken)).status, 200);
    assert.equal((await call("GET", "/api/tasks", memberToken)).status, 403);
    assert.equal((await call("GET", "/api/users", memberToken)).status, 403);
    assert.equal((await call("DELETE", "/api/raids/none", memberToken)).status, 403);

    const list = await call("GET", "/api/users", adminToken);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 2);
    const root = list.body.find((u) => u.email === adminEmail);
    assert.equal(root.isRootAdmin, true);
    assert.equal(typeof root.createdAt, "number");

    const created = await call("POST", "/api/users", adminToken, {
      email: "officer@example.com", username: "officer", password: "secret1", role: "OFFICER"
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.role, "OFFICER");

    const usernamePath = `/api/users/${memberId}/username`;
    assert.equal((await call("PATCH", usernamePath, undefined, { username: "NoAuth" })).status, 401);
    const renamed = await call("PATCH", usernamePath, memberToken, { username: "  Ducky  " });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.username, "Ducky");
    assert.equal(renamed.body.role, "MEMBER");
    assert.equal(renamed.body.email, "Raider@Example.com");
    assert.equal((await call("GET", "/api/auth/me", memberToken)).body.username, "Ducky");
    assert.equal((await call("POST", "/api/auth/login", undefined, {
      email: "raider@example.com", password: "secret1"
    })).body.user.username, "Ducky");
    assert.equal((await call("PATCH", usernamePath, memberToken, { username: "ducky" })).status, 200);
    assert.equal((await call("PATCH", usernamePath, memberToken, { username: "OFFICER" })).status, 409);
    for (const username of [" ", "x", "x".repeat(33), 123, null]) {
      assert.equal((await call("PATCH", usernamePath, memberToken, { username })).status, 400);
    }
    assert.equal((await call("PATCH", usernamePath, memberToken, { username: "Valid", role: "ADMIN" })).status, 400);
    assert.equal((await call("PATCH", `/api/users/${root.id}/username`, memberToken, { username: "Forbidden" })).status, 403);
    assert.equal((await call("PATCH", usernamePath, adminToken, { username: "RootAssigned" })).status, 200);
    assert.equal((await call("PATCH", "/api/users/missing/username", adminToken, { username: "Missing" })).status, 404);
    assert.equal((await call("PATCH", `/api/users/${root.id}/username`, adminToken, { username: "RootRenamed" })).status, 200);
    assert.equal((await call("GET", "/api/users", adminToken)).body.find((u) => u.id === root.id).isRootAdmin, true);

    const officerLogin = await call("POST", "/api/auth/login", undefined, {
      email: "officer@example.com", password: "secret1"
    });
    const officerToken = officerLogin.body.token;
    const officerPath = `/api/users/${created.body.id}/username`;
    assert.equal((await call("PATCH", officerPath, officerToken, { username: "OfficerRenamed" })).status, 200);
    assert.equal((await call("PATCH", usernamePath, officerToken, { username: "Forbidden" })).status, 403);
    await call("PATCH", `/api/users/${created.body.id}/role`, adminToken, { role: "ADMIN" });
    assert.equal((await call("PATCH", usernamePath, officerToken, { username: "StillForbidden" })).status, 403);
    assert.equal((await call("PATCH", officerPath, officerToken, { username: "AdminRenamed" })).status, 200);

    // Role changes apply immediately to tokens issued before the change.
    const promoted = await call("PATCH", `/api/users/${memberId}/role`, adminToken, { role: "OFFICER" });
    assert.equal(promoted.status, 200);
    assert.equal((await call("GET", "/api/tasks", memberToken)).status, 200);
    assert.equal((await call("GET", "/api/auth/me", memberToken)).body.role, "OFFICER");

    assert.equal((await call("PATCH", `/api/users/${root.id}/role`, adminToken, { role: "MEMBER" })).status, 403);
    assert.equal((await call("DELETE", `/api/users/${root.id}`, adminToken)).status, 403);
    assert.equal((await call("PATCH", `/api/users/${memberId}/role`, adminToken, { role: "KING" })).status, 400);
    assert.equal((await call("DELETE", "/api/users/missing", adminToken)).status, 404);

    assert.equal((await call("DELETE", `/api/users/${memberId}`, adminToken)).status, 204);
    assert.equal((await call("GET", "/api/roster", memberToken)).status, 401);
    assert.equal((await call("GET", "/api/users", adminToken)).body.length, 2);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
