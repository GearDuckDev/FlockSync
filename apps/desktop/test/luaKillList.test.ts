import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sharedKillsFromLua } from '../src/main/luaKillList';
import { SharedKillListSchema, KillObservationsSchema, type KillObservation } from '@flocksync/shared-types';
import { serializeServerReturnToLua } from '../src/main/luaReturn';
import { luaToJs, parseLuaAssignment } from '../src/main/luaTable';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncFile } from '../src/main/syncService';

const entry = {
  name: 'Enemy One', realm: 'Realm', author: 'Author One', authorGuid: 'Author-1',
  actorGuid: 'Officer-1', note: 'Public note', createdAt: 90, updatedAt: 100, deleted: false
};
const observation: KillObservation = {
  id: 'public', kind: 'SIGHTING', name: entry.name, realm: entry.realm, targetGuid: 'Enemy-1',
  targetCreatedAt: entry.createdAt, timestamp: 100, zone: 'Public zone',
  reporterGuid: 'Officer-1', reporter: 'Officer One'
};
test('only published records of the collector guild enter upload, without private fields', () => {
  const result = sharedKillsFromLua({
    collectorGuild: { name: 'Guild', realm: 'Realm' },
    killListGuilds: {
      ['Realm\x1fGuild']: {
        live: { ...entry, sharedLive: true, personalNote: 'PRIVATE', history: ['PRIVATE'] },
        draft: { ...entry, sharedLive: false, name: 'DRAFT' },
        removed: { ...entry, name: 'Enemy Two', deleted: true, note: '', sharedLive: true }
      },
      ['Realm\x1fOther']: { live: { ...entry, sharedLive: true, note: 'OTHER_GUILD' } }
    },
    killListCharacters: { personal: { ...entry, note: 'PRIVATE' } }
  });
  const validated = SharedKillListSchema.parse(result.sharedKillList);
  assert.equal(validated.length, 2);
  assert.deepEqual(validated[0], entry);
  assert.equal(validated[1]?.deleted, true);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.ok(!JSON.stringify(result).includes('DRAFT'));
  assert.ok(!JSON.stringify(result).includes('OTHER_GUILD'));
});
test('unscoped legacy data is never guessed as a shared upload', () => {
  assert.deepEqual(sharedKillsFromLua({ killListGuilds: { guild: { entry } } }), {});
});
test('malformed live entries fail boundary validation rather than erasing a server record', () => {
  const result = sharedKillsFromLua({
    collectorGuild: { name: 'Guild', realm: 'Realm' },
    killListGuilds: { ['Realm\x1fGuild']: { bad: { ...entry, sharedLive: true, updatedAt: 'bad' } } }
  });
  assert.equal(SharedKillListSchema.safeParse(result.sharedKillList).success, false);
});
test('server shared kills and verified links serialize into a safe helper round trip', () => {
  const lua = serializeServerReturnToLua({
    isAuthorizedOfficer: true, serverTimestamp: 110, culledCharacterGuids: [],
    authorizedCollectorGuild: { name: 'Guild', realm: 'Realm' },
    sharedKillList: [{ ...entry, note: 'Quote " slash \\ newline\n😀' }],
    characterLinks: [{ characterGuid: 'Author-1', ownerKey: 'website-user' }]
  });
  const parsed = luaToJs(parseLuaAssignment(lua, 'FlockSyncHelperDB'));
  assert.ok(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed));
  assert.match(JSON.stringify(parsed), /website-user/);
  assert.match(JSON.stringify(parsed), /😀/);
});

