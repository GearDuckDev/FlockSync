import assert from "node:assert/strict";
import { test } from "node:test";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("officer persists guild kills; signed-in members can edit/remove and tombstones survive stale uploads", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const alice = await create("kill-alice"), bob = await create("kill-bob");
  const now = Math.floor(Date.now() / 1000);
  const character = {
    guid: "Author-1", name: "Author One", realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now - 20 },
    gear: { items: [], updatedAt: now - 20 }, lastSeenAt: now - 20
  };
  const entry = {
    name: "Enemy One", realm: "Realm", author: "Author One", authorGuid: character.guid,
    actorGuid: character.guid, note: "Guild note", createdAt: now - 20, updatedAt: now - 20, deleted: false
  };
  const payload = {
    addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: now, officerCharacter: character, characters: [], sharedKillList: [entry]
  };
  const upload = (value = payload) => call("POST", "/sync", admin.token, value);
  assert.equal((await call("GET", "/kill-list")).status, 401);
  assert.equal((await call("POST", "/sync", alice.token, payload)).status, 403);
  const persisted = await upload();
  assert.equal(persisted.status, 200);
  assert.deepEqual(persisted.body.sharedKillList, [entry]);
  assert.deepEqual((await call("GET", "/kill-list", bob.token)).body, [entry], "All signed-in users can view");
  const edit = { name: entry.name, realm: entry.realm, expectedUpdatedAt: entry.updatedAt, note: "Member edit" };
  const edited = await call("PATCH", "/kill-list", alice.token, edit);
  assert.equal(edited.status, 200);
  assert.equal(edited.body.authorGuid, character.guid);
  assert.equal(edited.body.actorGuid, alice.user.id);
  assert.equal(edited.body.createdAt, entry.createdAt);
  assert.equal((await call("PATCH", "/kill-list", alice.token, edit)).status, 409);
  const returned = await upload();
  assert.equal(returned.body.sharedKillList[0].note, "Member edit", "Stale game snapshot cannot undo web edit");
  assert.deepEqual(returned.body.characterLinks, [], "Kill-list changes do not create character ownership links");
  assert.equal((await upload({ ...payload, sharedKillList: [{ ...entry, updatedAt: now + 999 }] })).status, 400);
  assert.equal((await upload({ ...payload, sharedKillList: [{ ...entry, realm: "Other" }] })).status, 400);
  assert.equal((await upload({ ...payload, collectorGuild: undefined })).status, 400);
  assert.equal((await upload({ ...payload, sharedKillList: [{ ...entry, note: "x".repeat(501) }] })).status, 400);
  assert.equal((await upload({ ...payload, sharedKillList: [{ ...entry, privateHistory: [] }] })).status, 400);
  assert.equal((await call("PATCH", "/kill-list", alice.token, {
    ...edit, authorGuid: "Spoofed"
  })).status, 400);

  const second = { ...entry, name: "Enemy Two", note: "Second" };
  const third = { ...entry, name: "Enemy Three", note: "Third", authorGuid: "Another-Author" };
  const fourth = { ...entry, name: "Enemy Four", note: "Fourth" };
  assert.equal((await upload({ ...payload, sharedKillList: [second, third, fourth] })).status, 200);
  const thirdEdit = await call("PATCH", "/kill-list", alice.token, {
    ...edit, name: third.name
  });
  assert.equal(thirdEdit.status, 200, "A signed-in member can edit another author's target without a character link");
  const removed = await call("DELETE", "/kill-list", alice.token, {
    name: second.name, realm: second.realm, expectedUpdatedAt: second.updatedAt
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.deleted, true);
  const stale = await upload({ ...payload, sharedKillList: [entry, second, third] });
  assert.equal(stale.status, 200);
  assert.equal(stale.body.sharedKillList.find((row) => row.name === second.name).deleted, true);
  assert.equal(stale.body.sharedKillList.find((row) => row.name === third.name).note, "Member edit");
  assert.equal((await upload({
    ...payload, sharedKillList: [{ ...second, updatedAt: removed.body.updatedAt + 1 }]
  })).status, 409, "A later edit to an old creation cannot resurrect a tombstone");
  while (Math.floor(Date.now() / 1000) <= removed.body.updatedAt) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal((await call("PATCH", "/kill-list", admin.token, {
    ...edit, name: second.name
  })).status, 404, "Web cannot resurrect a removed target");
  const readdedAt = removed.body.updatedAt + 1;
  const editedReadd = {
    ...second, note: "Edited before sync", createdAt: readdedAt, updatedAt: readdedAt + 1
  };
  const readded = await upload({ ...payload, sharedKillList: [editedReadd] });
  assert.equal(readded.status, 200, "An edited re-add snapshot supersedes its older removal");
  assert.equal(readded.body.sharedKillList.find((row) => row.name === second.name).note, editedReadd.note);
  assert.ok((await call("GET", "/kill-list", alice.token)).body.some((row) => row.name === second.name));
  const missedRemovalReadd = {
    ...fourth, authorGuid: "New-Author", createdAt: now - 10, updatedAt: now - 9
  };
  const caughtUp = await upload({ ...payload, sharedKillList: [missedRemovalReadd] });
  assert.equal(caughtUp.status, 200, "A newer creation identity repairs a missed remove/re-add");
  assert.equal(caughtUp.body.sharedKillList.find((row) => row.name === fourth.name).authorGuid, missedRemovalReadd.authorGuid);
  const conflicting = await upload({
    ...payload, sharedKillList: [{ ...entry, authorGuid: "Spoofed", updatedAt: now + 1 }]
  });
  assert.equal(conflicting.status, 409);
  assert.equal((await call("GET", "/kill-list", bob.token)).body.find((row) => row.name === entry.name).authorGuid, character.guid);
  const backup = await call("POST", "/admin/database/backup", admin.token);
  assert.equal(backup.status, 200);
  const restored = await call("POST", "/admin/database/restore", admin.token, {
    filename: backup.body.backup.filename, relativeDirectory: backup.body.backup.relativeDirectory
  });
  assert.equal(restored.status, 200);
  assert.equal((await call("GET", "/kill-list", bob.token)).body.length, 4, "Backup retains kills and removal markers");
  const restoredReturn = await upload();
  assert.ok(restoredReturn.body.sharedKillList.every((row) => row.updatedAt > restored.body.databaseResetAt),
    "Restored kills/tombstones cross reset fence for helper recovery");
  assert.equal((await call("POST", "/admin/database/wipe", admin.token)).status, 200);
  assert.deepEqual((await call("GET", "/kill-list", bob.token)).body, []);
  const replay = await upload();
  assert.equal(replay.status, 200);
  assert.deepEqual((await call("GET", "/kill-list", bob.token)).body, [], "Pre-reset game export cannot resurrect kills");
});

