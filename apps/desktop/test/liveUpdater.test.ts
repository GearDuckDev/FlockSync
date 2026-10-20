import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { test } from 'node:test';
import type { BrowserWindow } from 'electron';
import { app, fixtureRoot, ipcListeners, resetFetchImplementation, setFetchImplementation } from './electronMock';
import { updateStored } from '../src/main/configStore';
import {
  checkForUpdates, getPendingUpdate, resetUpdateChannel, startUpdater, stopUpdater,
} from '../src/main/updater';

test('desktop updater checks the published GitHub release with simulated installed versions', {
  skip: process.env.FLOCKSYNC_LIVE_UPDATE_TEST !== '1',
}, async () => {
  await mkdir(fixtureRoot, { recursive: true });
  const originalVersion = app.getVersion;
  const events: { channel: string; payload: unknown }[] = [];
  const notifications: string[] = [];
  const liveRequests: string[] = [];
  const window = {
    isDestroyed: () => false,
    webContents: { send: (channel: string, payload: unknown) => events.push({ channel, payload }) },
  } as unknown as BrowserWindow;

  try {
    updateStored({ updateChannel: 'beta', githubRepo: 'GearDuckDev/FlockSync' });
    setFetchImplementation((url, init) => {
      liveRequests.push(url);
      return fetch(url, init);
    });
    startUpdater({
      getWindow: () => window,
      getRepo: () => 'GearDuckDev/FlockSync',
      onUpdateFound: (update) => notifications.push(update.version),
    });

    app.getVersion = () => '0.2.0-beta';
    const available = await checkForUpdates(true);
    assert.equal(available.status, 'available');
    if (available.status === 'available') {
      assert.equal(available.update.version, '0.2.1-beta');
      assert.equal(available.update.channel, 'beta');
      assert.match(available.update.url, /\/releases\/tag\/v0\.3\.1-beta$/);
    }
    assert.equal(getPendingUpdate()?.version, '0.2.1-beta');
    assert.ok(events.some((event) => event.channel === 'update-available'));
    assert.deepEqual(notifications, ['0.2.1-beta']);

    updateStored({ updateChannel: 'alpha' });
    resetUpdateChannel();
    const alphaChannel = await checkForUpdates(true);
    assert.equal(alphaChannel.status, 'available');
    if (alphaChannel.status === 'available') {
      assert.equal(alphaChannel.update.version, '0.2.1-beta');
      assert.equal(alphaChannel.update.channel, 'beta');
    }

    ipcListeners.get('dismiss-update')?.();
    assert.equal((await checkForUpdates()).status, 'skipped');
    assert.equal((await checkForUpdates(true)).status, 'available', 'manual checks bypass session mute');
    assert.equal(getPendingUpdate(), null, 'session mute continues to suppress the banner');
    assert.equal(events.filter((event) => event.channel === 'update-available').length, 3);

    updateStored({ updateChannel: 'beta' });
    resetUpdateChannel();
    app.getVersion = () => '0.2.1-beta';
    assert.equal((await checkForUpdates(true)).status, 'up-to-date');
    app.getVersion = () => '0.2.2-beta';
    assert.equal((await checkForUpdates(true)).status, 'up-to-date');

    updateStored({ updateChannel: 'release' });
    resetUpdateChannel();
    app.getVersion = () => '0.2.0-beta';
    assert.equal((await checkForUpdates(true)).status, 'up-to-date', 'stable channel ignores beta releases');
    assert.ok(liveRequests.includes('https://api.github.com/repos/GearDuckDev/FlockSync/releases?per_page=100&page=1'));
    assert.ok(liveRequests.includes(
      'https://github.com/GearDuckDev/FlockSync/releases/download/v0.3.1-beta/flocksync-release.json',
    ));
    console.log(`[live updater] ${liveRequests.length} request(s): ${liveRequests.join(', ')}`);
  } finally {
    app.getVersion = originalVersion;
    stopUpdater();
    resetFetchImplementation();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
