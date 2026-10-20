import { app, ipcMain, net, type BrowserWindow } from 'electron';
import {
  GitHubReleaseListSchema,
  loadReleaseManifests,
  ReleaseVersionSchema,
  type GitHubRelease,
} from '@flocksync/shared-types';
import type { UpdateCheckResult, UpdateInfo } from '../shared/ipc';
import { loadStored } from './configStore';
import { selectDesktopUpdate } from './releaseSelection';

const STARTUP_DELAY_MS = 15_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const RELEASE_CACHE_TTL_MS = 5 * 60 * 1000;
const RELEASE_FAILURE_TTL_MS = 30 * 1000;
const MAX_RELEASE_PAGES = 20;

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
let checkGeneration = 0;
let releaseCache: { repo: string; releases: GitHubRelease[]; expiresAt: number } | null = null;
const releaseRequests = new Map<string, Promise<GitHubRelease[]>>();
const releaseFailures = new Map<string, { error: Error; expiresAt: number }>();

const send = (channel: string, payload: unknown): void => {
  const win = options?.getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
};

const githubFailure = (status: number, repo: string, response: Response): Error => {
  if (status === 404 || status === 401) {
    return new Error(`GitHub repository ${repo} is private or does not exist.`);
  }
  if (status === 403 || status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const retryAfter = response.headers.get('retry-after');
    if (status === 429 || remaining === '0' || retryAfter !== null) {
      const retry = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
      return new Error(`GitHub rate limit reached.${retry}`);
    }
    return new Error(`GitHub denied access to ${repo}; check repository visibility and API access.`);
  }
  return new Error(`GitHub responded with HTTP ${status}.`);
};

const fetchGitHubReleases = async (repo: string): Promise<GitHubRelease[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const releases: GitHubRelease[] = [];
    for (let page = 1; page <= MAX_RELEASE_PAGES; page++) {
      const url = new URL(`https://api.github.com/repos/${repo}/releases`);
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      const res = await net.fetch(url.toString(), {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `FlockSync-Desktop/${app.getVersion()}`,
        },
        signal: controller.signal,
      });
      if (!res.ok) throw githubFailure(res.status, repo, res);
      const parsed = GitHubReleaseListSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error('GitHub returned an unexpected release list format.');
      releases.push(...parsed.data);
      const hasNextPage = /(?:^|,)\s*<[^>]+>\s*;\s*rel="?next"?/i.test(res.headers.get('link') ?? '');
      if (!hasNextPage) {
        return await loadReleaseManifests(releases, repo,
          (input, init) => net.fetch(input instanceof URL ? input.toString() : input, init),
          controller.signal);
      }
      if (page === MAX_RELEASE_PAGES) {
        throw new Error(`GitHub release list exceeds ${MAX_RELEASE_PAGES} pages; update check was not completed.`);
      }
    }
    throw new Error('GitHub release list pagination did not complete.');
  } finally {
    clearTimeout(timeout);
  }
};

const getGitHubReleases = (repo: string): Promise<GitHubRelease[]> => {
  if (releaseCache?.repo === repo && releaseCache.expiresAt > Date.now()) {
    return Promise.resolve(releaseCache.releases);
  }
  const failure = releaseFailures.get(repo);
  if (failure && failure.expiresAt > Date.now()) return Promise.reject(failure.error);
  releaseFailures.delete(repo);
  const inFlight = releaseRequests.get(repo);
  if (inFlight) return inFlight;
  const promise = fetchGitHubReleases(repo).then((releases) => {
    if (releases.length === 0) throw new Error(`No published GitHub releases found for ${repo}.`);
    releaseCache = { repo, releases, expiresAt: Date.now() + RELEASE_CACHE_TTL_MS };
    releaseFailures.delete(repo);
    return releases;
  }).catch((error: unknown) => {
    const failureError = error instanceof Error ? error : new Error(String(error));
    releaseFailures.set(repo, { error: failureError, expiresAt: Date.now() + RELEASE_FAILURE_TTL_MS });
    throw failureError;
  }).finally(() => {
    if (releaseRequests.get(repo) === promise) releaseRequests.delete(repo);
  });
  releaseRequests.set(repo, promise);
  return promise;
};

export const getPendingUpdate = (): UpdateInfo | null => {
  if (updateMutedForSession || !pendingUpdate) return null;
  const channel = loadStored().updateChannel;
  if (channel === 'release' && pendingUpdate.channel !== 'release') return null;
  if (channel === 'beta' && pendingUpdate.channel === 'alpha') return null;
  return pendingUpdate;
};

export const resetUpdateChannel = (): void => {
  checkGeneration++;
  pendingUpdate = null;
  send('update-not-available', app.getVersion());
};

export const checkForUpdates = async (manual = false): Promise<UpdateCheckResult> => {
  if (updateMutedForSession && !manual) return { status: 'skipped' };
  if (!options) return { status: 'error', message: 'Updater is not initialized.' };
  const generation = checkGeneration;
  const currentVersion = app.getVersion();
  try {
    const currentReleaseVersion = currentVersion.replace(/^v/i, '');
    if (!ReleaseVersionSchema.safeParse(currentReleaseVersion).success) {
      throw new Error(`Installed version ${currentVersion} is not a valid release version.`);
    }
    const stored = loadStored();
    const releases = await getGitHubReleases(options.getRepo());
    if (generation !== checkGeneration || stored.updateChannel !== loadStored().updateChannel) {
      return { status: 'skipped' };
    }
    const update = selectDesktopUpdate(releases, currentReleaseVersion, stored.updateChannel);
    if (!update) {
      pendingUpdate = null;
      if (manual) send('update-not-available', currentVersion);
      return { status: 'up-to-date', currentVersion };
    }
    pendingUpdate = update;
    send('update-available', update);
    if (lastAnnouncedVersion !== update.version) {
      lastAnnouncedVersion = update.version;
      options.onUpdateFound(update);
    }
    return { status: 'available', update };
  } catch (err) {
    if (generation !== checkGeneration) return { status: 'skipped' };
    const message = err instanceof Error && err.name !== 'AbortError' ? err.message : 'Update check timed out.';
    console.warn(`[updater] ${manual ? 'manual' : 'scheduled'} check failed: ${message}`);
    return { status: 'error', message };
  }
};

export const startUpdater = (opts: UpdaterOptions): void => {
  options = opts;
  ipcMain.handle('check-for-updates', () => checkForUpdates(true));
  ipcMain.on('dismiss-update', () => {
    checkGeneration++;
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
