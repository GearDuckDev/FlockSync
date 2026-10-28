import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { mock, test } from 'node:test';
import chokidar, { type FSWatcher } from 'chokidar';
import { fixtureRoot } from './electronMock';
import { loadStored, updateStored } from '../src/main/configStore';
import { apiLogin, apiSync } from '../src/main/apiClient';
import { SyncWatcher } from '../src/main/syncWatcher';
import type { SyncLogEvent } from '../src/shared/ipc';

test('fresh installs default to Forever while saved client paths remain unchanged', async () => {
  await rm(fixtureRoot, { recursive: true, force: true });
  try {
    assert.equal(loadStored().wowPath, 'C:\\Program Files (x86)\\World of Warcraft\\_forever_');
    for (const wowPath of [
      'D:\\Games\\World of Warcraft\\_forever_',
      'C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_',
    ]) {
      updateStored({ wowPath });
      assert.equal(loadStored().wowPath, wowPath);
      updateStored({ apiBaseUrl: 'https://example.test' });
      assert.equal(loadStored().wowPath, wowPath);
      assert.equal(JSON.parse(await readFile(join(fixtureRoot, 'config.json'), 'utf8')).wowPath, wowPath);
    }
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('configuration retains the documented server URL across saves and reloads', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  try {
    const url = 'https://flocksync.gearduckdev.com';
    updateStored({ apiBaseUrl: url });
    assert.equal(loadStored().apiBaseUrl, url);
    updateStored({ wowPath: 'C:\\Games\\WoW' });
    assert.equal(loadStored().apiBaseUrl, url);
    assert.equal(JSON.parse(await readFile(join(fixtureRoot, 'config.json'), 'utf8')).apiBaseUrl, url);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('invalid API URLs report actionable errors before making network requests', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', () => {
    throw new Error('Invalid URLs must not reach fetch');
  });
  try {
    for (const url of ['', 'not-a-url', '/api', 'file:///C:/server']) {
      const result = await apiLogin(url, 'test@example.test', 'test');
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /valid HTTP or HTTPS API URL in settings/);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
    const result = await apiSync('', 'test-token', {
      addonVersion: '0.3.1-beta', exportedAt: 1, characters: [],
      officerCharacter: {
        guid: 'Player-Test', name: 'Test', realm: 'Test', classId: 1, level: 60,
        isActive: true, lastSeenAt: 1, gear: { items: [], updatedAt: 1 },
        role: { primaryRole: 'DPS', offSpecEnabled: false, updatedAt: 1 },
      },
    });
    assert.equal(result.ok, false);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
  }
});

test('watcher excludes other addon files but detects FlockSync creation and replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flocksync-watcher-'));
  const saved = join(root, 'WTF', 'Account', 'test', 'SavedVariables');
  const logs: SyncLogEvent[] = [];
  const watcher = new SyncWatcher({ onLog: (event) => logs.push(event), onStatus: () => undefined });
  const originalWatch = chokidar.watch;
  let captured: FSWatcher | undefined;
  const watchMock = mock.method(chokidar, 'watch', (...args: Parameters<typeof originalWatch>) => {
    captured = originalWatch(...args);
    return captured;
  });
  const waitFor = async (condition: () => boolean): Promise<void> => {
    for (let i = 0; i < 100; i++) {
      if (condition()) return;
      await delay(50);
    }
    assert.fail('Watcher did not reach expected state within five seconds');
  };
  try {
    await mkdir(saved, { recursive: true });
    await writeFile(join(saved, 'Auctionator.lua.tmp'), 'unrelated');
    await writeFile(join(saved, 'Auctionator.lua'), 'unrelated');
    await writeFile(join(saved, 'FlockSync_AppHelper.lua'), 'unrelated');
    await watcher.start(root, { apiBaseUrl: 'https://example.test', token: 'test' });
    assert.ok(captured);
    await new Promise<void>((resolve) => captured?.once('ready', resolve));
    assert.deepEqual(captured.getWatched()[saved], []);
    const file = join(saved, 'FlockSync.lua');
    // Invalid Lua gives a local parse log without sending data to a server.
    await writeFile(file, 'invalid lua');
    await waitFor(() => logs.length === 1);
    assert.deepEqual(captured.getWatched()[saved], ['FlockSync.lua']);
    await rm(file);
    await delay(300);
    await writeFile(file, 'replacement invalid lua');
    await waitFor(() => logs.length === 2);
    await writeFile(join(saved, 'Auctionator.lua.tmp'), 'another save');
    await delay(1000);
    assert.equal(logs.length, 2);
    assert.deepEqual(captured.getWatched()[saved], ['FlockSync.lua']);
  } finally {
    await watcher.stop();
    watchMock.mock.restore();
    await rm(root, { recursive: true, force: true });
  }
});
