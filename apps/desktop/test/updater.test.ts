import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { test } from 'node:test';
import type { BrowserWindow } from 'electron';
import { fixtureRoot, ipcListeners, setFetchImplementation } from './electronMock';
import { loadStored, updateStored } from '../src/main/configStore';
import {
  checkForUpdates, getPendingUpdate, resetUpdateChannel, startUpdater, stopUpdater,
} from '../src/main/updater';

const releases = [
  ['1.0.0', false],
  ['1.1.0-beta.1', true],
  ['1.2.0-alpha.1', true],
].map(([version, prerelease]) => ({
  tag_name: `desktop-v${version}`,
  html_url: `https://github.com/GearDuckDev/FlockSync/releases/tag/desktop-v${version}`,
  draft: false,
  prerelease,
  assets: [{ name: `FlockSync-Setup-${version}-x64.exe` }],
}));

test('desktop updater persists channels, clears pending updates, and prevents in-flight channel leaks', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  const events: { channel: string; payload: unknown }[] = [];
  const notifications: unknown[] = [];
  let repo = 'Tests/Channels';
  let fetchCount = 0;
  let finishFetch: ((response: Response) => void) | undefined;
  const window = {
    isDestroyed: () => false,
    webContents: { send: (channel: string, payload: unknown) => events.push({ channel, payload }) },
  } as unknown as BrowserWindow;
  try {
    assert.equal(loadStored().updateChannel, 'release');
    setFetchImplementation(async () => {
      fetchCount++;
      return new Response(JSON.stringify(releases));
    });
    startUpdater({
      getWindow: () => window,
      getRepo: () => repo,
      onUpdateFound: (update) => notifications.push(update),
    });
    const first = await checkForUpdates(true);
    assert.equal(first.status, 'available');
    assert.equal(getPendingUpdate()?.version, '1.0.0');
    updateStored({ updateChannel: 'alpha' });
    resetUpdateChannel();
    assert.equal(loadStored().updateChannel, 'alpha');
    assert.equal(getPendingUpdate(), null);
    assert.equal(events.at(-1)?.channel, 'update-not-available');
    assert.equal((await checkForUpdates(true)).status, 'available');
    assert.equal(getPendingUpdate()?.version, '1.2.0-alpha.1');
    assert.equal(fetchCount, 1, 'channel changes reuse cached release lists');

    repo = 'Tests/InFlight';
    setFetchImplementation(() => {
      fetchCount++;
      return new Promise<Response>((resolve) => { finishFetch = resolve; });
    });
    const oldCheck = checkForUpdates(true);
    updateStored({ updateChannel: 'release' });
    resetUpdateChannel();
    const newCheck = checkForUpdates(true);
    finishFetch?.(new Response(JSON.stringify(releases)));
    assert.equal((await oldCheck).status, 'skipped');
    assert.equal((await newCheck).status, 'available');
    assert.equal(getPendingUpdate()?.version, '1.0.0');
    assert.equal(fetchCount, 2, 'simultaneous channel checks deduplicate network requests');
    assert.equal(notifications.length, 3);

    ipcListeners.get('dismiss-update')?.();
    assert.equal(getPendingUpdate(), null);
    assert.equal((await checkForUpdates()).status, 'skipped');
    assert.equal((await checkForUpdates(true)).status, 'available', 'manual check bypasses session mute');

    repo = 'Tests/Pagination';
    const urls: string[] = [];
    setFetchImplementation(async (url) => {
      urls.push(url);
      const page = new URL(url).searchParams.get('page');
      return new Response(JSON.stringify(page === '1' ? [] : releases), {
        headers: page === '1'
          ? { link: '<https://api.github.com/repos/Tests/Pagination/releases?page=2>; rel="next"' }
          : {},
      });
    });
    assert.equal((await checkForUpdates(true)).status, 'available');
    assert.equal(urls.length, 2);
    assert.ok(urls.every((url) => new URL(url).searchParams.get('per_page') === '100'));
    assert.ok(urls.every((url) => !url.includes('/latest')));

    repo = 'Tests/Truncation';
    setFetchImplementation(async () => new Response(JSON.stringify(releases), {
      headers: { link: '<https://api.github.com/repos/Tests/Truncation/releases?page=2>; rel="next"' },
    }));
    const truncated = await checkForUpdates(true);
    assert.equal(truncated.status, 'error');
    if (truncated.status === 'error') assert.match(truncated.message, /exceeds 20 pages/);

    for (const status of [404, 403, 429]) {
      repo = `Tests/Error${status}`;
      let errorsFetched = 0;
      setFetchImplementation(async () => {
        errorsFetched++;
        return new Response('{}', {
          status,
          headers: status === 403 ? { 'x-ratelimit-remaining': '0' } : {},
        });
      });
      const error = await checkForUpdates(true);
      assert.equal(error.status, 'error');
      if (error.status === 'error') {
        assert.match(error.message, status === 404 ? /private or does not exist/ : /rate limit/);
      }
      await checkForUpdates(true);
      assert.equal(errorsFetched, 1, 'repeated failures use the failure cooldown');
    }
  } finally {
    stopUpdater();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
