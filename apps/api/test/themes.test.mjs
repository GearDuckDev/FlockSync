import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import Database from "better-sqlite3";
import { validThemeImage } from "../dist/services/themeImages.js";

const jpeg = [
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS",
  "Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ",
  "CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy",
  "MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAA",
  "AAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAA",
  "AAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCLAGVxf//Z"
].join("");

test("theme image validation checks PNG/JPEG dimensions and rejects truncated JPEG segments", () => {
  const image = (bytes) => ({ image: "custom", opacity: 0.12, customImage: `data:image/jpeg;base64,${bytes.toString("base64")}` });
  const bytes = Buffer.from(jpeg, "base64");
  assert.equal(validThemeImage(image(bytes)), true);
  const oversized = Buffer.from(bytes);
  oversized.writeUInt16BE(4096, oversized.indexOf(Buffer.from([255, 192])) + 7);
  assert.equal(validThemeImage(image(oversized)), false);
  for (let length = 1; length < 32; length++) {
    assert.equal(validThemeImage(image(Buffer.from([255, 216, ...Array(length).fill(255), 192, 255, 217]))), false);
  }
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12); png.writeUInt32BE(3000, 16); png.writeUInt32BE(10, 20);
  assert.equal(validThemeImage({ image: "custom", opacity: 0.12, customImage: `data:image/png;base64,${png.toString("base64")}` }), false);
});

test("themes enforce permissions, preserve personal overrides, validate images, and survive restart", async () => {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = String(address.port);
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  const directory = await mkdtemp(join(tmpdir(), "flocksync-themes-"));
  const database = join(directory, "test.db");
  const origin = `http://127.0.0.1:${port}`;
  const credentials = { email: "theme-admin@example.com", password: "test-only-admin-password" };
  let child;
  let output = "";
  const stop = async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  };
  const start = async () => {
    child = spawn(process.execPath, [resolve("dist/server.js")], {
      env: {
        ...process.env, DATABASE_URL: database, HOST: "127.0.0.1", PORT: port,
        JWT_SECRET: "test-only-theme-key-not-for-deployment-1234",
        INITIAL_ADMIN_EMAIL: credentials.email, INITIAL_ADMIN_PASSWORD: credentials.password
      }, stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready && child.exitCode === null; attempt++) {
      try { ready = (await fetch(`${origin}/health`)).ok; }
      catch { await delay(100); }
    }
    assert.ok(ready, output);
  };
  const call = async (method, path, token, body) => {
    const res = await fetch(`${origin}/api${path}`, {
      method, headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {})
      }, ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return { status: res.status, body: await res.json() };
  };
  try {
    await start();
    const admin = (await call("POST", "/auth/login", undefined, credentials)).body;
    const member = (await call("POST", "/auth/register", undefined, {
      email: "theme-member@example.com", username: "theme-member", password: "secret1"
    })).body;
    const officerUser = await call("POST", "/users", admin.token, {
      email: "theme-officer@example.com", username: "theme-officer", password: "secret1", role: "OFFICER"
    });
    assert.equal(officerUser.status, 201);
    const officer = (await call("POST", "/auth/login", undefined, {
      email: "theme-officer@example.com", password: "secret1"
    })).body;
    const alliance = { image: "alliance", opacity: 0.12 };
    const horde = { image: "horde", opacity: 0.25 };
    assert.equal((await call("GET", "/themes")).status, 401);
    assert.equal((await call("PUT", "/themes/me", undefined, alliance)).status, 401);
    assert.deepEqual((await call("GET", "/themes", member.token)).body, {
      defaultTheme: { image: "none", opacity: 0.12 }, userTheme: null
    });
    for (const token of [member.token, officer.token]) {
      assert.equal((await call("PUT", "/themes/default", token, alliance)).status, 403);
    }
    assert.equal((await call("PUT", "/themes/default", admin.token, alliance)).status, 200);
    assert.deepEqual((await call("GET", "/themes", member.token)).body.defaultTheme, alliance);
    assert.equal((await call("PUT", "/themes/me", member.token, horde)).status, 200);
    assert.equal((await call("PUT", "/themes/default", admin.token, { image: "warcraft", opacity: 0.1 })).status, 200);
    assert.deepEqual((await call("GET", "/themes", member.token)).body.userTheme, horde);
    assert.equal((await call("GET", "/themes", officer.token)).body.userTheme, null);
    for (const invalid of [
      { image: "bad", opacity: 0.1 }, { image: "priory", opacity: 0.1 },
      { image: "horde", opacity: -1 },
      { image: "horde", opacity: 0.41 }, { image: "custom", opacity: 0.1 },
      { image: "alliance", opacity: 0.1, userId: admin.user.id },
      { image: "alliance", opacity: 0.1, customImage: "data:image/png;base64,YQ==" },
      { image: "custom", opacity: 0.1, customImage: "https://example.com/test.png" },
      { image: "custom", opacity: 0.1, customImage: "data:image/svg+xml;base64,PHN2Zz4=" },
      { image: "custom", opacity: 0.1, customImage: "data:image/png;base64,YQ==" },
      { image: "custom", opacity: 0.1, customImage: "data:image/jpeg;base64,YQ==" },
      { image: "custom", opacity: 0.1, customImage: `data:image/png;base64,${"A".repeat(750_000)}` }
    ]) {
      assert.equal((await call("PUT", "/themes/me", member.token, invalid)).status, 400);
    }
    const custom = {
      image: "custom", opacity: 0.18,
      customImage: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1kAAAAASUVORK5CYII="
    };
    assert.equal((await call("PUT", "/themes/me", member.token, {
      image: "custom", opacity: 0.4, customImage: `data:image/jpeg;base64,${jpeg}`
    })).status, 200);
    assert.equal((await call("PUT", "/themes/me", member.token, custom)).status, 200);
    await stop();
    await start();
    assert.deepEqual((await call("GET", "/themes", member.token)).body, {
      defaultTheme: { image: "warcraft", opacity: 0.1 }, userTheme: custom
    });
    assert.equal((await call("PUT", "/themes/me", member.token, null)).status, 200);
    assert.equal((await call("GET", "/themes", member.token)).body.userTheme, null);
    await call("PUT", "/themes/me", officer.token, horde);
    const deleted = await fetch(`${origin}/api/users/${officerUser.body.id}`, {
      method: "DELETE", headers: { authorization: `Bearer ${admin.token}` }
    });
    assert.equal(deleted.status, 204);
    const db = new Database(database, { readonly: true });
    try {
      assert.equal(db.prepare("SELECT count(*) AS n FROM user_themes").get().n, 0);
      assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 2);
    } finally { db.close(); }
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
