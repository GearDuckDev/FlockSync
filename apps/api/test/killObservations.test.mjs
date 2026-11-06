import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("shared observation persistence, immutable events, privacy, retention, deduplication and reset recovery", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const member = await create("observer");
  const now = Math.floor(Date.now() / 1000), created = now - 100 * 86400;
  const target = { name: "Enemy One", realm: "Realm", author: "Member One", authorGuid: "Member",
    actorGuid: "Member", note: "Published", createdAt: created, updatedAt: created, deleted: false };
  const character = { guid: "Officer", name: "Officer One", realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now - 20 },
    gear: { items: [], updatedAt: now - 20 }, lastSeenAt: now - 20 };
  const sighting = { id: "sighting", kind: "SIGHTING", name: target.name, realm: "Realm",
    targetGuid: "Enemy", targetCreatedAt: created, timestamp: now - 10, zone: "Zone One",
    reporterGuid: "Member", reporter: "Member One" };
  const battle = { ...sighting, id: "battle", kind: "KILL", actorGuid: "Member", actor: "Member One",
    victimGuid: "Enemy", victim: target.name };
  const payload = { addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: now, officerCharacter: character, characters: [], sharedKillList: [target] };
  const upload = (entries, extra = {}) => call("POST", "/sync", admin.token,
    { ...payload, sharedKillObservations: entries, ...extra });
  const read = () => call("GET", "/kill-list/observations", member.token);
  assert.equal((await call("GET", "/kill-list/observations")).status, 401);
  assert.equal((await call("POST", "/sync", member.token, { ...payload, sharedKillObservations: [sighting] })).status, 403);
  assert.equal((await upload([sighting, battle])).status, 200);
  assert.equal((await read()).body.length, 2);
  assert.equal((await upload([battle, { ...battle, id: "second-observer", reporterGuid: "Other", reporter: "Other One",
    timestamp: battle.timestamp + 2 }])).body.sharedKillObservations.length, 2, "Same battle from two observers deduplicates");
  assert.equal((await upload([{ ...battle, zone: "Tampered immutable battle" }])).status, 409);
  assert.equal((await upload([{ ...sighting, privateNote: "private" }])).status, 400);
  assert.equal((await upload([{ ...sighting, realm: "Other" }])).status, 400);
  assert.equal((await upload([sighting], { collectorGuild: undefined })).status, 400);
  assert.equal((await upload([{ ...sighting, timestamp: now + 999 }])).status, 400);
  assert.equal((await upload([{ ...battle, actorGuid: undefined }])).status, 400);
  assert.equal((await upload([{ ...sighting, timestamp: now - 20, zone: "Stale" }])).status, 200);
  assert.equal((await read()).body.find((row) => row.kind === "SIGHTING").zone, "Zone One");
  const privateTarget = { ...sighting, name: "Private", id: "private" };
  assert.equal((await upload([privateTarget, { ...sighting, targetCreatedAt: created + 1 }])).status, 200);
  assert.equal((await read()).body.length, 2, "Only current published target creation can receive reports");
  const oldest = { ...battle, id: "expired", timestamp: now - 91 * 86400 };
  await upload([oldest]);
  assert.ok(!(await read()).body.some((row) => row.id === oldest.id));
  const many = Array.from({ length: 5001 }, (_, index) => ({ ...battle, id: `limit-${index}`,
    timestamp: now - 20 - index * 6 }));
  const limited = await upload(many);
  assert.equal(limited.status, 200, JSON.stringify(limited.body).slice(0, 200));
  assert.equal(limited.body.sharedKillObservations.filter((row) => row.kind !== "SIGHTING").length, 5000);
  assert.ok(!limited.body.sharedKillObservations.some((row) => row.id === "limit-5000"));
  const backup = await call("POST", "/admin/database/backup", admin.token);
  assert.equal(backup.status, 200);
  assert.equal((await call("POST", "/admin/database/wipe", admin.token)).status, 200);
  assert.deepEqual((await read()).body, []);
  await upload([sighting, battle]);
  assert.deepEqual((await read()).body, [], "Pre-reset game export cannot resurrect observations");
  const restored = await call("POST", "/admin/database/restore", admin.token, {
    filename: backup.body.backup.filename, relativeDirectory: backup.body.backup.relativeDirectory
  });
  assert.equal(restored.status, 200);
  assert.equal((await read()).body.length, 5001, "Restore keeps battle history and latest sighting without rebasing evidence timestamps");
  const active = (await call("GET", "/kill-list", member.token)).body[0];
  await delay(Math.max(0, (active.updatedAt + 1) * 1000 - Date.now()));
  const removed = await call("DELETE", "/kill-list", admin.token, {
    name: target.name, realm: target.realm, expectedUpdatedAt: active.updatedAt
  });
  assert.equal(removed.status, 200);
  assert.deepEqual((await read()).body, [], "Deleted target history cannot leak into a later creation");
  await delay(Math.max(0, (removed.body.updatedAt + 1) * 1000 - Date.now()));
  const epoch = Math.floor(Date.now() / 1000);
  assert.equal((await upload([sighting, battle], {
    exportedAt: epoch, sharedKillList: [{ ...target, createdAt: epoch, updatedAt: epoch }]
  })).status, 200);
  assert.deepEqual((await read()).body, [], "Re-added target rejects previous creation's replayed evidence");
});