test("any authenticated account can add, edit and remove shared targets without character ownership", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const alice = await create("kill-add-alice"), bob = await create("kill-add-bob");
  const now = Math.floor(Date.now() / 1000);
  const character = {
    guid: "Officer-1", name: "Officer One", realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now - 20 },
    gear: { items: [], updatedAt: now - 20 }, lastSeenAt: now - 20
  };
  assert.equal((await call("POST", "/sync", admin.token, {
    addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: now, officerCharacter: character, characters: []
  })).status, 200);
  assert.equal((await call("POST", "/kill-list", undefined, { name: "Web Target", note: "" })).status, 401);
  assert.equal((await call("POST", "/kill-list", alice.token, { name: "", note: "" })).status, 400);
  assert.equal((await call("POST", "/kill-list", alice.token, { name: "Bad[Target]", note: "" })).status, 400);
  const added = await call("POST", "/kill-list", alice.token, { name: "web target", note: "Added online" });
  assert.equal(added.status, 201);
  assert.equal(added.body.name, "Web Target");
  assert.equal(added.body.author, alice.user.username);
  assert.equal(added.body.authorGuid, alice.user.id);
  assert.equal(added.body.actorGuid, alice.user.id);
  assert.equal(added.body.realm, "Realm");
  assert.equal((await call("POST", "/kill-list", bob.token, { name: "Web Target", note: "" })).status, 409);
  const synced = await call("POST", "/sync", admin.token, {
    addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: Math.floor(Date.now() / 1000), officerCharacter: character, characters: []
  });
  assert.equal(synced.status, 200);
  assert.ok(synced.body.sharedKillList.some((entry) => entry.name === "Web Target"),
    "Web additions return through collector sync");

  while (Math.floor(Date.now() / 1000) <= added.body.updatedAt) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const edited = await call("PATCH", "/kill-list", bob.token, {
    name: added.body.name, realm: added.body.realm, expectedUpdatedAt: added.body.updatedAt, note: "Changed by another member"
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.authorGuid, alice.user.id);
  assert.equal(edited.body.actorGuid, bob.user.id);
  while (Math.floor(Date.now() / 1000) <= edited.body.updatedAt) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const removed = await call("DELETE", "/kill-list", admin.token, {
    name: added.body.name, realm: added.body.realm, expectedUpdatedAt: edited.body.updatedAt
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.deleted, true);
  assert.deepEqual((await call("GET", "/kill-list", alice.token)).body, []);
});

test("shared kill catalog rejects additions beyond the return-payload limit", async (t) => {
  const { call, admin } = await startOwnershipServer(t);
  const now = Math.floor(Date.now() / 1000);
  const character = {
    guid: "Author-1", name: "Author One", realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now - 20 },
    gear: { items: [], updatedAt: now - 20 }, lastSeenAt: now - 20
  };
  const payload = {
    addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: now, officerCharacter: character, characters: []
  };
  const entry = (index) => ({
    name: `Target ${index}`, realm: "Realm", author: character.name, authorGuid: character.guid,
    actorGuid: character.guid, note: "", createdAt: now - 20, updatedAt: now - 20, deleted: false
  });
  const upload = (entries) => call("POST", "/sync", admin.token, { ...payload, sharedKillList: entries });

  assert.equal((await upload(Array.from({ length: 3000 }, (_, index) => entry(index)))).status, 200);
  const full = await upload(Array.from({ length: 2000 }, (_, index) => entry(index + 3000)));
  assert.equal(full.status, 200);
  assert.equal(full.body.sharedKillList.length, 5000);

  const overflow = await upload([entry(5000)]);
  assert.equal(overflow.status, 409);
  const catalog = await call("GET", "/kill-list", admin.token);
  assert.equal(catalog.body.length, 5000);
  assert.ok(!catalog.body.some((target) => target.name === "Target 5000"));
});
