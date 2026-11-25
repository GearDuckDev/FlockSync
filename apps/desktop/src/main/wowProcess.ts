import { execFile } from 'node:child_process';
import { sep } from 'node:path';
import { normalizeClientRoot } from './discovery';

const TIMEOUT_MS = 15_000;
// Known WoW client executables, plus any process launched from inside the client folder.
const SCRIPT = [
  '$root = $env:FLOCKSYNC_WOW_ROOT',
  '$self = [int]$env:FLOCKSYNC_SELF_PID',
  "$names = @('wow','wowclassic','wow-64','wowt','wowb','wowclassict','wowclassicb')",
  '@(Get-Process | Where-Object { $_.Id -ne $self -and ($names -contains $_.ProcessName.ToLowerInvariant() -or',
  "  ($_.Path -and $_.Path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase))) }).Count",
].join('\n');

/** Resolves true when WoW appears to be running. Detection failures count as running, so nothing is replaced. */
export const isWowRunning = (wowPath: string): Promise<boolean> => {
  if (process.platform !== 'win32') return Promise.resolve(false);
  const root = normalizeClientRoot(wowPath);
  return new Promise((resolvePromise) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
      timeout: TIMEOUT_MS,
      windowsHide: true,
      env: { ...process.env, FLOCKSYNC_WOW_ROOT: root.endsWith(sep) ? root : root + sep, FLOCKSYNC_SELF_PID: String(process.pid) },
    }, (error, stdout) => {
      if (error) {
        console.warn('[addon-updater] WoW process check failed', error.message);
        resolvePromise(true);
        return;
      }
      const count = Number.parseInt(stdout.trim(), 10);
      resolvePromise(!Number.isFinite(count) || count > 0);
    });
  });
};
