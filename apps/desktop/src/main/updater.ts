import { app, ipcMain, net, type BrowserWindow } from 'electron';
import { z } from 'zod';
import type { UpdateCheckResult, UpdateInfo } from '../shared/ipc';
import { isNewerVersion, stripVersionPrefix } from './versionCompare';

const STARTUP_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

const LatestReleaseSchema = z.object({
  tag_name: z.string().min(1),
  html_url: z.string().url(),
  body: z.string().nullable().optional(),
});

interface UpdaterOptions {
  getWindow: () => BrowserWindow | null;
  getRepo: () => string;
  /** Called once per newly discovered version (e.g. to notify from the tray while hidden). */
  onUpdateFound: (update: UpdateInfo) => void;
}

let updateMutedForSession = false;
let pendingUpdate: UpdateInfo | null = null;
let lastAnnouncedVersion: string | null = null;
let options: UpdaterOptions | null = null;
let timers: NodeJS.Timeout[] = [];

const send = (channel: string, payload: unknown): void => {
  const win = options?.getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

const fetchLatestRelease = async (repo: string): Promise<z.infer<typeof LatestReleaseSchema>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `FlockSync-Desktop/${app.getVersion()}`,
      },
      signal: controller.signal,
    });
    if (res.status === 404) throw new Error(`No published GitHub releases found for ${repo}.`);
    if (res.status === 403 || res.status === 429) throw new Error('GitHub rate limit reached. Try again later.');
    if (!res.ok) throw new Error(`GitHub responded with HTTP ${res.status}.`);
    const parsed = LatestReleaseSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error('GitHub returned an unexpected release format.');
    return parsed.data;
  } finally {
    clearTimeout(timeout);
  }
};

export const getPendingUpdate = (): UpdateInfo | null => (updateMutedForSession ? null : pendingUpdate);

export const checkForUpdates = async (manual = false): Promise<UpdateCheckResult> => {
  if (updateMutedForSession && !manual) return { status: 'skipped' };
  if (!options) return { status: 'error', message: 'Updater is not initialized.' };
  const currentVersion = app.getVersion();
  try {
    const release = await fetchLatestRelease(options.getRepo());
    const version = stripVersionPrefix(release.tag_name);
    if (!isNewerVersion(version, currentVersion)) {
      pendingUpdate = null;
      if (manual) send('update-not-available', currentVersion);
      return { status: 'up-to-date', currentVersion };
    }
    const update: UpdateInfo = { version, url: release.html_url, releaseNotes: release.body ?? '' };
    pendingUpdate = update;
    send('update-available', update);
    if (lastAnnouncedVersion !== version) {
      lastAnnouncedVersion = version;
      options.onUpdateFound(update);
    }
    return { status: 'available', update };
  } catch (err) {
    const message = err instanceof Error && err.name !== 'AbortError' ? err.message : 'Update check timed out.';
    console.warn(`[updater] ${manual ? 'manual' : 'scheduled'} check failed: ${message}`);
    return { status: 'error', message };
  }
};

export const startUpdater = (opts: UpdaterOptions): void => {
  options = opts;
  ipcMain.handle('check-for-updates', () => checkForUpdates(true));
  ipcMain.on('dismiss-update', () => {
    updateMutedForSession = true;
    pendingUpdate = null;
  });
  timers = [
    setTimeout(() => void checkForUpdates(false), STARTUP_DELAY_MS),
    setInterval(() => void checkForUpdates(false), CHECK_INTERVAL_MS),
  ];
};

export const stopUpdater = (): void => {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
};
