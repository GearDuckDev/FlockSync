import assert from "node:assert/strict";

export const checkGearSync = async (origin, token, officer) => {
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const guid = `${officer.guid}-gear`;
  const epoch = Math.floor(Date.now() / 1000) - 10;
  const pants = { slotId: 7, itemId: 100, itemLink: "item:100" };
  const initial = { ...officer, guid, name: "Gear Test", lastSeenAt: epoch,
    gear: { updatedAt: epoch, items: [pants] } };
  const sync = async (character) => {
    const response = await fetch(`${origin}/api/sync`, {
      method: "POST", headers, body: JSON.stringify({
        addonVersion: "test", officerCharacter: officer, characters: [character], exportedAt: epoch + 5
      })
    });
    assert.equal(response.status, 200);
    await response.json();
  };
  const read = async () => {
    const response = await fetch(`${origin}/api/roster`, { headers });
    assert.equal(response.status, 200);
    const character = (await response.json()).find((entry) => entry.guid === guid);
    assert.ok(character);
    return character;
  };
  await sync(initial);
  assert.deepEqual((await read()).gear.items, [pants]);
  assert.deepEqual((await read()).gear.items, [pants], "Refreshing the roster must not remove saved equipment");
  await sync({ ...initial, gear: { updatedAt: epoch, items: [] } });
  assert.deepEqual((await read()).gear.items, [pants], "Equal-timestamp sync must not clear saved equipment");
  await sync({ ...initial, gear: { updatedAt: epoch - 1, items: [] } });
  assert.deepEqual((await read()).gear.items, [pants], "Older sync must not clear saved equipment");
  await sync({ ...initial, lastSeenAt: epoch + 1, gear: { updatedAt: epoch + 1, items: [] } });
  let saved = await read();
  assert.deepEqual(saved.gear.items, [], "Unequipping must replace gear, not merge old slots");
  assert.equal(saved.lastSeenAt, epoch + 1);
  assert.equal(saved.gear.updatedAt, epoch + 1);
  await sync(initial);
  saved = await read();
  assert.deepEqual(saved.gear.items, [], "An older sync must not restore removed equipment");
  assert.equal(saved.lastSeenAt, epoch + 1, "An older sync must not move last seen backwards");
  const removed = await fetch(`${origin}/api/roster/${guid}`, {
    method: "DELETE", headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(removed.status, 204);
};
