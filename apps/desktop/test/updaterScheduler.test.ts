import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { test } from 'node:test';
import { app, fixtureRoot, setFetchImplementation, resetFetchImplementation } from './electronMock';
import { updateStored } from '../src/main/configStore';
import { startUpdater, stopUpdater } from '../src/main/updater';

test('desktop updater schedules a 15-second startup check and six-hour interval', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  const originalVersion = app.getVersion;
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearTimeout = globalThis.clearTimeout;
  const requests: string[] = [];
  let startupDelay: number | undefined;
  let intervalDelay: number | undefined;
  let startupCallback: (() => void) | undefined;
  let intervalCallback: (() => void) | undefined;
  let repo = 'Tests/SchedulerStartup';

  try {
    globalThis.setTimeout = ((callback: () => void, delay?: number): NodeJS.Timeout => {
      startupCallback = callback;
      startupDelay = delay;
      return {} as NodeJS.Timeout;
    }) as typeof globalThis.setTimeout;
    globalThis.setInterval = ((callback: () => void, delay?: number): NodeJS.Timeout => {
      intervalCallback = callback;
      intervalDelay = delay;
      return {} as NodeJS.Timeout;
    }) as typeof globalThis.setInterval;
    globalThis.clearTimeout = (() => undefined) as typeof globalThis.clearTimeout;

    app.getVersion = () => '0.2.1-beta';
    updateStored({ updateChannel: 'beta', githubRepo: repo });
    setFetchImplementation(async (url) => {
      requests.push(url);
      return new Response(JSON.stringify([{
        tag_name: 'desktop-v0.2.1-beta',
        html_url: `https://github.com/${repo}/releases/tag/desktop-v0.2.1-beta`,
        draft: false,
        prerelease: true,
        assets: [{ name: 'FlockSync-Setup-0.2.1-beta-x64.exe' }],
      }]));
    });
    startUpdater({
      getWindow: () => null,
      getRepo: () => repo,
      onUpdateFound: () => assert.fail('No update should be found for the current release'),
    });

    assert.equal(startupDelay, 15_000);
    assert.equal(intervalDelay, 6 * 60 * 60 * 1000);
    assert.ok(startupCallback);
    assert.ok(intervalCallback);
    startupCallback();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 1, 'startup callback checks GitHub');
    repo = 'Tests/SchedulerInterval';
    intervalCallback();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 2, 'interval callback checks GitHub without waiting six hours');
  } finally {
    stopUpdater();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    app.getVersion = originalVersion;
    resetFetchImplementation();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
