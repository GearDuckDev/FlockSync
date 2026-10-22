import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { mock, test } from 'node:test';
import chokidar, { type FSWatcher } from 'chokidar';
import { OfficerSyncPayloadSchema, type OfficerSyncPayload } from '@flocksync/shared-types';
import { SyncWatcher } from '../src/main/syncWatcher';
import type { SyncLogEvent } from '../src/shared/ipc';

const source = (epoch: number, officer: string): string => `FlockSyncDB = {
  addonVersion = "test", exportedAt = ${epoch}, officerCharacter = "${officer} (Realm)",
  characters = {
    ["Player-Main"] = {
      guid = "Player-Main", name = "Main", realm = "Realm", classId = 1, level = 60,
      isActive = true, lastSeenAt = ${epoch},
      role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 100 },
      gear = { updatedAt = 100, items = { [1] = { slotId = 7, itemId = 100, itemLink = "item:100" } } },
    },
    ["Player-Alt"] = {
      guid = "Player-Alt", name = "Alt", realm = "Realm", classId = 1, level = 60,
      isActive = true, lastSeenAt = ${epoch},
      role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = 100 },
      gear = { updatedAt = 100, items = { [1] = { slotId = 1, itemId = 200, itemLink = "item:200" } } },
    },
  },
}`;

test('reload, logout, and character-switch saves automatically upload both characters and write AppHelper', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flocksync-save-cycle-'));
  const saved = join(root, 'WTF', 'Account', 'test', 'SavedVariables');
  const file = join(saved, 'FlockSync.lua');
  const payloads: OfficerSyncPayload[] = [];
  const logs: SyncLogEvent[] = [];
  const watcher = new SyncWatcher({ onLog: (entry) => logs.push(entry), onStatus: () => undefined });
  const originalWatch = chokidar.watch;
  let captured: FSWatcher | undefined;
  const watchMock = mock.method(chokidar, 'watch', (...args: Parameters<typeof originalWatch>) => {
    captured = originalWatch(...args);
    return captured;
  });
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(typeof init?.body, 'string');
    const payload = OfficerSyncPayloadSchema.parse(JSON.parse(String(init?.body)));
    payloads.push(payload);
    return new Response(JSON.stringify({
      isAuthorizedOfficer: true, culledCharacterGuids: [], serverTimestamp: payload.exportedAt,
      craftersIndex: [], upcomingRaids: [], goalMatches: [],
    }), { status: 200 });
  });
  const waitFor = async (count: number): Promise<void> => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (logs.length >= count) {
        assert.equal(logs.at(-1)?.status, 'SUCCESS', logs.at(-1)?.message);
        return;
      }
      await delay(50);
    }
    assert.fail(`Expected ${count} automatic syncs; received ${logs.length}`);
  };
  try {
    await mkdir(saved, { recursive: true });
    await writeFile(file, source(100, 'Main'));
    await watcher.start(root, { apiBaseUrl: 'https://example.test', token: 'test' });
    assert.ok(captured);
    await new Promise<void>((resolve) => captured?.once('ready', resolve));
    // WoW reload: rewrite the existing SavedVariables file.
    await writeFile(file, source(101, 'Main'));
    await waitFor(1);
    // WoW logout: replace the file via the backup/rename pattern.
    await rename(file, `${file}.bak`);
    await writeFile(file, source(102, 'Main'));
    await waitFor(2);
    // Next character saves into the same account-level file.
    await writeFile(file, source(103, 'Alt'));
    await waitFor(3);
    assert.deepEqual(payloads.map((payload) => payload.exportedAt), [101, 102, 103]);
    assert.equal(payloads[2]?.officerCharacter.guid, 'Player-Alt');
    for (const payload of payloads) {
      assert.deepEqual(payload.characters.map((character) => character.gear.items[0]?.itemId), [100, 200]);
    }
    const helper = await readFile(join(saved, 'FlockSync_AppHelper.lua'), 'utf8');
    assert.match(helper, /103/);
    await delay(1100);
    assert.equal(payloads.length, 3, 'Helper writes must not trigger a sync feedback loop');
  } finally {
    await watcher.stop();
    watchMock.mock.restore();
    fetchMock.mock.restore();
    await rm(root, { recursive: true, force: true });
  }
});
