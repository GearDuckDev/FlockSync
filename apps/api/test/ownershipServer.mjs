import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";

export const startOwnershipServer = async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-ownership-"));
  const backups = join(directory, "backups");
  await mkdir(backups);
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${address.port}`;
  let output = "";
  const child = spawn(process.execPath, [resolve("dist/server.js")], {
    env: {
      ...process.env, DOTENV_CONFIG_PATH: join(directory, "no-env"),
      DATABASE_URL: join(directory, "test.db"), BACKUP_DIRECTORY: backups,
      HOST: "127.0.0.1", PORT: new URL(origin).port,
      JWT_SECRET: "test-only-ownership-key-not-for-deployment",
      INITIAL_ADMIN_EMAIL: "root@example.com", INITIAL_ADMIN_PASSWORD: "test-only-root-password",
      TRUSTED_PROXY_IP: "", PUBLIC_REGISTRATION_ENABLED: "false",
      AUTH_LOGIN_RATE_LIMIT_MAX: "100"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  context.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  });
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
    try { ready = (await fetch(`${origin}/health`)).ok; } catch { await delay(100); }
  }
  assert.ok(ready, output);
  const call = async (method, path, token, body) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const login = async (email, password = "test-only-member-password") => {
    const result = await call("POST", "/auth/login", undefined, { email, password });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  const admin = await login("root@example.com", "test-only-root-password");
  const create = async (username, role = "MEMBER") => {
    const email = `${username}@example.com`;
    const result = await call("POST", "/users", admin.token, {
      email, username, password: "test-only-member-password", role
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return login(email);
  };
  return { call, admin, create };
};
