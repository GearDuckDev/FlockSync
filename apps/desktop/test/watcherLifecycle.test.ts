import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { mock, test } from 'node:test';
import chokidar from 'chokidar';
import { OfficerSyncPayloadSchema } from '@flocksync/shared-types';
import { SyncWatcher } from '../src/main/syncWatcher';
import type { SyncLogEvent } from '../src/shared/ipc';

const source = (epoch: number): string => `FlockSyncDB = {
  addonVersion = "test", exportedAt = ${epoch}, officerCharacter = "Tester (Realm)",
  characters = { ["Player-Test"] = {
    guid = "Player-Test", name = "Tester", realm = "Realm", classId = 1, level = 60,
    isActive = true, lastSeenAt = ${epoch},
    role = { primaryRole = "DPS", offSpecEnabled = false, updatedAt = ${epoch} },
    gear = { items = {}, updatedAt = ${epoch} },
  } },
}`;

const waitFor = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 160; attempt++) {
    if (condition()) return;
    await delay(50);
  }
  assert.fail('Watcher did not reach expected state within eight seconds');
};

test('watcher stabilizes partial/rapid saves, replaces atomically, recovers after failure and stops cleanly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flocksync-watcher-lifecycle-'));
  const saved = join(root, 'WTF', 'Account', 'synthetic', 'SavedVariables');
  const file = join(saved, 'FlockSync.lua');
  const helper = join(saved, 'FlockSync_AppHelper.lua');
  const logs: SyncLogEvent[] = [];
  const epochs: number[] = [];
  let failNext = false;
  const watcher = new SyncWatcher({ onLog: entry => logs.push(entry), onStatus: () => undefined });
  const originalWatch = chokidar.watch;
  let ready = Promise.resolve();
  const watchMock = mock.method(chokidar, 'watch', (...args: Parameters<typeof originalWatch>) => {
    const instance = originalWatch(...args);
    ready = new Promise<void>(resolve => instance.once('ready', resolve));
    return instance;
  });
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const payload = OfficerSyncPayloadSchema.parse(JSON.parse(String(init?.body)));
    epochs.push(payload.exportedAt);
    if (failNext) {
      failNext = false;
      return new Response(JSON.stringify({ message: 'Synthetic outage' }), { status: 503 });
    }
    return new Response(JSON.stringify({
      isAuthorizedOfficer: true, culledCharacterGuids: [], serverTimestamp: payload.exportedAt,
      craftersIndex: [], upcomingRaids: [], goalMatches: [],
    }));
  });
  const context = { apiBaseUrl: 'https://example.test', token: 'synthetic' };
  try {
    await mkdir(saved, { recursive: true });
    await writeFile(file, source(100));
    await watcher.start(root, context);
    await ready;
    const partial = source(101);
    await writeFile(file, partial.slice(0, 100));
    await delay(200);
    await appendFile(file, partial.slice(100));
    await waitFor(() => logs.length === 1);
    assert.equal(logs[0]?.status, 'SUCCESS');
    assert.deepEqual(epochs, [101], 'Partial data must not upload before writes settle');

    await writeFile(file, source(102));
    await delay(100);
    await writeFile(file, source(103));
    await delay(100);
    await writeFile(file, source(104));
    await waitFor(() => epochs.includes(104));
    await waitFor(() => logs.length === 2);
    assert.deepEqual(epochs, [101, 104], 'Rapid writes should upload the final stable state once');

    const temporary = join(saved, 'FlockSync.tmp');
    await writeFile(temporary, source(105));
    await rename(temporary, file);
    await waitFor(() => logs.length === 3);
    assert.equal(epochs.at(-1), 105);

    const previousHelper = await readFile(helper, 'utf8');
    failNext = true;
    await writeFile(file, source(106));
    await waitFor(() => logs.length === 4);
    assert.equal(logs.at(-1)?.status, 'ERROR');
    assert.match(logs.at(-1)?.message ?? '', /HTTP 503/);
    assert.equal(await readFile(helper, 'utf8'), previousHelper, 'Failed uploads must preserve helper');
    await writeFile(file, source(107));
    await waitFor(() => logs.length === 5);
    assert.equal(logs.at(-1)?.status, 'SUCCESS', 'Next save retries after a failed request');
    await delay(1200);
    assert.equal(logs.length, 5, 'Helper writes must not cause duplicates or a feedback loop');

    await watcher.stop();
    assert.equal(watcher.status().running, false);
    await writeFile(file, source(108));
    await delay(1100);
    assert.equal(logs.length, 5, 'Stopped watchers must not upload');
    await watcher.start(root, context);
    await ready;
    await writeFile(file, source(109));
    await waitFor(() => logs.length === 6);
    assert.equal(epochs.at(-1), 109);
  } finally {
    await watcher.stop();
    watchMock.mock.restore();
    fetchMock.mock.restore();
    await rm(root, { recursive: true, force: true });
  }
});

test('missing/new account folders are reported and discovered on explicit watcher restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flocksync-watcher-accounts-'));
  const logs: SyncLogEvent[] = [];
  const watcher = new SyncWatcher({ onLog: entry => logs.push(entry), onStatus: () => undefined });
  const originalWatch = chokidar.watch;
  let ready = Promise.resolve();
  const watchMock = mock.method(chokidar, 'watch', (...args: Parameters<typeof originalWatch>) => {
    const instance = originalWatch(...args);
    ready = new Promise<void>(resolve => instance.once('ready', resolve));
    return instance;
  });
  const context = { apiBaseUrl: 'https://example.test', token: 'synthetic' };
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    const payload = OfficerSyncPayloadSchema.parse(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({
      isAuthorizedOfficer: true, culledCharacterGuids: [], serverTimestamp: payload.exportedAt,
      craftersIndex: [], upcomingRaids: [], goalMatches: [],
    }));
  });
  try {
    await watcher.start(root, context);
    assert.equal(watcher.status().running, false);
    assert.match(logs.at(-1)?.message ?? '', /No WTF\/Account/);
    const first = join(root, 'WTF', 'Account', 'first', 'SavedVariables');
    await mkdir(first, { recursive: true });
    await watcher.start(root, context);
    await ready;
    const second = join(root, 'WTF', 'Account', 'second', 'SavedVariables');
    await mkdir(second, { recursive: true });
    await watcher.start(root, context);
    await ready;
    const count = logs.length;
    for (const directory of [first, second]) {
      await writeFile(join(directory, 'FlockSync.lua'), 'invalid synthetic Lua');
    }
    await waitFor(() => logs.length === count + 2);
    assert.equal(watcher.status().files.length, 2);
    for (const entry of logs.slice(count)) {
      assert.equal(entry.status, 'ERROR');
      assert.match(entry.message, /Lua parse failed/);
    }
    await writeFile(join(first, 'FlockSync.lua'), source(201));
    await writeFile(join(second, 'FlockSync.lua'), source(202));
    await waitFor(() => logs.length === count + 4);
    for (const entry of logs.slice(count + 2)) assert.equal(entry.status, 'SUCCESS');
    assert.match(await readFile(join(first, 'FlockSync_AppHelper.lua'), 'utf8'), /201/);
    assert.match(await readFile(join(second, 'FlockSync_AppHelper.lua'), 'utf8'), /202/);
    assert.equal(fetchMock.mock.callCount(), 2, 'Each account must upload once, without cross-writing helpers');
  } finally {
    await watcher.stop();
    watchMock.mock.restore();
    fetchMock.mock.restore();
    await rm(root, { recursive: true, force: true });
  }
});
