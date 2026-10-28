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
const { buildChainViews } = await import('../src/lib/attunements.ts');
hooks.deregister();

const chain = (completed, total = 3, chainId = 'onyxia') => ({
  chainId, name: chainId, isFullyAttuned: completed === total, updatedAt: 1,
  steps: Array.from({ length: total }, (_, index) => ({
    stepId: index + 1, questId: index + 100, name: `Quest ${index + 1}`, completed: index < completed,
  })),
});
const character = (guid, completed, extra = {}) => ({
  guid, name: guid, realm: 'Realm', classId: 1, level: 60, isActive: true,
  role: { primaryRole: 'DPS', offSpecEnabled: false, updatedAt: 1 },
  gear: { items: [], updatedAt: 1 }, lastSeenAt: 1,
  ...(completed === undefined ? {} : { attunements: [chain(completed)] }), ...extra,
});

test('alts stay under main step, with individual progress including equal steps', () => {
  const roster = [
    character('Main', 1),
    character('AltZero', 0, { mainCharacterGuid: 'Main', level: 50 }),
    character('AltSame', 1, { mainCharacterName: 'main', level: 40 }),
    character('AltDone', 3, { mainCharacterGuid: 'Main', level: 60 }),
    character('OtherMain', 3),
  ];
  const [view] = buildChainViews(roster);
  assert.equal(view.groups.length, 2);
  const family = view.groups.find((group) => group.key === 'step:2').members[0];
  assert.equal(family.main.character.guid, 'Main');
  assert.equal(family.main.completed, 1);
  assert.deepEqual(family.alts.map((alt) => [alt.character.guid, alt.completed, alt.total]), [
    ['AltDone', 3, 3], ['AltZero', 0, 3], ['AltSame', 1, 3],
  ]);
  assert.equal(view.groups.reduce((n, group) => n + group.members.length, 0), 2, 'Counts represent mains, not alts');
  assert.equal(view.groups.find((group) => group.attuned).members.length, 1);
});

test('fully attuned main retains unfinished and unreported alts', () => {
  const [view] = buildChainViews([
    character('Main', 3), character('Alt', 0, { mainCharacterGuid: 'Main' }),
    character('Unreported', undefined, { mainCharacterGuid: 'Main' }),
  ]);
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0].key, 'done');
  assert.equal(view.groups[0].members[0].alts[1].reported, false);
});

test('main with no data never adopts alt progress, and inactive main remains the anchor', () => {
  for (const isActive of [true, false]) {
    const [view] = buildChainViews([
      character('Main', undefined, { isActive }),
      character('Alt', 2, { mainCharacterGuid: 'Main' }),
      character('HiddenAlt', 1, { mainCharacterGuid: 'Main', isActive: false }),
    ]);
    assert.equal(view.groups[0].key, 'unknown');
    const [family] = view.groups[0].members;
    assert.equal(family.main.character.guid, 'Main');
    assert.equal(family.main.reported, false);
    assert.equal(family.alts.length, 1);
    assert.equal(family.alts[0].completed, 2);
  }
});

test('missing main groups name-linked siblings under one unavailable main', () => {
  const [view] = buildChainViews([
    character('AltOne', 0, { mainCharacterName: 'Missing' }),
    character('AltTwo', 2, { mainCharacterName: 'Missing' }),
  ]);
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0].key, 'unknown');
  assert.equal(view.groups[0].members.length, 1);
  assert.equal(view.groups[0].members[0].orphan, true);
  assert.equal(view.groups[0].members[0].alts.length, 2);
});

test('each chain uses its own main progress and excludes entirely inactive families', () => {
  const [first, second] = buildChainViews([
    character('Main', 1, { attunements: [chain(1), chain(3, 3, 'molten-core')] }),
    character('Alt', 3, { mainCharacterGuid: 'Main', attunements: [chain(3), chain(0, 3, 'molten-core')] }),
    character('Inactive', 0, { isActive: false }),
  ]);
  assert.equal(first.groups[0].key, 'step:2');
  assert.equal(second.groups[0].key, 'done');
  assert.equal(first.groups[0].members.length, 1);
  assert.deepEqual(buildChainViews([character('NoData', undefined)]), []);
});
