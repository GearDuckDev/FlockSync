import type { AuthUser, ReleaseInfo, UpdateChannel } from '@flocksync/shared-types';

export const DEFAULT_API_URL = '';
export const DEFAULT_WOW_PATH = 'C:\\Program Files (x86)\\World of Warcraft\\_classic_beta_';

export interface AppConfig {
  apiBaseUrl: string;
  wowPath: string;
}

export interface SyncLogEvent {
  timestamp: number;
  status: 'SUCCESS' | 'ERROR';
  characterCount: number;
  message: string;
}

export interface WatcherStatus {
  running: boolean;
  files: string[];
}

export interface ConfigState {
  config: AppConfig;
  user: AuthUser | null;
  status: WatcherStatus;
}

export type LoginResult = { ok: true; user: AuthUser } | { ok: false; error: string };

export interface AppSettings {
  minimizeToTray: boolean;
  startOnBoot: boolean;
  updateChannel: UpdateChannel;
}

export type UpdateInfo = ReleaseInfo;

export interface AppSettingsState {
  settings: AppSettings;
  appVersion: string;
  /** Update found earlier this session and not dismissed, so a reopened window can show it. */
  pendingUpdate: UpdateInfo | null;
}

export type UpdateCheckResult =
  | { status: 'available'; update: UpdateInfo }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'error'; message: string }
  | { status: 'skipped' };

export interface FlockSyncApi {
  login(apiBaseUrl: string, email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  getConfig(): Promise<ConfigState>;
  saveConfig(config: AppConfig): Promise<ConfigState>;
  selectWowFolder(): Promise<string | null>;
  triggerManualSync(): Promise<void>;
  onSyncLog(callback: (event: SyncLogEvent) => void): () => void;
  onStatus(callback: (status: WatcherStatus) => void): () => void;
  getAppSettings(): Promise<AppSettingsState>;
  saveAppSettings(settings: AppSettings): Promise<AppSettingsState>;
  onAppSettings(callback: (settings: AppSettings) => void): () => void;
  /** Manual check: bypasses the session mute and always reports a result. */
  checkForUpdates(): Promise<UpdateCheckResult>;
  dismissUpdate(): void;
  onUpdateAvailable(callback: (update: UpdateInfo) => void): () => void;
  onUpdateNotAvailable(callback: (currentVersion: string) => void): () => void;
  openExternalUrl(url: string): Promise<void>;
}
