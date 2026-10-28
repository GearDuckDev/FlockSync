import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { groupRoster } = await import('../src/lib/roster.ts');
hooks.deregister();

const character = (guid, lastSeenAt, extra = {}) => ({
  guid, name: guid, realm: 'Realm', classId: 1, level: 60, isActive: true,
  role: { primaryRole: 'DPS', offSpecEnabled: false, updatedAt: 1 },
  gear: { items: [], updatedAt: 1 }, lastSeenAt, ...extra,
});

test('roster alts are ordered by most recently seen, then level and name', () => {
  const [group] = groupRoster([
    character('Main', 10),
    character('Older', 20, { mainCharacterGuid: 'Main', level: 60 }),
    character('RecentLower', 40, { mainCharacterGuid: 'Main', level: 40 }),
    character('RecentHigherZed', 40, { mainCharacterGuid: 'Main', level: 60 }),
    character('RecentHigherAble', 40, { mainCharacterGuid: 'Main', level: 60 }),
  ]);

  assert.deepEqual(group.alts.map((alt) => alt.guid), [
    'RecentHigherAble', 'RecentHigherZed', 'RecentLower', 'Older',
  ]);
});
