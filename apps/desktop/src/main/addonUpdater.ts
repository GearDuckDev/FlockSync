import { app, net } from 'electron';
import { createHash } from 'node:crypto';
import { compareReleaseVersions, ReleaseVersionSchema, type GitHubRelease } from '@flocksync/shared-types';
import type { SyncLogEvent } from '../shared/ipc';
import { loadStored } from './configStore';
import { selectHelperAddonUpdate, type HelperAddonUpdate } from './addonReleaseSelection';
import { HELPER_ADDON, inspectInstalledAddon, installAddonFromZip } from './addonInstaller';
import { isWowRunning } from './wowProcess';

const STARTUP_DELAY_MS = 20_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WOW_RETRY_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export interface AddonUpdaterOptions {
  getReleases: (repo: string) => Promise<GitHubRelease[]>;
  onLog: (event: SyncLogEvent) => void;
  notify: (title: string, body: string) => void;
  isWowRunning?: (wowPath: string) => Promise<boolean>;
}

let options: AddonUpdaterOptions | null = null;
let timers: NodeJS.Timeout[] = [];
let retryTimer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;
let downloaded: { update: HelperAddonUpdate; zip: Buffer } | null = null;
const announced = new Set<string>();

const log = (status: SyncLogEvent['status'], message: string, onceKey?: string): void => {
  if (onceKey) {
    if (announced.has(onceKey)) return;
    announced.add(onceKey);
  }
  console[status === 'ERROR' ? 'warn' : 'info'](`[addon-updater] ${message}`);
  options?.onLog({ timestamp: Date.now(), status, characterCount: 0, message });
};

export const downloadVerifiedBundle = async (update: HelperAddonUpdate): Promise<Buffer> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await net.fetch(update.downloadUrl, {
      headers: { 'User-Agent': `FlockSync-Desktop/${app.getVersion()}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Addon download failed (HTTP ${response.status}).`);
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_DOWNLOAD_BYTES) throw new Error('Addon download exceeds the size limit.');
    const zip = Buffer.from(await response.arrayBuffer());
    if (zip.length > MAX_DOWNLOAD_BYTES) throw new Error('Addon download exceeds the size limit.');
    const actual = createHash('sha256').update(zip).digest('hex');
    if (actual !== update.sha256) throw new Error('Addon download failed its SHA-256 check; nothing was installed.');
    return zip;
  } finally {
    clearTimeout(timeout);
  }
};

const scheduleRetry = (): void => {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void checkHelperAddonUpdate(false);
  }, WOW_RETRY_MS);
};

const runCheck = async (opts: AddonUpdaterOptions, refresh: boolean): Promise<void> => {
  const stored = loadStored();
  const installed = await inspectInstalledAddon(stored.wowPath, HELPER_ADDON);
  if (installed.state === 'missing') return;
  if (installed.state === 'linked') {
    log('SUCCESS', `${HELPER_ADDON} is a linked folder (${installed.path}); automatic addon updates are skipped.`, `linked:${installed.path}`);
    return;
  }
  const version = ReleaseVersionSchema.safeParse(installed.version ?? '');
  if (!version.success) {
    log('ERROR', `Cannot read the installed ${HELPER_ADDON} version; reinstall it from the addon bundle.`, `version:${installed.path}`);
    return;
  }
  // Retries reuse the verified download instead of re-querying GitHub (rate limits).
  let update = refresh ? null : downloaded?.update ?? null;
  if (!update) {
    const releases = await opts.getReleases(stored.githubRepo);
    update = selectHelperAddonUpdate(releases, version.data, stored.updateChannel, stored.githubRepo);
  }
  if (!update || compareReleaseVersions(update.version, version.data) <= 0) {
    downloaded = null;
    return;
  }
  if (downloaded?.update.downloadUrl !== update.downloadUrl || downloaded.update.sha256 !== update.sha256) {
    downloaded = { update, zip: await downloadVerifiedBundle(update) };
  }
  if (await (opts.isWowRunning ?? isWowRunning)(stored.wowPath)) {
    log('SUCCESS', `${HELPER_ADDON} ${update.version} is ready; it will install after World of Warcraft closes.`, `waiting:${update.version}`);
    scheduleRetry();
    return;
  }
  try {
    await installAddonFromZip(stored.wowPath, downloaded.zip, HELPER_ADDON, update.version);
  } catch (error) {
    // Usually files locked by a client we did not detect; try again shortly.
    scheduleRetry();
    throw error;
  }
  downloaded = null;
  log('SUCCESS', `Updated ${HELPER_ADDON} ${version.data} -> ${update.version}. The previous copy is in FlockSync-Updates\\backup.`);
  opts.notify('FlockSync addon updated', `${HELPER_ADDON} was updated to v${update.version}.`);
};

/** Checks for, downloads, and installs a newer AppHelper. Concurrent calls share one run. */
export const checkHelperAddonUpdate = (refresh = true): Promise<void> => {
  const opts = options;
  if (!opts) return Promise.resolve();
  inFlight ??= runCheck(opts, refresh).catch((error: unknown) => {
    const message = error instanceof Error && error.name !== 'AbortError' ? error.message : 'Addon update timed out.';
    log('ERROR', `Automatic ${HELPER_ADDON} update failed: ${message}`, `error:${message}`);
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const startAddonUpdater = (opts: AddonUpdaterOptions): void => {
  options = opts;
  timers = [
    setTimeout(() => void checkHelperAddonUpdate(), STARTUP_DELAY_MS),
    setInterval(() => void checkHelperAddonUpdate(), CHECK_INTERVAL_MS),
  ];
};

export const stopAddonUpdater = (): void => {
  for (const timer of timers) clearTimeout(timer);
  if (retryTimer) clearTimeout(retryTimer);
  timers = [];
  retryTimer = null;
  options = null;
};
