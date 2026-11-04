import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { createAuthRateLogger } from "../dist/services/authRateLog.js";

test("auth warnings sample each endpoint once per minute without account details", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  const warnings = [];
  const request = { log: { warn: (...args) => warnings.push(args) },
    ip: "192.0.2.1", body: { email: "private@example.com", password: "private" } };
  const login = createAuthRateLogger("login");
  const register = createAuthRateLogger("register");
  login(request);
  login(request);
  register(request);
  assert.equal(warnings.length, 2);
  t.mock.timers.tick(59_999);
  login(request);
  assert.equal(warnings.length, 2);
  t.mock.timers.tick(1);
  login(request);
  assert.equal(warnings.length, 3);
  assert.deepEqual(warnings.map(([fields]) => fields), ["login", "register", "login"]
    .map((route) => ({ event: "auth_rate_limit_exceeded", route })));
  assert.ok(!JSON.stringify(warnings).includes("private"));
  t.mock.timers.reset();
});

test("registration defaults on; disabling it preserves member login and admin account creation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-auth-controls-"));
  const port = String(35000 + Math.floor(Math.random() * 10000));
  const origin = `http://127.0.0.1:${port}`;
  const credentials = { email: "root@example.com", password: "test-only-admin-password" };
  const member = { email: "member@example.com", username: "member", password: "secret1" };
  let child;
  let output = "";
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  };
  const start = async (enabled) => {
    const environment = { ...process.env, HOST: "127.0.0.1", PORT: port,
      DATABASE_URL: join(directory, "test.db"), JWT_SECRET: "test-only-jwt-secret-not-for-deployment",
      INITIAL_ADMIN_EMAIL: credentials.email, INITIAL_ADMIN_PASSWORD: credentials.password,
      TRUSTED_PROXY_IP: "", AUTH_LOGIN_RATE_LIMIT_MAX: "20", AUTH_REGISTER_RATE_LIMIT_MAX: "10" };
    delete environment.PUBLIC_REGISTRATION_ENABLED;
    if (enabled !== undefined) environment.PUBLIC_REGISTRATION_ENABLED = enabled;
    child = spawn(process.execPath, [resolve("dist/server.js")], {
      env: environment, stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(`${origin}/health`)).ok) return; } catch { /* Await bounded startup. */ }
      if (child.exitCode !== null) break;
      await delay(100);
    }
    assert.fail(`Test API failed to start: ${output}`);
  };
  const post = async (path, body, token) => {
    const response = await fetch(`${origin}/api${path}`, {
      method: "POST", headers: { "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    await start(undefined);
    assert.equal((await post("/auth/register", member)).status, 201);
    await stop();
    await start("false");
    assert.equal((await post("/auth/register", {
      ...member, email: "blocked@example.com", username: "blocked"
    })).status, 403);
    assert.equal((await post("/auth/login", member)).status, 400, "Strict login schema rejects username");
    assert.equal((await post("/auth/login", {
      email: member.email, password: member.password
    })).status, 200);
    const root = await post("/auth/login", credentials);
    assert.equal(root.status, 200);
    const officer = { email: "officer@example.com", username: "officer", password: "secret1", role: "OFFICER" };
    assert.equal((await post("/users", officer, root.body.token)).status, 201);
    assert.equal((await post("/auth/login", {
      email: officer.email, password: officer.password
    })).status, 200);
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
