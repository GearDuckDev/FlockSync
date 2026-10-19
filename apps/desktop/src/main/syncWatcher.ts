import chokidar, { type FSWatcher } from 'chokidar';
import { discoverSavedVariableFiles, discoverSavedVariablesDirs, isFlockSyncFile } from './discovery';
import { syncFile, type SyncContext } from './syncService';
import type { SyncLogEvent, WatcherStatus } from '../shared/ipc';
import { initializeOfficerHelpers } from './helperBootstrap';

type Listener = { onLog: (e: SyncLogEvent) => void; onStatus: (s: WatcherStatus) => void };

export class SyncWatcher {
  private watcher: FSWatcher | null = null;
  private wowPath = '';
  private ctx: SyncContext | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly listener: Listener) {}

  status(): WatcherStatus {
    return { running: this.watcher !== null, files: this.wowPath ? discoverSavedVariableFiles(this.wowPath) : [] };
  }

  async start(wowPath: string, ctx: SyncContext): Promise<void> {
    await this.stop();
    this.wowPath = wowPath;
    this.ctx = ctx;
    if (ctx.isAuthorizedOfficer === true) {
      await initializeOfficerHelpers(wowPath, this.listener.onLog);
    }
    const dirs = discoverSavedVariablesDirs(wowPath);
    if (dirs.length > 0) {
      try {
        const watcher = chokidar.watch(dirs, {
          depth: 0,
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
        });
        const handle = (file: string): void => {
          if (isFlockSyncFile(file)) void this.enqueue(file);
        };
        watcher.on('add', handle).on('change', handle);
        watcher.on('error', (err) => this.emitError(`Watcher error: ${String(err)}`));
        this.watcher = watcher;
      } catch (err) {
        this.emitError(`Failed to start watcher: ${String(err)}`);
      }
    } else {
      this.emitError('No WTF/Account/*/SavedVariables folders found. Check the WoW client path.');
    }
    this.listener.onStatus(this.status());
  }

  async stop(): Promise<void> {
    const w = this.watcher;
    this.watcher = null;
    this.ctx = null;
    if (w) await w.close();
    this.listener.onStatus(this.status());
  }

  async syncAll(): Promise<void> {
    if (!this.ctx) return this.emitError('Not logged in.');
    const files = discoverSavedVariableFiles(this.wowPath);
    if (files.length === 0) return this.emitError('No FlockSync.lua files found. Log in to WoW and /reload first.');
    for (const f of files) await this.enqueue(f);
  }

  private enqueue(file: string): Promise<unknown> {
    this.queue = this.queue.then(async () => {
      if (!this.ctx) return;
      this.listener.onLog(await syncFile(file, this.ctx));
    });
    return this.queue;
  }

  private emitError(message: string): void {
    this.listener.onLog({ timestamp: Date.now(), status: 'ERROR', characterCount: 0, message });
  }
}
