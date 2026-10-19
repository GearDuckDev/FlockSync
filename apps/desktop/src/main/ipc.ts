import { BrowserWindow, dialog, ipcMain } from 'electron';
import { apiLogin } from './apiClient';
import { loadStored, toAppConfig, updateStored } from './configStore';
import { SyncWatcher } from './syncWatcher';
import type { AppConfig, ConfigState, LoginResult } from '../shared/ipc';

export const registerIpc = (getWindow: () => BrowserWindow | null): SyncWatcher => {
  const send = (channel: string, payload: unknown): void => {
    getWindow()?.webContents.send(channel, payload);
  };
  const watcher = new SyncWatcher({
    onLog: (e) => send('sync-log', e),
    onStatus: (s) => send('watcher-status', s),
  });

  const state = (): ConfigState => {
    const stored = loadStored();
    return { config: toAppConfig(stored), user: stored.user, status: watcher.status() };
  };

  const startIfLoggedIn = async (): Promise<void> => {
    const s = loadStored();
    if (s.token && s.user) await watcher.start(s.wowPath, {
      apiBaseUrl: s.apiBaseUrl, token: s.token,
      isAuthorizedOfficer: s.user.role === 'OFFICER' || s.user.role === 'ADMIN',
    });
  };

  ipcMain.handle('login', async (_e, apiBaseUrl: unknown, email: unknown, password: unknown): Promise<LoginResult> => {
    if (typeof apiBaseUrl !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return { ok: false, error: 'Invalid login arguments' };
    }
    const res = await apiLogin(apiBaseUrl, email, password);
    if (!res.ok) return res;
    updateStored({ apiBaseUrl: apiBaseUrl.trim(), token: res.data.token, user: res.data.user });
    await startIfLoggedIn();
    return { ok: true, user: res.data.user };
  });

  ipcMain.handle('logout', async () => {
    updateStored({ token: null, user: null });
    await watcher.stop();
  });

  ipcMain.handle('get-config', (): ConfigState => state());

  ipcMain.handle('save-config', async (_e, config: AppConfig): Promise<ConfigState> => {
    if (typeof config?.apiBaseUrl !== 'string' || typeof config?.wowPath !== 'string') return state();
    updateStored({ apiBaseUrl: config.apiBaseUrl.trim(), wowPath: config.wowPath.trim() });
    await startIfLoggedIn();
    return state();
  });

  ipcMain.handle('select-wow-folder', async (): Promise<string | null> => {
    const win = getWindow();
    const opts = { properties: ['openDirectory' as const] };
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return res.canceled ? null : (res.filePaths[0] ?? null);
  });

  ipcMain.handle('manual-sync', () => watcher.syncAll());

  return watcher;
};

export const resumeWatcher = async (watcher: SyncWatcher): Promise<void> => {
  const s = loadStored();
  if (s.token && s.user) await watcher.start(s.wowPath, {
    apiBaseUrl: s.apiBaseUrl, token: s.token,
    isAuthorizedOfficer: s.user.role === 'OFFICER' || s.user.role === 'ADMIN',
  });
};
