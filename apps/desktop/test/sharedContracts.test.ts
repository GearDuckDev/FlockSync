import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LoginResponseSchema, OfficerSyncPayloadSchema, RegisterRequestSchema,
  ServerReturnPayloadSchema, ThemeSchema, UpdateCheckQuerySchema,
} from '@flocksync/shared-types';
import { parseFlockSyncLua, serializeServerReturnToLua } from '../src/main/luaParser';
import { luaToJs, parseLuaAssignment } from '../src/main/luaTable';

const source = `FlockSyncDB = {
  addonVersion = "0.6.0", exportedAt = 100,
  officerCharacter = "Tester (Realm)",
  collectorGuild = { name = "Test Guild", realm = "Realm" },
  characters = {
    ["Player-Test"] = {
      guid = "Player-Test", name = "Tester", realm = "Realm",
      classId = 1, level = 60, isActive = true, lastSeenAt = 100,
      role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 100 },
      gear = { updatedAt = 100, items = {} },
      availability = { timezone = "CST", updatedAt = 100, schedule = {
        { day = "MON", status = "REGULAR", startTime = "19:00", endTime = "23:00" },
      } },
    },
  },
}`;

test('legacy Lua availability and omitted optional fields survive the shared sync contract', () => {
  const parsed = parseFlockSyncLua(source);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) assert.fail(parsed.error);
  const payload = OfficerSyncPayloadSchema.parse(parsed.payload);
  assert.deepEqual(payload.collectorGuild, { name: 'Test Guild', realm: 'Realm' });
  assert.deepEqual(payload.characters[0]?.availability, {
    timezone: 'CST', updatedAt: 100,
    schedule: [{ day: 'MON', status: 'REGULAR', startTime: '19:00', endTime: '23:00' }],
  });
  assert.equal('professions' in payload.characters[0]!, false);
  assert.equal('includeHelperReleases' in payload, false);
  for (const [invalid, expectedPath] of [
    [source.replace('startTime = "19:00"', 'startTime = "25:00"'), /availability.schedule.0.startTime/],
    [source.replace('updatedAt = 100, schedule', 'updatedAt = "100", schedule'), /availability.updatedAt/],
    [source.replace('primaryRole = "DPS"', 'primaryRole = "INVALID"'), /role.primaryRole/],
  ] as const) {
    const result = parseFlockSyncLua(invalid);
    assert.equal(result.ok, false);
    if (result.ok) assert.fail('Malformed Lua data must not upload');
    assert.match(result.error, expectedPath);
  }
  assert.equal(OfficerSyncPayloadSchema.safeParse({ ...payload, extra: true }).success, false);
});

test('helper defaults, guild snapshot and release metadata round trip without dropping optional fields', () => {
  const release = {
    version: '0.6.1', url: 'https://github.com/GearDuckDev/FlockSync/releases/tag/v0.10.1',
    releaseNotes: 'Test release', channel: 'release',
  };
  const legacy = { culledCharacterGuids: [], serverTimestamp: 100 };
  assert.deepEqual(ServerReturnPayloadSchema.parse(legacy), { ...legacy, isAuthorizedOfficer: true });
  const payload = ServerReturnPayloadSchema.parse({
    ...legacy, isAuthorizedOfficer: false,
    authorizedCollectorGuild: { name: 'Test Guild', realm: 'Realm' },
    craftersIndex: [{
      itemIdOrSpellId: 100, characterGuid: 'Player-Test', characterName: 'Tester',
      classId: 1, level: 60,
    }],
    upcomingRaids: [{
      id: 'raid-test', name: 'Test Raid', instanceName: 'Test Instance',
      scheduledDay: 'MON', startTime: '19:00', assignments: [],
    }],
    goalMatches: [{ itemId: 100, neededBy: [] }],
    addonReleases: { release }, helperReleases: { release: { ...release, version: '0.2.3' } },
  });
  const returned = luaToJs(parseLuaAssignment(serializeServerReturnToLua(payload), 'FlockSyncHelperDB'));
  assert.deepEqual(ServerReturnPayloadSchema.parse(returned), payload);
  assert.equal(ServerReturnPayloadSchema.safeParse({ ...legacy, isAuthorizedOfficer: 'false' }).success, false);
  assert.equal(ServerReturnPayloadSchema.safeParse({ ...legacy, serverTimestamp: -1 }).success, false);
  assert.equal(ServerReturnPayloadSchema.safeParse({ ...legacy, extra: true }).success, false);
  assert.equal(ServerReturnPayloadSchema.safeParse({
    ...legacy, addonReleases: { release: { ...release, version: 'not-a-version' } },
  }).success, false);
});

test('auth trimming, strict objects and user roles retain their contract', () => {
  assert.deepEqual(RegisterRequestSchema.parse({
    email: ' tester@example.com ', username: ' Tester ', password: 'test-password',
  }), { email: 'tester@example.com', username: 'Tester', password: 'test-password' });
  const login = {
    token: 'test-token', user: { id: 'test', email: 'tester@example.com', username: 'Tester', role: 'MEMBER' },
  };
  assert.deepEqual(LoginResponseSchema.parse(login), login);
  for (const invalid of [
    { ...login, token: '' }, { ...login, extra: true },
    { ...login, user: { ...login.user, role: 'OWNER' } },
    { ...login, user: { ...login.user, email: 'invalid' } },
  ]) assert.equal(LoginResponseSchema.safeParse(invalid).success, false);
});

test('theme refinements and update-channel defaults remain enforced', () => {
  assert.deepEqual(ThemeSchema.parse({ image: 'none', opacity: 0.12 }), { image: 'none', opacity: 0.12 });
  const custom = {
    image: 'custom', opacity: 0.2, customImage: 'data:image/png;base64,AAAA',
    uiColor: '#112233', backgroundColor: '#445566', separateColors: true,
  };
  assert.deepEqual(ThemeSchema.parse(custom), custom);
  for (const invalid of [
    { image: 'custom', opacity: 0.1 },
    { ...custom, image: 'none' }, { ...custom, opacity: 1 },
    { ...custom, uiColor: 'red' }, { ...custom, extra: true },
  ]) assert.equal(ThemeSchema.safeParse(invalid).success, false);
  assert.deepEqual(UpdateCheckQuerySchema.parse({}), { channel: 'release' });
  for (const channel of ['alpha', 'beta', 'release']) {
    assert.deepEqual(UpdateCheckQuerySchema.parse({ channel }), { channel });
  }
  assert.equal(UpdateCheckQuerySchema.safeParse({ channel: 'preview' }).success, false);
});
