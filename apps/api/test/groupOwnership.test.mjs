import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("friendly groups link all current/future alts atomically and revoke safely", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const alice = await create("group-alice"), bob = await create("group-bob");
  const now = Math.floor(Date.now() / 1000);
  const character = (guid, name, extra = {}) => ({
    guid, name, realm: "Realm", classId: 1, level: 60, isActive: true, lastSeenAt: now,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now },
    gear: { items: [], updatedAt: now }, ...extra
  });
  const main = character("main", "Pirani Killjoy");
  const alt = character("alt", "Watta Killjoy", { mainCharacterGuid: main.guid, mainCharacterName: main.name });
  const payload = {
    addonVersion: "test", collectorGuild: { name: "Guild", realm: "Realm" },
    exportedAt: now, officerCharacter: main, characters: [alt]
  };
  const sync = (value = payload) => call("POST", "/sync", admin.token, value);
  assert.equal((await sync()).status, 200);
  assert.equal((await call("PUT", "/aliases/main", admin.token, { alias: "Killjoy" })).status, 200);
  const catalog = async () => (await call("GET", "/character-ownership", admin.token)).body;
  const input = (data, userId) => {
    const group = data.groups.find((row) => row.key === "main");
    return {
      groupKey: group.key, userId, expectedRevision: group.revision, confirmReassignment: true,
      expectedMembers: group.characterGuids.map((characterGuid) => ({
        characterGuid, revision: data.ownerships.find((row) => row.characterGuid === characterGuid)?.revision ?? null
      }))
    };
  };
  let data = await catalog();
  assert.equal(data.groups[0].label, "Killjoy");
  const first = input(data, alice.user.id);
  assert.equal((await call("PUT", "/character-ownership/group", bob.token, first)).status, 403);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, first)).status, 200);
  assert.ok((await catalog()).audit.some((row) => row.reason === "GROUP_ASSIGNED"));
  assert.equal((await call("GET", "/character-ownership/mine", alice.token)).body.length, 2);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, first)).status, 409);
  assert.equal((await call("PUT", "/character-ownership/alt", admin.token, {
    userId: bob.user.id, expectedRevision: null, confirmReassignment: true
  })).status, 409, "Group-managed characters cannot be overridden through legacy route");
  const future = character("future", "Spoolmon Killjoy", { mainCharacterGuid: "main", mainCharacterName: main.name });
  const entry = {
    name: "Enemy One", realm: "Realm", author: future.name, authorGuid: future.guid, actorGuid: future.guid,
    createdAt: now - 10, updatedAt: now - 10, note: "Original", deleted: false
  };
  const returned = await sync({ ...payload, characters: [alt, future], sharedKillList: [entry] });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.characterLinks.find((row) => row.characterGuid === "future").ownerKey, alice.user.id);
  assert.equal((await call("GET", "/character-ownership/mine", alice.token)).body.length, 3);
  const memberEdit = await call("PATCH", "/kill-list", alice.token, {
    name: entry.name, realm: entry.realm, expectedUpdatedAt: entry.updatedAt, note: "Auto-linked author edit"
  });
  assert.equal(memberEdit.status, 200, "Kill-list editing does not depend on character ownership");
  await sync({ ...payload, characters: [{
    ...future, mainCharacterGuid: "different-main", mainCharacterName: "Different Main", lastSeenAt: now + 1
  }] });
  assert.equal((await call("GET", "/character-ownership/mine", alice.token)).body.length, 2,
    "Leaving the verified group immediately removes inherited ownership");
  while (Math.floor(Date.now() / 1000) <= memberEdit.body.updatedAt) await delay(50);
  assert.equal((await call("PATCH", "/kill-list", alice.token, {
    name: entry.name, realm: entry.realm, expectedUpdatedAt: memberEdit.body.updatedAt, note: "Still allowed after unlinking"
  })).status, 200);
  await sync({ ...payload, characters: [{ ...future, lastSeenAt: now + 2 }] });
  assert.equal((await call("PUT", "/aliases/main", admin.token, { alias: "Renamed Friendly" })).status, 200);
  data = await catalog();
  assert.equal(data.groups[0].label, "Renamed Friendly");
  assert.equal(data.groups[0].userId, alice.user.id, "Alias rename cannot change identity");
  const staleMembers = input(data, bob.user.id);
  const added = character("added", "Fourth Killjoy", { mainCharacterGuid: "main" });
  await sync({ ...payload, characters: [added] });
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, staleMembers)).status, 409);
  data = await catalog();
  while (Math.floor(Date.now() / 1000) <= data.ownerships[0].updatedAt) await delay(50);
  const transfer = input(data, bob.user.id);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, {
    ...transfer, confirmReassignment: false
  })).status, 409);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, transfer)).status, 200);
  assert.equal((await call("GET", "/character-ownership/mine", alice.token)).body.length, 0);
  assert.equal((await call("GET", "/character-ownership/mine", bob.token)).body.length, 4);
  const backup = await call("POST", "/admin/database/backup", admin.token);
  assert.equal(backup.status, 200);
  assert.equal((await call("POST", "/admin/database/wipe", admin.token)).status, 200);
  assert.equal((await catalog()).groups.length, 0);
  assert.equal((await call("POST", "/admin/database/restore", admin.token, {
    filename: backup.body.backup.filename, relativeDirectory: backup.body.backup.relativeDirectory
  })).status, 200);
  assert.equal((await call("GET", "/character-ownership/mine", bob.token)).body.length, 4);
  data = await catalog();
  while (Math.floor(Date.now() / 1000) <= data.ownerships[0].updatedAt) await delay(50);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, input(data, null))).status, 200);
  assert.equal((await call("GET", "/character-ownership/mine", bob.token)).body.length, 0);
  data = await catalog();
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, input(data, alice.user.id))).status, 200);
  assert.equal((await call("DELETE", `/users/${alice.user.id}`, admin.token)).status, 204);
  data = await catalog();
  assert.equal(data.groups[0].userId, null);
  assert.equal(data.ownerships.length, 0);
  assert.ok(data.audit.some((row) => row.reason === "USER_DELETED" && row.characterGuid === "future"));
  const afterDelete = input(data, bob.user.id);
  assert.equal((await call("PUT", "/character-ownership/group", admin.token, afterDelete)).status, 200);
  assert.equal((await call("DELETE", "/roster/main", admin.token)).status, 204);
  assert.equal((await call("GET", "/character-ownership/mine", bob.token)).body.length, 0,
    "Deleting the main clears its grant instead of leaving a dormant owner");
});
