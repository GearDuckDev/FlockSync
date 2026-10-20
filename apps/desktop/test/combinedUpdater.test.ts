import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { test } from 'node:test';
import { type GitHubRelease, type ReleaseManifest } from '@flocksync/shared-types';
import { app, fixtureRoot, setFetchImplementation } from './electronMock';
import { updateStored } from '../src/main/configStore';
import { checkForUpdates, getPendingUpdate, startUpdater, stopUpdater } from '../src/main/updater';

const manifest = (releaseVersion: string): ReleaseManifest => ({
  schemaVersion: 1,
  releaseVersion,
  components: {
    desktop: { version: '0.2.1-beta', assets: ['FlockSync-Setup-0.2.1-beta-x64.exe'] },
    server: { version: '0.2.1-beta', assets: ['server.tar.gz'] },
    addon: { version: '0.3.1-beta', assets: ['FlockSync.zip'] },
    helper: { version: '0.2.1-beta', assets: ['FlockSync_AppHelper.zip'] },
  },
});
const release = (value: ReleaseManifest): GitHubRelease => ({
  tag_name: `v${value.releaseVersion}`,
  html_url: `https://github.com/Tests/Combined/releases/tag/v${value.releaseVersion}`,
  draft: false,
  prerelease: true,
  assets: [
    { name: 'flocksync-release.json' },
    ...Object.values(value.components).flatMap((entry) => entry.assets.map((name) => ({ name }))),
  ],
});
const json = (value: unknown, init?: ResponseInit): Response => new Response(JSON.stringify(value), init);

test('combined updater loads manifests after pagination, caches them, and compares desktop versions only', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  const originalVersion = app.getVersion;
  const notifications: string[] = [];
  let repo = 'Tests/Combined';
  try {
    updateStored({ updateChannel: 'beta' });
    const value = manifest('1.0.0-beta');
    const requests: { url: string; signal: AbortSignal | null | undefined }[] = [];
    setFetchImplementation(async (url, init) => {
      requests.push({ url, signal: init?.signal });
      if (url.includes('/releases/download/')) return json(value);
      return new URL(url).searchParams.get('page') === '1'
        ? json([], { headers: { link: '<ignored>; rel="next"' } })
        : json([release(value)]);
    });
    startUpdater({
      getWindow: () => null, getRepo: () => repo,
      onUpdateFound: (update) => notifications.push(update.version),
    });
    assert.equal((await checkForUpdates(true)).status, 'available');
    assert.equal(getPendingUpdate()?.version, '0.2.1-beta');
    assert.deepEqual(notifications, ['0.2.1-beta']);
    assert.equal(requests.length, 3);
    assert.equal(requests[2]?.url,
      'https://github.com/Tests/Combined/releases/download/v1.0.0-beta/flocksync-release.json');
    assert.ok(requests[0]?.signal);
    assert.ok(requests.every((request) => request.signal === requests[0]?.signal));
    await checkForUpdates(true);
    assert.equal(requests.length, 3, 'validated manifests are cached with the release list');
    app.getVersion = () => '0.2.1-beta';
    repo = 'Tests/AddonOnly';
    const newer = manifest('2.0.0-beta');
    newer.components.addon.version = '0.3.2-beta';
    setFetchImplementation(async (url) => json(url.includes('/releases/download/') ? newer : [release(newer)]));
    assert.equal((await checkForUpdates(true)).status, 'up-to-date');
    assert.equal(getPendingUpdate(), null);
    assert.deepEqual(notifications, ['0.2.1-beta'], 'addon-only releases do not notify desktop users');
  } finally {
    app.getVersion = originalVersion;
    stopUpdater();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('combined updater excludes incomplete assets and reports manifest download and validation failures', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  let repo = '';
  const value = manifest('1.0.0-beta');
  try {
    updateStored({ updateChannel: 'beta' });
    startUpdater({ getWindow: () => null, getRepo: () => repo, onUpdateFound: assert.fail });
    for (const missing of ['flocksync-release.json', 'FlockSync-Setup-0.2.1-beta-x64.exe']) {
      repo = `Tests/Missing${missing}`;
      const incomplete = release(value);
      incomplete.assets = incomplete.assets.filter((asset) => asset.name !== missing);
      setFetchImplementation(async (url) => json(url.includes('/releases/download/') ? value : [incomplete]));
      assert.equal((await checkForUpdates(true)).status, 'up-to-date', `${missing} is not an installable release`);
    }
    for (const [name, response, message] of [
      ['HTTP', () => json({}, { status: 503 }), /manifest.*HTTP 503/i],
      ['JSON', () => new Response('invalid-json'), /JSON|Unexpected token/i],
      ['Version', () => json({ ...value, releaseVersion: '9.0.0-beta' }), /does not match/],
      ['Schema', () => json({ ...value, schemaVersion: 2 }), /schemaVersion/],
    ] as const) {
      repo = `Tests/Manifest${name}`;
      let requests = 0;
      setFetchImplementation(async (url) => {
        requests++;
        return url.includes('/releases/download/') ? response() : json([release(value)]);
      });
      const result = await checkForUpdates(true);
      assert.equal(result.status, 'error');
      if (result.status === 'error') assert.match(result.message, message);
      assert.equal((await checkForUpdates(true)).status, 'error');
      assert.equal(requests, 2, 'manifest failures use the existing failure cooldown');
    }
  } finally {
    stopUpdater();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
