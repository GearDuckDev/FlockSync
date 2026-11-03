import assert from "node:assert/strict";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

const base = "http://web";
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "health-admin@example.com", password: "test-only-health-admin-password" })
});
assert.equal(login.status, 200);
const { token } = await login.json();
const malformed = async (path, method, authenticated) => {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { "content-type": "application/json",
      ...(authenticated ? { authorization: `Bearer ${token}` } : {}) },
    body: "{invalid-json"
  });
  return response.status;
};
assert.equal(await malformed("/sync", "POST", false), 401);
assert.equal(await malformed("/themes/me", "PUT", false), 401);
assert.equal(await malformed("/admin/database/restore", "POST", false), 401);
const oversized = async (path, size, type = "application/json") => {
  const response = await fetch(`${base}/api${path}`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": type },
    body: Buffer.alloc(size, 32), signal: AbortSignal.timeout(30_000)
  });
  return response.status;
};
assert.equal(await oversized("/auth/login", 4097), 413);
assert.equal(await oversized("/admin/database/restore", 1024 * 1024 + 1), 413);
assert.equal(await oversized("/sync", 10 * 1024 * 1024 + 1), 413);
assert.equal(await oversized("/admin/database/restore-upload", 128 * 1024 * 1024 + 1,
  "application/octet-stream"), 413);

// Hold one authenticated upload open before parsing finishes.
const held = http.request(`${base}/api/admin/database/restore-upload`, {
  method: "POST", headers: { authorization: `Bearer ${token}`,
    "content-type": "application/octet-stream", "content-length": 128 * 1024 * 1024 }
});
held.on("error", () => { /* Expected local abort after the admission assertion. */ });
try {
  held.write(Buffer.from([0]));
  await delay(500);
  const busy = await fetch(`${base}/api/admin/database/restore-upload`, {
    method: "POST", headers: { authorization: `Bearer ${token}`,
      "content-type": "application/octet-stream" }, body: Buffer.from([0])
  });
  assert.equal(busy.status, 409);
  assert.ok(Number(busy.headers.get("retry-after")) > 0);
} finally {
  held.destroy();
}
await delay(500);
const released = await fetch(`${base}/api/admin/database/restore-upload`, {
  method: "POST", headers: { authorization: `Bearer ${token}`,
    "content-type": "application/octet-stream" }, body: Buffer.from([0])
});
assert.equal(released.status, 400, "Aborting a partial upload must release admission");
console.log("PASS: early auth, exact body ceilings, single-upload admission and abort cleanup.");
