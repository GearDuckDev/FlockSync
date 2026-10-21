import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { AddonReleaseCatalogSchema, ServerReturnPayloadSchema } from '@flocksync/shared-types';
import { initializeOfficerHelpers } from '../src/main/helperBootstrap';
import { serializeServerReturnToLua } from '../src/main/luaParser';
import { luaToJs, parseLuaAssignment } from '../src/main/luaTable';
import type { SyncLogEvent } from '../src/shared/ipc';
import { syncFile } from '../src/main/syncService';

const readHelper = (source: string): unknown =>
  luaToJs(parseLuaAssignment(source, 'FlockSyncHelperDB'));

const addonReleases = AddonReleaseCatalogSchema.parse({
  release: {
    version: '1.2.0',
    url: 'https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v1.2.0',
    releaseNotes: 'Stable addon',
    channel: 'release',
  },
});

test('helper serializer supports legacy payloads and explicit authorization', () => {
  const helperReleases = { beta: { ...addonReleases.release, version: '0.2.2-beta', channel: 'beta' } };
  const withHelper = ServerReturnPayloadSchema.parse({
    culledCharacterGuids: [], serverTimestamp: 1, helperReleases,
  });
  const serialized = ServerReturnPayloadSchema.parse(readHelper(serializeServerReturnToLua(withHelper)));
  assert.equal(serialized.helperReleases?.beta?.version, '0.2.2-beta');
  for (const flag of [undefined, true, false]) {
    const payload = ServerReturnPayloadSchema.parse({
      culledCharacterGuids: ['Player-1'], serverTimestamp: 123,
      ...(flag === undefined ? {} : { isAuthorizedOfficer: flag }),
    });
    const value = readHelper(serializeServerReturnToLua(payload));
    assert.deepEqual(value, {
      isAuthorizedOfficer: flag ?? true,
      culledCharacterGuids: ['Player-1'],
      serverTimestamp: 123,
    });
  }
  assert.equal(ServerReturnPayloadSchema.safeParse({
    culledCharacterGuids: [], serverTimestamp: 0, isAuthorizedOfficer: 'true',
  }).success, false);
});

