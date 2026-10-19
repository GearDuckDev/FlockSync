import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { AppSettings, FlockSyncApi, SyncLogEvent, UpdateInfo, WatcherStatus } from '../shared/ipc';

const subscribe = <T>(channel: string, cb: (payload: T) => void): (() => void) => {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const api: FlockSyncApi = {
  login: (apiBaseUrl, email, password) => ipcRenderer.invoke('login', apiBaseUrl, email, password),
  logout: () => ipcRenderer.invoke('logout'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectWowFolder: () => ipcRenderer.invoke('select-wow-folder'),
  triggerManualSync: () => ipcRenderer.invoke('manual-sync'),
  onSyncLog: (cb) => subscribe<SyncLogEvent>('sync-log', cb),
  onStatus: (cb) => subscribe<WatcherStatus>('watcher-status', cb),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  onAppSettings: (cb) => subscribe<AppSettings>('app-settings-changed', cb),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  dismissUpdate: () => ipcRenderer.send('dismiss-update'),
  onUpdateAvailable: (cb) => subscribe<UpdateInfo>('update-available', cb),
  onUpdateNotAvailable: (cb) => subscribe<string>('update-not-available', cb),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external', url),
};

contextBridge.exposeInMainWorld('flocksync', api);
