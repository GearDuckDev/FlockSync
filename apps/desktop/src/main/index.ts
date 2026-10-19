import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerIpc, resumeWatcher } from './ipc';
import { registerAppIpc } from './appIpc';
import { loadStored } from './configStore';
import {
  applyStartOnBoot,
  getAppSettings,
  isLaunchedHidden,
  onAppSettingsChanged,
  saveAppSettings,
} from './appSettings';
import { checkForUpdates, startUpdater, stopUpdater } from './updater';
import { createTray, destroyTray, hasTray, notifyFromTray, refreshTrayMenu } from './tray';

let mainWindow: BrowserWindow | null = null;
// Set by tray Quit / OS shutdown so the close-to-tray handler lets the window close.
let isQuitting = false;
let trayHintShown = false;

const createWindow = (showOnReady: boolean): BrowserWindow => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: '#14161c',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.once('ready-to-show', () => {
    if (showOnReady) win.show();
  });
  win.on('close', (event) => {
    if (isQuitting || !hasTray() || !loadStored().minimizeToTray) return;
    event.preventDefault();
    win.hide();
    if (!trayHintShown) {
      trayHintShown = true;
      notifyFromTray('FlockSync is still running', 'Syncing continues in the background. Right-click the tray icon to quit.');
    }
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  mainWindow = win;
  return win;
};

const showWindow = (): void => {
  const win = mainWindow ?? createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
};

const quitApp = (): void => {
  isQuitting = true;
  app.quit();
};

const runTrayUpdateCheck = async (): Promise<void> => {
  const result = await checkForUpdates(true);
  if (result.status === 'available') showWindow();
  else if (result.status === 'up-to-date') notifyFromTray('FlockSync is up to date', `You are running v${result.currentVersion}.`);
  else if (result.status === 'error') notifyFromTray('Update check failed', result.message);
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (app.isReady()) showWindow();
  });

  void app.whenReady().then(() => {
    const launchedHidden = isLaunchedHidden();
    applyStartOnBoot(getAppSettings().startOnBoot);
    const watcher = registerIpc(() => mainWindow);
    registerAppIpc();

    createTray({
      showWindow,
      syncNow: () => void watcher.syncAll(),
      checkForUpdates: () => void runTrayUpdateCheck(),
      getSettings: getAppSettings,
      saveSettings: (patch) => void saveAppSettings(patch),
      quit: quitApp,
    });
    onAppSettingsChanged((settings) => {
      refreshTrayMenu();
      mainWindow?.webContents.send('app-settings-changed', settings);
    });

    // Without a tray there is no way back to a hidden window, so always show it then.
    const win = createWindow(!launchedHidden || !hasTray());
    win.webContents.once('did-finish-load', () => void resumeWatcher(watcher));

    startUpdater({
      getWindow: () => mainWindow,
      getRepo: () => loadStored().githubRepo,
      onUpdateFound: (update) => {
        if (!mainWindow?.isVisible()) {
          notifyFromTray('FlockSync update available', `v${update.version} is available. Open FlockSync to download it.`);
        }
      },
    });

    app.on('activate', showWindow);
    app.on('before-quit', () => {
      isQuitting = true;
      stopUpdater();
      destroyTray();
      void watcher.stop();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