test('syncFile sends published guild data and writes returned edits/links, refusing incompatible responses', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flocksync-kill-bridge-'));
  let legacy = false;
  let omitObservations = false;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const received: unknown = JSON.parse(Buffer.concat(chunks).toString());
      assert.ok(typeof received === 'object' && received !== null && 'sharedKillList' in received);
      assert.deepEqual(received.sharedKillList, [entry]);
      assert.ok('sharedKillObservations' in received);
      assert.deepEqual(received.sharedKillObservations, [observation]);
      assert.ok(!JSON.stringify(received).includes('PRIVATE'));
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        isAuthorizedOfficer: true, serverTimestamp: 110, culledCharacterGuids: [],
        authorizedCollectorGuild: { name: 'Guild', realm: 'Realm' },
        craftersIndex: [], upcomingRaids: [], goalMatches: [],
        ...(legacy ? {} : {
          sharedKillList: [{ ...entry, note: 'Returned edit', updatedAt: 110 }],
          ...(omitObservations ? {} : { sharedKillObservations: [observation] }),
          characterLinks: [{ characterGuid: 'Author-1', ownerKey: 'owner' }]
        })
      }));
    });
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const file = join(root, 'FlockSync.lua');
    await writeFile(file, `FlockSyncDB = {
      addonVersion="test", exportedAt=100, collectorGuild={name="Guild",realm="Realm"},
      characters={{guid="Officer",name="Officer One",realm="Realm",classId=1,level=60,isActive=true,
        lastSeenAt=100,role={primaryRole="DPS",offSpecEnabled=false,updatedAt=100},gear={items={},updatedAt=100}}},
      killListCharacters={private={note="PRIVATE"}},
      killListObservationsGuilds={["Realm\\031Guild"]={live={
        id="public",kind="SIGHTING",name="Enemy One",realm="Realm",targetGuid="Enemy-1",
        targetCreatedAt=90,timestamp=100,zone="Public zone",reporterGuid="Officer-1",reporter="Officer One"}}},
      killListGuilds={["Realm\\031Guild"]={live={name="Enemy One",realm="Realm",author="Author One",
        authorGuid="Author-1",actorGuid="Officer-1",note="Public note",createdAt=90,updatedAt=100,
        deleted=false,sharedLive=true},draft={note="PRIVATE",sharedLive=false}}}
    }`);
    const context = { apiBaseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-only' };
    const synced = await syncFile(file, context);
    assert.equal(synced.status, 'SUCCESS', synced.message);
    const helperFile = join(root, 'FlockSync_AppHelper.lua');
    const helper = await readFile(helperFile, 'utf8');
    assert.match(helper, /Returned edit/);
    assert.match(helper, /owner/);
    assert.match(helper, /Public zone/);
    omitObservations = true;
    const missingReports = await syncFile(file, context);
    assert.equal(missingReports.status, 'ERROR');
    assert.match(missingReports.message, /Server omitted shared observations/);
    assert.equal(await readFile(helperFile, 'utf8'), helper, 'Incomplete history response cannot overwrite helper');
    legacy = true;
    const incompatible = await syncFile(file, context);
    assert.equal(incompatible.status, 'ERROR');
    assert.match(incompatible.message, /Server omitted shared kill-list/);
    assert.equal(await readFile(helperFile, 'utf8'), helper, 'Failed sync preserves previously written helper');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

test('observation allowlist excludes personal/draft/removed/other-guild history and obsolete creations', () => {
  const result = sharedKillsFromLua({
    collectorGuild: { name: 'Guild', realm: 'Realm' },
    killListGuilds: { ['Realm\x1fGuild']: {
      live: { ...entry, sharedLive: true },
      draft: { ...entry, name: 'Draft', sharedLive: false },
      removed: { ...entry, name: 'Removed', sharedLive: true, deleted: true }
    } },
    killListCharacters: { personal: { observations: [{ ...observation, zone: 'PRIVATE' }] } },
    killListObservationsGuilds: {
      ['Realm\x1fGuild']: {
        live: { ...observation, privateNote: 'PRIVATE' },
        draft: { ...observation, name: 'Draft', zone: 'PRIVATE' },
        removed: { ...observation, name: 'Removed', zone: 'PRIVATE' },
        obsolete: { ...observation, targetCreatedAt: 1, zone: 'PRIVATE' }
      },
      ['Realm\x1fOther']: { leak: { ...observation, zone: 'PRIVATE' } }
    }
  });
  assert.deepEqual(KillObservationsSchema.parse(result.sharedKillObservations), [observation]);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  const helper = serializeServerReturnToLua({
    isAuthorizedOfficer: true, serverTimestamp: 110, culledCharacterGuids: [], sharedKillObservations: [observation]
  });
  assert.match(JSON.stringify(luaToJs(parseLuaAssignment(helper, 'FlockSyncHelperDB'))), /Public zone/);
});
