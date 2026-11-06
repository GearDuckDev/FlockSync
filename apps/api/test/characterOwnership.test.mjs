import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { SetCharacterOwnerSchema } from "@flocksync/shared-types";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("ownership contract rejects spoofed fields and missing conflict/confirmation state", () => {
  const valid = { userId: "user", expectedRevision: null, confirmReassignment: false };
  assert.ok(SetCharacterOwnerSchema.safeParse(valid).success);
  for (const input of [
    { ...valid, actorId: "root" }, { ...valid, guildName: "Other" }, { ...valid, updatedAt: 999 },
    { userId: "user" }, { ...valid, expectedRevision: "invalid" }, { ...valid, userId: "" }
  ]) assert.equal(SetCharacterOwnerSchema.safeParse(input).success, false);
});

test("verified ownership is officer-managed, conflict-safe, scoped and audited without changing history", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const officer = await create("officer", "OFFICER"), member = await create("member"), other = await create("other");
  const path = "/character-ownership";
  const change = (guid, token, userId, revision = null, confirm = false) =>
    call("PUT", `${path}/${guid}`, token, { userId, expectedRevision: revision, confirmReassignment: confirm });
  const catalog = async () => (await call("GET", path, officer.token)).body;
  const mine = async (token) => (await call("GET", `${path}/mine`, token)).body;
  const after = async (epoch) => {
    while (Math.floor(Date.now() / 1000) <= epoch) await delay(30);
  };
  assert.equal((await call("GET", path)).status, 401);
  assert.equal((await call("GET", `${path}/mine`)).status, 401);
  assert.equal((await call("GET", path, member.token)).status, 403);
  assert.deepEqual(await mine(member.token), []);
  assert.equal((await change("first", officer.token, member.user.id)).status, 409);

  const now = Math.floor(Date.now() / 1000);
  const character = (guid, extra = {}) => ({
    guid, name: `${guid} Lastname`, realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now },
    gear: { items: [], updatedAt: now }, lastSeenAt: now, ...extra
  });
  const payload = {
    addonVersion: "test", exportedAt: now, collectorGuild: { name: "Guild A", realm: "Realm" },
    officerCharacter: character("first"),
    characters: [character("second", { mainCharacterGuid: "first" }), character("foreign", { realm: "Other" })]
  };
  assert.equal((await call("POST", "/sync", officer.token, payload)).status, 200);
  const initial = await catalog();
  assert.equal(initial.characters.length, 2);
  assert.equal(initial.users.length, 4);
  assert.ok(initial.users.every((user) => !("email" in user) && !("role" in user)));
  assert.equal((await change("first", member.token, member.user.id)).status, 403);
  assert.equal((await change("missing", officer.token, member.user.id)).status, 404);
  assert.equal((await change("foreign", officer.token, member.user.id)).status, 404);
  assert.equal((await change("first", officer.token, "missing")).status, 404);
  assert.equal((await call("PUT", `${path}/first`, officer.token, { userId: member.user.id })).status, 400);

  const assigned = await change("first", officer.token, member.user.id);
  assert.equal(assigned.status, 200);
  const revision = assigned.body.revision;
  assert.equal((await mine(member.token))[0].characterGuid, "first");
  assert.deepEqual(await mine(other.token), []);
  assert.equal((await change("first", admin.token, other.user.id)).status, 409, "stale view rejected");
  assert.equal((await change("first", admin.token, other.user.id, revision)).status, 409, "confirmation required");
  const idempotent = await change("first", officer.token, member.user.id, revision);
  assert.equal(idempotent.status, 200);
  assert.equal((await catalog()).audit.length, 1, "idempotent save does not duplicate audit");
  await after(assigned.body.updatedAt);
  const reassigned = await change("first", admin.token, other.user.id, revision, true);
  assert.equal(reassigned.status, 200);
  assert.notEqual(reassigned.body.revision, revision);
  assert.deepEqual(await mine(member.token), []);
  assert.equal((await mine(other.token))[0].characterGuid, "first");
  assert.equal((await change("first", officer.token, null, revision)).status, 409, "stale removal rejected");
  await after(reassigned.body.updatedAt);
  assert.equal((await change("first", officer.token, null, reassigned.body.revision)).status, 200);
  assert.deepEqual(await mine(other.token), []);
  assert.equal((await change("first", officer.token, member.user.id)).status, 200);
  assert.equal((await change("second", officer.token, member.user.id)).status, 200);
  assert.equal((await mine(member.token)).length, 2, "one user may own multiple characters");
  const linked = await catalog();
  assert.equal(new Set(linked.ownerships.map((row) => row.characterGuid)).size, 2);

  assert.equal((await call("POST", "/sync", officer.token, payload)).status, 200);
  assert.equal((await mine(member.token)).length, 2, "normal sync preserves verified links");
  const roster = (await call("GET", "/roster", member.token)).body;
  assert.equal(roster.find((row) => row.guid === "second").mainCharacterGuid, "first");
  assert.equal((await call("POST", "/sync", officer.token, {
    ...payload, characters: [character("second", { ownerUserId: other.user.id })]
  })).status, 400, "addon cannot self-claim ownership");

  assert.equal((await call("PATCH", `/users/${officer.user.id}/username`, officer.token, {
    username: "renamed-officer"
  })).status, 200);
  const auditBeforeDeletion = (await catalog()).audit;
  assert.ok(auditBeforeDeletion.some((row) => row.actorUsername === "officer"));
  const oldAssignment = auditBeforeDeletion.find((row) => row.reason === "ASSIGNED");
  assert.equal((await call("DELETE", `/users/${member.user.id}`, admin.token)).status, 204);
  assert.equal((await catalog()).ownerships.length, 0);
  assert.equal((await catalog()).audit.filter((row) => row.reason === "USER_DELETED").length, 2);
  assert.ok((await catalog()).audit.some((row) => row.id === oldAssignment.id
    && row.username === oldAssignment.username && row.actorUsername === oldAssignment.actorUsername));
  assert.equal((await call("GET", `${path}/mine`, member.token)).status, 401);
  assert.equal((await change("second", officer.token, other.user.id)).status, 200);
  assert.equal((await call("DELETE", "/roster/second", officer.token)).status, 204);
  assert.deepEqual(await mine(other.token), []);
  assert.equal((await catalog()).audit.filter((row) => row.reason === "CHARACTER_DELETED").length, 1);

  assert.equal((await change("first", officer.token, other.user.id)).status, 200);
  assert.equal((await call("POST", "/sync", officer.token, {
    ...payload, exportedAt: now + 1, collectorGuild: { name: "Guild B", realm: "Realm" }
  })).status, 200);
  assert.deepEqual(await mine(other.token), [], "links cannot carry over to another guild");
  assert.equal((await catalog()).audit.length, 0);
  assert.equal((await call("POST", "/sync", officer.token, { ...payload, exportedAt: now + 2 })).status, 200);
  assert.equal((await mine(other.token)).length, 1);
  assert.ok((await catalog()).audit.length > 0, "original guild audit is retained");
  assert.equal((await call("PATCH", `/users/${officer.user.id}/role`, admin.token, { role: "MEMBER" })).status, 200);
  assert.equal((await call("GET", path, officer.token)).status, 403, "old token cannot retain officer access");
  assert.equal((await change("first", officer.token, null)).status, 403);
  assert.equal((await call("GET", "/users", other.token)).status, 403, "account administration unchanged");
});
