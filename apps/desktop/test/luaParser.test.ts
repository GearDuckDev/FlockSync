import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFlockSyncLua } from '../src/main/luaParser';

const item = '{ slotId = 7, itemId = 100, itemLink = "item:100" }';
const expectedItem = { slotId: 7, itemId: 100, itemLink: 'item:100' };
const savedVariables = (items: string): string => `FlockSyncDB = {
  addonVersion = "test", exportedAt = 100,
  officerCharacter = "Tester (Realm)",
  characters = {
    ["Player-Test"] = {
      guid = "Player-Test", name = "Tester", realm = "Realm",
      classId = 1, level = 60, isActive = true, lastSeenAt = 100,
      role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 100 },
      gear = { updatedAt = 100, ${items} },
    },
  },
}`;

for (const [name, items] of [
  ['positional', `{ ${item} }`],
  ['explicit numeric keys', `{ [1] = ${item} }`],
  ['sparse numeric keys', `{ [7] = ${item} }`],
] as const) {
  test(`SavedVariables gear survives parsing with ${name}`, () => {
    const result = parseFlockSyncLua(savedVariables(`items = ${items}`));
    assert.equal(result.ok, true);
    if (!result.ok) assert.fail(result.error);
    assert.deepEqual(result.payload.characters[0]?.gear.items, [expectedItem]);
    assert.deepEqual(result.payload.officerCharacter.gear.items, [expectedItem]);
  });
}

test('an explicitly empty gear table still represents unequipping all items', () => {
  const result = parseFlockSyncLua(savedVariables('items = {}'));
  assert.equal(result.ok, true);
  if (!result.ok) assert.fail(result.error);
  assert.deepEqual(result.payload.officerCharacter.gear.items, []);
});

test('missing or malformed gear items fail validation instead of clearing saved gear', () => {
  for (const items of ['', 'items = false', 'items = "invalid"', 'items = { [1] = false }']) {
    const result = parseFlockSyncLua(savedVariables(items));
    assert.equal(result.ok, false, items);
    if (result.ok) assert.fail('Invalid gear must not be uploaded');
    assert.match(result.error, /Validation failed: .*gear.items/);
  }
});
