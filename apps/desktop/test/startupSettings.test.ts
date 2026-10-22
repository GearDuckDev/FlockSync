import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { app, fixtureRoot } from './electronMock';
import { loadStored } from '../src/main/configStore';
import {
  applyStartOnBoot, getAppSettings, HIDDEN_LAUNCH_ARG, isLaunchedHidden,
  onAppSettingsChanged, saveAppSettings,
} from '../src/main/appSettings';
import { AppSettingsPatchSchema } from '../src/main/appSettingsSchema';
import { registerAppIpc } from '../src/main/appIpc';
import { ipcHandlers } from './electronMock';

test('start-minimized preference persists, validates and remains independent of close/startup settings', async () => {
  await mkdir(fixtureRoot, { recursive: true });
  const originalArgv = [...process.argv];
  const originalPackaged = app.isPackaged;
  const registration = mock.method(app, 'setLoginItemSettings');
  let notifications = 0;
  const unsubscribe = onAppSettingsChanged(() => { notifications++; });
  try {
    process.argv = process.argv.filter((arg) => arg !== HIDDEN_LAUNCH_ARG);
    const file = join(fixtureRoot, 'config.json');
    await writeFile(file, JSON.stringify({
      startOnBoot: true, minimizeToTray: true, apiBaseUrl: 'https://guild.example',
    }));
    assert.equal(getAppSettings().startMinimized, false, 'Old configurations default to an open window');
    assert.equal(isLaunchedHidden(), false);
    assert.equal(AppSettingsPatchSchema.safeParse({ startMinimized: true }).success, true);
    assert.equal(AppSettingsPatchSchema.safeParse({ startMinimized: 'true' }).success, false);
    assert.equal(AppSettingsPatchSchema.safeParse({ startMinimized: true, extra: true }).success, false);

    registerAppIpc();
    const save = ipcHandlers.get('save-app-settings');
    assert.ok(save);
    save(undefined, { startMinimized: true });
    assert.equal(getAppSettings().startMinimized, true, 'IPC must save the new field');
    assert.equal(isLaunchedHidden(), true);
    const stored: unknown = JSON.parse(await readFile(file, 'utf8'));
    assert.ok(typeof stored === 'object' && stored !== null && 'startMinimized' in stored);
    assert.equal(stored.startMinimized, true);
    assert.equal(loadStored().apiBaseUrl, 'https://guild.example');
    assert.equal(getAppSettings().minimizeToTray, true);
    assert.equal(getAppSettings().startOnBoot, true);
    assert.equal(notifications, 1);

    saveAppSettings({ minimizeToTray: false, startOnBoot: false });
    assert.equal(isLaunchedHidden(), true, 'Closing/Windows startup preferences must not change launch visibility');
    saveAppSettings({ startMinimized: false });
    assert.equal(isLaunchedHidden(), false);
    process.argv.push(HIDDEN_LAUNCH_ARG);
    assert.equal(isLaunchedHidden(), true, 'Explicit --hidden remains supported');

    app.isPackaged = true;
    applyStartOnBoot(true);
    assert.deepEqual(registration.mock.calls.at(-1)?.arguments[0], {
      openAtLogin: true,
      path: process.env['PORTABLE_EXECUTABLE_FILE'] ?? process.execPath,
      args: [],
    }, 'Windows startup must not force --hidden when the preference is disabled');
    applyStartOnBoot(false);
    assert.equal(registration.mock.calls.at(-1)?.arguments[0].openAtLogin, false);
  } finally {
    unsubscribe();
    registration.mock.restore();
    process.argv = originalArgv;
    app.isPackaged = originalPackaged;
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
