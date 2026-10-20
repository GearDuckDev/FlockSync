import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppSettingsPatchSchema } from '../src/main/appSettingsSchema';
import { selectDesktopUpdate } from '../src/main/releaseSelection';
import { serializeServerReturnToLua } from '../src/main/luaParser';
import { luaToJs, parseLuaAssignment } from '../src/main/luaTable';
import { ServerReturnPayloadSchema, type GitHubRelease } from '@flocksync/shared-types';

const release = (
  version: string,
  prerelease: boolean,
  assetVersion = version,
): GitHubRelease => ({
  tag_name: `desktop-v${version}`,
  html_url: `https://github.com/GearDuckDev/FlockSync/releases/tag/desktop-v${version}`,
  body: `${version} notes`,
  draft: false,
  prerelease,
  assets: [{ name: `FlockSync-Setup-${assetVersion}-x64.exe` }],
});

test('desktop update selection respects release, beta, and alpha channels', () => {
  const releases = [
    release('1.2.0', false),
    release('1.3.0-beta.2', true),
    release('1.4.0-alpha.1', true),
    release('1.5.0-alpha.1', false),
    release('1.6.0-beta.1', true, '1.0.0'),
  ];
  assert.equal(selectDesktopUpdate(releases, '1.1.0', 'release')?.version, '1.2.0');
  assert.equal(selectDesktopUpdate(releases, '1.2.0', 'beta')?.version, '1.3.0-beta.2');
  assert.equal(selectDesktopUpdate(releases, '1.3.0-beta.2', 'alpha')?.version, '1.4.0-alpha.1');
  assert.equal(selectDesktopUpdate(releases, '1.4.0-alpha.1', 'alpha'), null);
});

test('desktop settings validation accepts only supported update channels', () => {
  for (const updateChannel of ['release', 'beta', 'alpha']) {
    assert.equal(AppSettingsPatchSchema.safeParse({ updateChannel }).success, true);
  }
  assert.equal(AppSettingsPatchSchema.safeParse({ updateChannel: 'preview' }).success, false);
  assert.equal(AppSettingsPatchSchema.safeParse({ updateChannel: 'alpha', unexpected: true }).success, false);
});

test('helper Lua serialization preserves the optional addon release catalog', () => {
  const payload = ServerReturnPayloadSchema.parse({
    culledCharacterGuids: [],
    serverTimestamp: 123,
    addonReleases: {
      release: {
        version: '1.2.0',
        url: 'https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v1.2.0',
        releaseNotes: 'Stable addon',
        channel: 'release',
      },
      beta: {
        version: '1.3.0-beta.1',
        url: 'https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v1.3.0-beta.1',
        releaseNotes: 'Beta addon',
        channel: 'beta',
      },
      alpha: {
        version: '1.4.0-alpha.1',
        url: 'https://github.com/GearDuckDev/FlockSync/releases/tag/addon-v1.4.0-alpha.1',
        releaseNotes: 'Alpha addon',
        channel: 'alpha',
      },
    },
  });
  const lua = serializeServerReturnToLua(payload);
  assert.deepEqual(luaToJs(parseLuaAssignment(lua, 'FlockSyncHelperDB')), {
    ...payload,
    isAuthorizedOfficer: true,
  });
});
