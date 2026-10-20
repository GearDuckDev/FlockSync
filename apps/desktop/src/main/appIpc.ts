import { app, ipcMain, shell } from 'electron';
import type { AppSettingsState } from '../shared/ipc';
import { AppSettingsPatchSchema } from './appSettingsSchema';
import { getAppSettings, saveAppSettings } from './appSettings';
import { getPendingUpdate } from './updater';

const settingsState = (): AppSettingsState => ({
  settings: getAppSettings(),
  appVersion: app.getVersion(),
  pendingUpdate: getPendingUpdate(),
});

const isSafeExternalUrl = (raw: unknown): raw is string => {
  if (typeof raw !== 'string') return false;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
};

export const registerAppIpc = (): void => {
  ipcMain.handle('get-app-settings', (): AppSettingsState => settingsState());

  ipcMain.handle('save-app-settings', (_e, raw: unknown): AppSettingsState => {
    const parsed = AppSettingsPatchSchema.safeParse(raw);
    if (!parsed.success) return settingsState();
    const patch: Partial<AppSettingsState['settings']> = {};
    if (parsed.data.minimizeToTray !== undefined) patch.minimizeToTray = parsed.data.minimizeToTray;
    if (parsed.data.startOnBoot !== undefined) patch.startOnBoot = parsed.data.startOnBoot;
    if (parsed.data.updateChannel !== undefined) patch.updateChannel = parsed.data.updateChannel;
    saveAppSettings(patch);
    return settingsState();
  });

  ipcMain.handle('open-external', async (_e, url: unknown): Promise<void> => {
    if (!isSafeExternalUrl(url)) return;
    try {
      await shell.openExternal(url);
    } catch (err) {
      console.error('[shell] failed to open external URL', err);
    }
  });
};
