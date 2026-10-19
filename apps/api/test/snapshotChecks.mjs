import assert from "node:assert/strict";

export const checkGuildSnapshot = async (origin, token, officer) => {
  const call = async (method, path, body) => {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    assert.ok(response.ok, `${method} ${path}: ${await (response.ok ? Promise.resolve("") : response.text())}`);
    return response.status === 204 ? undefined : response.json();
  };
  const profession = (acceptingRequests, recipes) => ({
    name: "Blacksmithing", level: 300, maxLevel: 300, acceptingRequests, recipes
  });
  const crafter = {
    ...officer, guid: `${officer.guid}-crafter`, name: "Crafter", mainCharacterGuid: officer.guid,
    professions: { primary: [profession(true, [123, 123]), profession(false, [456])], updatedAt: 2 },
    gearGoals: { goals: [{ itemId: 789, itemLink: "" }, { itemId: 789, itemLink: "" }], updatedAt: 2 }
  };
  const benched = {
    ...officer, guid: `${officer.guid}-bench`, name: "Bench",
    gearGoals: { goals: [{ itemId: 789, itemLink: "" }], updatedAt: 2 }
  };
  const sync = () => call("POST", "/sync", {
    addonVersion: "test", officerCharacter: officer, characters: [crafter, benched], exportedAt: 2
  });
  const initial = await sync();
  assert.equal(initial.craftersIndex.length, 1);
  assert.equal(initial.craftersIndex[0].mainCharacterName, officer.name);
  assert.equal(initial.craftersIndex[0].itemIdOrSpellId, 123);
  assert.equal(initial.goalMatches.length, 1);
  assert.equal(initial.goalMatches[0].neededBy.length, 2);
  assert.deepEqual(initial.upcomingRaids, []);

  const teamInput = {
    name: "Weekly raid", teamType: "RAID", instanceName: "Molten Core", raidSize: 40,
    scheduledDay: "MON", startTime: "20:00", endTime: "23:00", timezone: "UTC",
    targetTanks: 2, targetHealers: 8, targetDps: 30,
    assignments: [
      { characterGuid: crafter.guid, assignedRole: "TANK", groupIndex: 1, slotIndex: 1 },
      { characterGuid: "missing-guid", assignedRole: "DPS", groupIndex: 1, slotIndex: 2 }
    ],
    benchGuids: [benched.guid, benched.guid]
  };
  const raid = await call("POST", "/raids", teamInput);
  const dungeon = await call("POST", "/raids", { ...teamInput, teamType: "DUNGEON" });
  const snapshot = await sync();
  assert.equal(snapshot.upcomingRaids.length, 1);
  assert.equal(snapshot.upcomingRaids[0].id, raid.id);
  assert.deepEqual(snapshot.upcomingRaids[0].assignments, [
    { ...teamInput.assignments[0], characterName: crafter.name },
    { characterGuid: benched.guid, characterName: benched.name, assignedRole: "DPS",
      groupIndex: 0, slotIndex: 0, isBench: true }
  ]);
  await call("PATCH", `/roster/${crafter.guid}/status`, { isActive: false });
  const culled = await sync();
  assert.deepEqual(culled.craftersIndex, []);
  assert.equal(culled.goalMatches[0].neededBy.length, 1);
  assert.equal(culled.upcomingRaids[0].assignments.length, 1);
  assert.ok(culled.culledCharacterGuids.includes(crafter.guid));
  for (const id of [raid.id, dungeon.id]) await call("DELETE", `/raids/${id}`);
  for (const guid of [crafter.guid, benched.guid]) await call("DELETE", `/roster/${guid}`);
};
