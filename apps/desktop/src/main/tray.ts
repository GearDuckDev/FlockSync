import { Menu, Tray, nativeImage } from 'electron';
import type { AppSettings } from '../shared/ipc';
import { TRAY_ICON_16, TRAY_ICON_32 } from './trayIcon';

export interface TrayActions {
  showWindow: () => void;
  syncNow: () => void;
  checkForUpdates: () => void;
  getSettings: () => AppSettings;
  saveSettings: (patch: Partial<AppSettings>) => void;
  quit: () => void;
}

let tray: Tray | null = null;
let actions: TrayActions | null = null;

const createIcon = (): Electron.NativeImage => {
  const icon = nativeImage.createEmpty();
  icon.addRepresentation({ scaleFactor: 1, dataURL: TRAY_ICON_16 });
  icon.addRepresentation({ scaleFactor: 2, dataURL: TRAY_ICON_32 });
  return icon;
};

const buildMenu = (a: TrayActions): Menu => {
  const settings = a.getSettings();
  return Menu.buildFromTemplate([
    { label: 'Open FlockSync', click: a.showWindow },
    { label: 'Sync Now', click: a.syncNow },
    { label: 'Check for Updates...', click: a.checkForUpdates },
    { type: 'separator' },
    {
      label: 'Run on Windows Startup',
      type: 'checkbox',
      checked: settings.startOnBoot,
      click: (item) => a.saveSettings({ startOnBoot: item.checked }),
    },
    {
      label: 'Minimize to Tray on Close',
      type: 'checkbox',
      checked: settings.minimizeToTray,
      click: (item) => a.saveSettings({ minimizeToTray: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit FlockSync', click: a.quit },
  ]);
};

export const createTray = (trayActions: TrayActions): void => {
  if (tray) return;
  actions = trayActions;
  try {
    tray = new Tray(createIcon());
    tray.setToolTip('FlockSync');
    tray.setContextMenu(buildMenu(trayActions));
    tray.on('double-click', trayActions.showWindow);
  } catch (err) {
    console.error('[tray] failed to create tray icon', err);
    tray = null;
  }
};

/** Rebuild so checkbox states follow settings changed from the renderer. */
export const refreshTrayMenu = (): void => {
  if (tray && actions) tray.setContextMenu(buildMenu(actions));
};

export const notifyFromTray = (title: string, content: string): void => {
  if (!tray) return;
  try {
    tray.displayBalloon({ iconType: 'info', title, content });
  } catch (err) {
    console.warn('[tray] balloon notification failed', err);
  }
};

export const hasTray = (): boolean => tray !== null;

export const destroyTray = (): void => {
  tray?.destroy();
  tray = null;
};
