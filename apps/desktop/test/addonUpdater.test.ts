import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import type { GitHubRelease } from '@flocksync/shared-types';
import { fixtureRoot, resetFetchImplementation, setFetchImplementation } from './electronMock';
import { updateStored } from '../src/main/configStore';
import { ADDON_BUNDLE_ASSET, selectHelperAddonUpdate } from '../src/main/addonReleaseSelection';
import { HELPER_ADDON, inspectInstalledAddon, installAddonFromZip } from '../src/main/addonInstaller';
import { checkHelperAddonUpdate, startAddonUpdater, stopAddonUpdater } from '../src/main/addonUpdater';
import type { SyncLogEvent } from '../src/shared/ipc';

const buildZip = (files: Record<string, string>): Buffer => {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    const compressed = deflateRawSync(data);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    parts.push(local, nameBytes, compressed);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  const count = Object.keys(files).length;
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
};

const toc = (version: string): string => `## Interface: 16001\n## Title: FlockSync AppHelper\n## Version: ${version}\n`;
const bundle = (version: string, extra: Record<string, string> = {}): Buffer => buildZip({
  'FlockSync/FlockSync.toc': '## Version: 9.9.9\n',
  [`${HELPER_ADDON}/${HELPER_ADDON}.toc`]: toc(version),
  [`${HELPER_ADDON}/Core.lua`]: `-- helper ${version}`,
  ...extra,
});
const release = (tag: string, helper: string, digest: string | null): GitHubRelease => ({
  tag_name: tag, html_url: `https://github.com/Tests/Addon/releases/tag/${tag}`, draft: false, prerelease: false,
  assets: [{ name: ADDON_BUNDLE_ASSET, digest }, { name: 'flocksync-release.json' }],
  manifest: {
    schemaVersion: 1, releaseVersion: tag.slice(1),
    components: {
      desktop: { version: '1.0.0', assets: ['flocksync-release.json'] },
      server: { version: '1.0.0', assets: ['flocksync-release.json'] },
      addon: { version: '1.0.0', assets: [ADDON_BUNDLE_ASSET] },
      helper: { version: helper, assets: [ADDON_BUNDLE_ASSET] },
    },
  },
});
const sha = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

const setupClient = async (name: string, version: string): Promise<{ root: string; helper: string }> => {
  const root = join(fixtureRoot, name);
  const helper = join(root, 'Interface', 'AddOns', HELPER_ADDON);
  await rm(root, { recursive: true, force: true });
  await mkdir(helper, { recursive: true });
  await writeFile(join(helper, `${HELPER_ADDON}.toc`), toc(version));
  await writeFile(join(helper, 'Old.lua'), '-- old');
  return { root, helper };
};

test('helper selection requires a newer manifest version and a GitHub SHA-256 digest', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const releases = [release('v1.2.0', '1.1.0', digest), release('v1.1.0', '1.0.0', digest)];
  const update = selectHelperAddonUpdate(releases, '1.0.0', 'release', 'Tests/Addon');
  assert.deepEqual(update, {
    version: '1.1.0', tag: 'v1.2.0', sha256: 'a'.repeat(64),
    downloadUrl: `https://github.com/Tests/Addon/releases/download/v1.2.0/${ADDON_BUNDLE_ASSET}`,
  });
  assert.equal(selectHelperAddonUpdate(releases, '1.1.0', 'release', 'Tests/Addon'), null);
  assert.equal(selectHelperAddonUpdate([release('v1.2.0', '1.1.0', null)], '1.0.0', 'release', 'Tests/Addon'), null);
});

test('installer swaps only the helper folder, keeps a backup, and rejects unsafe or mismatched archives', async () => {
  const { root, helper } = await setupClient('install', '1.0.0');
  try {
    await assert.rejects(installAddonFromZip(root, bundle('1.0.5'), HELPER_ADDON, '1.1.0'), /does not match/);
    await assert.rejects(
      installAddonFromZip(root, bundle('1.1.0', { [`${HELPER_ADDON}/../Evil.lua`]: 'x' }), HELPER_ADDON, '1.1.0'),
      /Unsafe archive path/,
    );
    assert.equal(await readFile(join(helper, 'Old.lua'), 'utf8'), '-- old');

    await installAddonFromZip(root, bundle('1.1.0'), HELPER_ADDON, '1.1.0');
    assert.deepEqual(await inspectInstalledAddon(root, HELPER_ADDON), { state: 'installed', path: helper, version: '1.1.0' });
    await assert.rejects(stat(join(helper, 'Old.lua')));
    await assert.rejects(stat(join(root, 'Interface', 'AddOns', 'FlockSync')));
    await assert.rejects(stat(join(root, 'Evil.lua')));
    const backup = join(root, 'FlockSync-Updates', 'backup', HELPER_ADDON);
    assert.equal(await readFile(join(backup, 'Old.lua'), 'utf8'), '-- old');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scheduler skips linked folders, rejects bad digests, waits for WoW, then installs', async () => {
  const { root, helper } = await setupClient('scheduler', '1.0.0');
  const logs: SyncLogEvent[] = [];
  const notices: string[] = [];
  let zip = bundle('1.1.0');
  let digest = sha(zip);
  let wowRunning = true;
  setFetchImplementation(async () => new Response(new Uint8Array(zip)));
  try {
    updateStored({ wowPath: root, updateChannel: 'release', githubRepo: 'Tests/Addon' });
    startAddonUpdater({
      getReleases: async () => [release('v1.2.0', '1.1.0', `sha256:${digest}`)],
      onLog: (event) => logs.push(event),
      notify: (title) => notices.push(title),
      isWowRunning: async () => wowRunning,
    });

    await checkHelperAddonUpdate();
    assert.match(logs.at(-1)?.message ?? '', /after World of Warcraft closes/);
    assert.equal((await inspectInstalledAddon(root, HELPER_ADDON)).state, 'installed');
    assert.equal(await readFile(join(helper, 'Old.lua'), 'utf8'), '-- old');

    wowRunning = false;
    await checkHelperAddonUpdate(false);
    assert.equal(await readFile(join(helper, 'Core.lua'), 'utf8'), '-- helper 1.1.0');
    assert.deepEqual(notices, ['FlockSync addon updated']);

    zip = bundle('1.2.0');
    digest = sha(bundle('1.2.1'));
    await writeFile(join(helper, `${HELPER_ADDON}.toc`), toc('1.0.0'));
    await checkHelperAddonUpdate();
    assert.match(logs.at(-1)?.message ?? '', /SHA-256/);
    assert.equal(await readFile(join(helper, 'Core.lua'), 'utf8'), '-- helper 1.1.0');

    const linkedRoot = join(fixtureRoot, 'linked');
    const linkedAddOns = join(linkedRoot, 'Interface', 'AddOns');
    await rm(linkedRoot, { recursive: true, force: true });
    await mkdir(linkedAddOns, { recursive: true });
    await symlink(helper, join(linkedAddOns, HELPER_ADDON), 'junction');
    updateStored({ wowPath: linkedRoot });
    await checkHelperAddonUpdate();
    assert.match(logs.at(-1)?.message ?? '', /linked folder/);
    await rm(linkedRoot, { recursive: true, force: true });
  } finally {
    stopAddonUpdater();
    resetFetchImplementation();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
