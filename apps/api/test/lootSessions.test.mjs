import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import Database from "better-sqlite3";
import { LootSessionAuditSchema, LootSessionDraftSchema } from "@flocksync/shared-types";
import { startLootTestServer } from "./lootTestServer.mjs";

test("officer draft sessions validate, audit, prevent conflicts, and survive restart/backup/restore", async (context) => {
  const fixture = await startLootTestServer(context);
  const { call, database, token } = fixture;
  const draft = {
    name: "  Weekly raid  ", instanceName: "Example Raid", scheduledAt: 1800000000,
    tiers: [{ name: "First choice", picks: 1 }, { name: "Second choice", picks: 2 }]
  };
  const member = await call("POST", "/api/auth/register", undefined, {
    email: "loot-member@example.com", username: "LootMember", password: "secret1"
  });
  assert.equal(member.status, 201);
  const officer = await call("POST", "/api/users", token, {
    email: "loot-officer@example.com", username: "LootOfficer", password: "secret1", role: "OFFICER"
  });
  assert.equal(officer.status, 201);
  const login = await call("POST", "/api/auth/login", undefined, {
    email: "loot-officer@example.com", password: "secret1"
  });
  assert.equal(login.status, 200);
  const officerToken = login.body.token;
  const base = "/api/loot/sessions";
  for (const [method, path, body] of [
    ["GET", base], ["POST", base, draft], ["GET", `${base}/${randomUUID()}`],
    ["GET", `${base}/${randomUUID()}/history`], ["PUT", `${base}/${randomUUID()}`, {}]
  ]) {
    assert.equal((await call(method, path, undefined, body)).status, 401);
    assert.equal((await call(method, path, member.body.token, body)).status, 403);
  }
  assert.equal((await call("POST", base, token, { ...draft, status: "LOCKED" })).status, 400);
  assert.equal((await call("POST", base, token, { ...draft, tiers: [] })).status, 400);
  const created = await call("POST", base, officerToken, draft);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const session = LootSessionDraftSchema.parse(created.body);
  assert.equal(session.name, "Weekly raid");
  assert.equal(session.createdBy, officer.body.id);
  assert.equal(session.status, "DRAFT");
  assert.equal(session.revision, 1);
  const path = `${base}/${session.id}`;
  assert.deepEqual((await call("GET", path, token)).body, session);
  assert.deepEqual((await call("GET", `${base}?limit=1&offset=0`, token)).body, [session]);
  assert.deepEqual((await call("GET", `${base}?offset=1`, token)).body, []);
  assert.equal((await call("GET", `${base}?limit=101`, token)).status, 400);
  assert.equal((await call("GET", `${base}/invalid`, token)).status, 400);
  assert.equal((await call("GET", `${base}/${randomUUID()}`, token)).status, 404);
  assert.equal((await call("GET", `${base}/${randomUUID()}/history`, token)).status, 404);
  const update = { ...draft, name: "Updated raid", expectedRevision: 1, reason: "Schedule review" };
  assert.equal((await call("PUT", path, token, { ...update, reason: "" })).status, 400);
  assert.equal((await call("PUT", `${base}/${randomUUID()}`, token, update)).status, 404);
  await delay(1100);
  const racing = await Promise.all([
    call("PUT", path, token, update),
    call("PUT", path, officerToken, { ...update, name: "Competing update" })
  ]);
  assert.deepEqual(racing.map((response) => response.status).sort(), [200, 409]);
  const saved = LootSessionDraftSchema.parse(racing.find((response) => response.status === 200).body);
  assert.equal(saved.revision, 2);
  assert.ok(saved.updatedAt > session.updatedAt);
  assert.equal((await call("PUT", path, token, update)).status, 409);
  let history = (await call("GET", `${path}/history`, token)).body.map((row) => LootSessionAuditSchema.parse(row));
  assert.equal(history.length, 2);
  assert.equal(history[0].before, null);
  assert.equal(history[0].actorUsername, "LootOfficer");
  assert.deepEqual(history[1].before, session);
  assert.deepEqual(history[1].after, saved);

  const writable = new Database(database);
  try {
    writable.prepare("UPDATE loot_sessions SET updated_at = ? WHERE id = ?")
      .run(Math.floor(Date.now() / 1000) + 60, session.id);
    const conflict = await call("PUT", path, token, { ...update, expectedRevision: 2 });
    assert.equal(conflict.status, 409);
    assert.match(conflict.body.error, /timestamp/);
    writable.prepare("UPDATE loot_sessions SET updated_at = ? WHERE id = ?").run(saved.updatedAt, session.id);
    writable.exec(`CREATE TRIGGER reject_loot_audit BEFORE INSERT ON loot_session_audit
      BEGIN SELECT RAISE(ABORT, 'test audit rejection'); END`);
    await delay(1100);
    assert.equal((await call("PUT", path, token, { ...update, expectedRevision: 2 })).status, 500);
    assert.deepEqual((await call("GET", path, token)).body, saved);
    assert.equal((await call("GET", `${path}/history`, token)).body.length, 2);
    writable.exec("DROP TRIGGER reject_loot_audit");
  } finally { writable.close(); }
  assert.equal((await call("PATCH", `/api/users/${officer.body.id}/role`, token, { role: "MEMBER" })).status, 200);
  assert.equal((await call("GET", base, officerToken)).status, 403);
  assert.equal((await call("DELETE", `/api/users/${officer.body.id}`, token)).status, 204);
  assert.equal((await call("GET", `${path}/history`, token)).body[0].actorId, officer.body.id);
  await fixture.restart();
  assert.deepEqual((await call("GET", path, token)).body, saved);
  assert.equal((await call("GET", `${path}/history`, token)).body.length, 2);

  const backupResponse = await call("POST", "/api/admin/database/backup", token);
  assert.equal(backupResponse.status, 200, JSON.stringify(backupResponse.body));
  const backup = backupResponse.body.backup;
  const snapshot = new Database(join(fixture.backups, backup.filename), { readonly: true });
  try {
    assert.equal(snapshot.prepare("SELECT count(*) AS n FROM loot_sessions").get().n, 1);
    assert.equal(snapshot.prepare("SELECT count(*) AS n FROM loot_session_audit").get().n, 2);
  } finally { snapshot.close(); }
  assert.equal((await call("POST", "/api/admin/database/wipe", token)).status, 200);
  assert.deepEqual((await call("GET", base, token)).body, []);
  const wiped = new Database(database, { readonly: true });
  try { assert.equal(wiped.prepare("SELECT count(*) AS n FROM loot_session_audit").get().n, 0); }
  finally { wiped.close(); }
  const restored = await call("POST", "/api/admin/database/restore", token, {
    relativeDirectory: "", filename: backup.filename
  });
  assert.equal(restored.status, 200, `${JSON.stringify(restored.body)}\n${fixture.logs()}`);
  assert.deepEqual((await call("GET", path, token)).body, saved);
  history = (await call("GET", `${path}/history`, token)).body;
  assert.equal(history.length, 2);
});
