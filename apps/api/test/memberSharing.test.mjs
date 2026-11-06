import assert from "node:assert/strict";
import { test } from "node:test";
import { startOwnershipServer } from "./ownershipServer.mjs";

test("members receive public guild snapshots and own links but cannot manage lineups", async (t) => {
  const { call, admin, create } = await startOwnershipServer(t);
  const alice = await create("alice"), bob = await create("bob"), unlinked = await create("unlinked");
  const now = Math.floor(Date.now() / 1000);
  const character = (guid) => ({
    guid, name: `${guid} Last`, realm: "Realm", classId: 1, level: 60, isActive: true,
    role: { primaryRole: "DPS", offSpecEnabled: false, updatedAt: now },
    gear: { items: [], updatedAt: now }, lastSeenAt: now,
    professions: { primary: [{
      name: "Blacksmithing", level: 300, maxLevel: 300, acceptingRequests: true, recipes: [123]
    }], updatedAt: now },
    gearGoals: { goals: [{ itemId: 456, itemLink: "" }], updatedAt: now }
  });
  const sync = () => call("POST", "/sync", admin.token, {
    addonVersion: "test", exportedAt: now, collectorGuild: { name: "Test", realm: "Realm" },
    officerCharacter: character("alice"), characters: [character("alt"), character("bob")]
  });
  assert.equal((await sync()).status, 200);
  for (const guid of ["alice", "alt"]) {
    assert.equal((await call("PUT", `/character-ownership/${guid}`, admin.token, {
      userId: alice.user.id, expectedRevision: null, confirmReassignment: false
    })).status, 200);
  }
  assert.equal((await call("PUT", "/character-ownership/bob", admin.token, {
    userId: bob.user.id, expectedRevision: null, confirmReassignment: false
  })).status, 200);
  const base = {
    teamType: "RAID", name: "Alice Raid", instanceName: "Molten Core", raidSize: 10,
    scheduledDay: "MON", startTime: "20:00", endTime: "23:00", timezone: "UTC",
    targetTanks: 1, targetHealers: 2, targetDps: 7,
    assignments: [{ characterGuid: "alice", assignedRole: "DPS", groupIndex: 1, slotIndex: 1 }],
    benchGuids: []
  };
  const raid = await call("POST", "/raids", admin.token, base);
  assert.equal(raid.status, 201);
  const bench = await call("POST", "/raids", admin.token, {
    ...base, name: "Alt Bench", assignments: [], benchGuids: ["alt"]
  });
  assert.equal(bench.status, 201);
  for (const member of [alice, bob, unlinked]) {
    const groups = await call("GET", "/raids", member.token);
    assert.equal(groups.status, 200);
    assert.equal(groups.body.length, 2, "full snapshot delivery explicitly allowed; UI performs filtering");
    assert.equal((await call("POST", "/raids", member.token, base)).status, 403);
    assert.equal((await call("PUT", `/raids/${raid.body.id}`, member.token, base)).status, 403);
    assert.equal((await call("DELETE", `/raids/${raid.body.id}`, member.token)).status, 403);
    assert.equal((await call("POST", "/sync", member.token, {})).status, 403);
  }
  assert.equal((await call("GET", "/character-ownership/mine", alice.token)).body.length, 2);
  assert.equal((await call("GET", "/character-ownership/mine", bob.token)).body.length, 1);
  assert.deepEqual((await call("GET", "/character-ownership/mine", unlinked.token)).body, []);
  const snapshot = (await sync()).body;
  assert.equal(snapshot.craftersIndex.length, 3);
  assert.equal(snapshot.goalMatches[0].neededBy.length, 3);
  assert.equal(snapshot.upcomingRaids.length, 2);
  assert.ok(snapshot.upcomingRaids.find((team) => team.id === bench.body.id)
    .assignments.some((slot) => slot.characterGuid === "alt" && slot.isBench));
});
