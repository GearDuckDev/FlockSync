import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = "http://web";
const password = "test-only-health-admin-password";
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "health-admin@example.com", password })
});
assert.equal(login.status, 200);
const { token } = await login.json();
const call = async (path, body, binary = false) => {
  const origin = process.env.RESOURCE_BASELINE === "1" && binary ? "http://api:3001" : base;
  const response = await fetch(`${origin}/api${path}`, {
    method: "POST", headers: { authorization: `Bearer ${token}`,
      "content-type": binary ? "application/octet-stream" : "application/json" },
    body: binary ? body : JSON.stringify(body), signal: AbortSignal.timeout(300_000)
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${path}: ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
};
const character = (index) => ({
  guid: `resource-character-${index}`, name: `Member${index}`, realm: "TestRealm",
  classId: 1, level: 60, isActive: true,
  role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: 100 },
  gear: { items: [], updatedAt: 100 }, lastSeenAt: 100,
  professions: { primary: [{ name: "Alchemy", level: 300, maxLevel: 300,
    recipes: Array.from({ length: 600 }, (_, recipe) => recipe + 1), acceptingRequests: false }],
    updatedAt: 100 }
});
const startedAt = Date.now();
await call("/sync", { addonVersion: "resource-test", exportedAt: 100,
  officerCharacter: character(0),
  characters: Array.from({ length: 500 }, (_, index) => character(index + 1)) });
const roster = await fetch(`${base}/api/roster?includeInactive=true`, {
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(roster.status, 200);
assert.equal((await roster.json()).length, 501);
const backup = await call("/admin/database/backup", {});
assert.ok(backup.backup.size > 0);
const snapshot = await readFile("/fixtures/large.db");
assert.equal(snapshot.length, 128 * 1024 * 1024);
await call("/admin/database/restore-upload", snapshot, true);
const ready = await fetch(`${base}/ready`);
assert.equal(ready.status, 200);
console.log(JSON.stringify({ event: "resource_workload_passed", characters: 501,
  syncedBackupBytes: backup.backup.size,
  restoreBytes: snapshot.length, elapsedMs: Date.now() - startedAt }));