test('bootstrap initializes all discovered folders, preserves files, and reports I/O errors', async () => {
  const root = await mkdtemp(join(process.cwd(), '.flocksync-helper-fixture-'));
  const logs: SyncLogEvent[] = [];
  const log = (event: SyncLogEvent): void => { logs.push(event); };
  try {
    const folder = (name: string): string => join(root, 'WTF', 'Account', name, 'SavedVariables');
    const file = (name: string): string => join(folder(name), 'FlockSync_AppHelper.lua');
    await mkdir(folder('new'), { recursive: true });
    await mkdir(folder('existing'), { recursive: true });
    await mkdir(folder('blocked'), { recursive: true });
    const existing = serializeServerReturnToLua({
      isAuthorizedOfficer: false, culledCharacterGuids: ['keep-me'], serverTimestamp: 456,
      addonReleases,
      craftersIndex: [], upcomingRaids: [], goalMatches: [],
    });
    await writeFile(file('existing'), existing);
    // A directory occupying the filename exercises exclusive-write failure handling.
    await mkdir(file('blocked'));
    await initializeOfficerHelpers(root, log);
    const helper = readHelper(await readFile(file('new'), 'utf8'));
    const parsed = ServerReturnPayloadSchema.parse(helper);
    assert.equal(parsed.isAuthorizedOfficer, true);
    assert.equal(parsed.serverTimestamp, 0);
    const updatedExisting = ServerReturnPayloadSchema.parse(
      readHelper(await readFile(file('existing'), 'utf8')),
    );
    assert.equal(updatedExisting.isAuthorizedOfficer, true);
    assert.deepEqual(updatedExisting.culledCharacterGuids, ['keep-me']);
    assert.equal(updatedExisting.serverTimestamp, 456);
    assert.deepEqual(updatedExisting.craftersIndex, []);
    assert.deepEqual(updatedExisting.upcomingRaids, []);
    assert.deepEqual(updatedExisting.goalMatches, []);
    assert.deepEqual(updatedExisting.addonReleases, addonReleases);
    await initializeOfficerHelpers(root, log);
    assert.equal(logs.filter((e) => e.status === 'SUCCESS').length, 2);
    assert.equal(logs.filter((e) => e.status === 'ERROR').length, 2);
    await initializeOfficerHelpers(join(root, 'missing'), log);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('snapshot arrays survive Lua serialization and sync writes the helper beside SavedVariables', async () => {
  const name = 'Duck"\\\n\r\t\0' + '123' + '\x01' + ' É';
  const payload = ServerReturnPayloadSchema.parse({
    isAuthorizedOfficer: true, culledCharacterGuids: [], serverTimestamp: 1760000000,
    authorizedCollectorGuild: { name: 'Guild', realm: 'Test' },
    craftersIndex: [{ itemIdOrSpellId: 123, characterGuid: 'crafter', characterName: name,
      mainCharacterName: 'Main', classId: 1, level: 60 }],
    upcomingRaids: [{ id: 'raid', name, instanceName: 'Molten Core', scheduledDay: 'MON', startTime: '20:00',
      assignments: [{ characterGuid: 'crafter', characterName: name, assignedRole: 'DPS',
        groupIndex: 0, slotIndex: 0, isBench: true }] }],
    goalMatches: [{ itemId: 789, neededBy: [{ characterGuid: 'crafter', characterName: name, classId: 1, role: 'DPS' }] }],
  });
  assert.deepEqual(readHelper(serializeServerReturnToLua(payload)), payload);
  const empty = ServerReturnPayloadSchema.parse({
    culledCharacterGuids: [], serverTimestamp: 0, craftersIndex: [], upcomingRaids: [], goalMatches: [],
  });
  assert.deepEqual(readHelper(serializeServerReturnToLua(empty)), { ...empty, isAuthorizedOfficer: true });
  assert.equal(ServerReturnPayloadSchema.safeParse({
    ...payload, goalMatches: [{ itemId: NaN, neededBy: [] }],
  }).success, false);
  const server = createServer((request, response) => {
    assert.equal(request.url, '/api/sync');
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const sent: unknown = JSON.parse(Buffer.concat(chunks).toString());
      assert.ok(typeof sent === 'object' && sent !== null && 'collectorGuild' in sent);
      assert.deepEqual(sent.collectorGuild, { name: 'Guild', realm: 'Test' });
    });
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(legacyResponse ? { culledCharacterGuids: [], serverTimestamp: 123 } : payload));
  });
  let legacyResponse = false;
  const root = await mkdtemp(join(process.cwd(), '.flocksync-snapshot-fixture-'));
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const folder = join(root, 'WTF', 'Account', 'Officer', 'SavedVariables');
    await mkdir(folder, { recursive: true });
    const file = join(folder, 'FlockSync.lua');
    await writeFile(file, `FlockSyncDB = {
      addonVersion = "test", exportedAt = 1,
      collectorGuild = { name = "Guild", realm = "Test" },
      characters = {{ guid = "officer", name = "Officer", realm = "Test", classId = 1, level = 60,
        isActive = true, role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 1 },
        gear = { items = {}, updatedAt = 1 }, lastSeenAt = 1 }}
    }`);
    const result = await syncFile(file, { apiBaseUrl: `http://127.0.0.1:${address.port}`, token: 'test' });
    assert.equal(result.status, 'SUCCESS', result.message);
    assert.match(result.message, /Snapshot: 1 crafter recipes, 1 raid teams, 1 goal items/);
    assert.deepEqual(readHelper(await readFile(join(folder, 'FlockSync_AppHelper.lua'), 'utf8')), payload);
    legacyResponse = true;
    const legacy = await syncFile(file, { apiBaseUrl: `http://127.0.0.1:${address.port}`, token: 'test' });
    assert.equal(legacy.status, 'SUCCESS', legacy.message);
    assert.match(legacy.message, /Server omitted snapshot fields.*Redeploy the API/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
