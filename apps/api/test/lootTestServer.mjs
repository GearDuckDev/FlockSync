import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const startLootTestServer = async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "flocksync-loot-"));
  const database = join(directory, "flocksync.db");
  const backups = join(directory, "backups");
  let child;
  let output = "";
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  };
  context.after(async () => {
    await stop();
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(backups);
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const port = listener.address().port;
  await new Promise((resolveClose, reject) => listener.close((error) => error ? reject(error) : resolveClose()));
  const origin = `http://127.0.0.1:${port}`;
  const email = "loot-admin@example.com";
  const password = "test-only-loot-admin-password";
  const start = async () => {
    output = "";
    child = spawn(process.execPath, [resolve("dist/server.js")], {
      env: {
        ...process.env, DATABASE_URL: database, BACKUP_DIRECTORY: backups,
        BACKUP_STORAGE_ID: "", TRUSTED_PROXY_IP: "", PORT: String(port), HOST: "127.0.0.1",
        JWT_SECRET: "test-only-loot-jwt-key-not-for-deployment-1234",
        INITIAL_ADMIN_EMAIL: email, INITIAL_ADMIN_PASSWORD: password,
        PUBLIC_REGISTRATION_ENABLED: "true",
        DOTENV_CONFIG_PATH: join(directory, "no-env-file")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", (error) => { output += error.message; });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
      try { ready = (await fetch(`${origin}/health`)).ok; } catch { /* Await bounded startup. */ }
      if (!ready) await delay(100);
    }
    assert.ok(ready, output);
  };
  const call = async (method, path, token, body) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  await start();
  const login = await call("POST", "/api/auth/login", undefined, { email, password });
  assert.equal(login.status, 200, output);
  return {
    call, database, backups, token: login.body.token, logs: () => output,
    restart: async () => { await stop(); await start(); }
  };
};
