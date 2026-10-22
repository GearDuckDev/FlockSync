import { app } from 'electron';
import type { AppSettings } from '../shared/ipc';
import { loadStored, toAppSettings, updateStored } from './configStore';

export const HIDDEN_LAUNCH_ARG = '--hidden';

type SettingsListener = (settings: AppSettings) => void;
const listeners = new Set<SettingsListener>();

// The portable build runs from a temp extraction dir; register the real .exe instead.
const loginItemPath = (): string => process.env['PORTABLE_EXECUTABLE_FILE'] ?? process.execPath;

export const isLaunchedHidden = (): boolean => {
  return loadStored().startMinimized || process.argv.includes(HIDDEN_LAUNCH_ARG);
};

export const applyStartOnBoot = (enabled: boolean): void => {
  if (!app.isPackaged) {
    console.info(`[startup] dev build: skipping login item registration (startOnBoot=${String(enabled)})`);
    return;
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: loginItemPath(),
      args: [],
    });
  } catch (err) {
    console.error('[startup] failed to update login item settings', err);
  }
};

export const getAppSettings = (): AppSettings => toAppSettings(loadStored());

export const saveAppSettings = (patch: Partial<AppSettings>): AppSettings => {
  const previous = getAppSettings();
  const next = toAppSettings(updateStored(patch));
  if (next.startOnBoot !== previous.startOnBoot) applyStartOnBoot(next.startOnBoot);
  for (const listener of listeners) listener(next);
  return next;
};

export const onAppSettingsChanged = (listener: SettingsListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
