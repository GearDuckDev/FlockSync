import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

/** Accepts the client root or an Interface\AddOns (or deeper Interface) path and returns the client root. */
export const normalizeClientRoot = (input: string): string => {
  const parts = resolve(input.trim()).split(sep);
  const idx = parts.findIndex((p) => p.toLowerCase() === 'interface');
  if (idx > 0) return parts.slice(0, idx).join(sep);
  const wtf = parts.findIndex((p) => p.toLowerCase() === 'wtf');
  if (wtf > 0) return parts.slice(0, wtf).join(sep);
  return parts.join(sep);
};

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

export const discoverSavedVariablesDirs = (wowPath: string): string[] => {
  const accountRoot = join(normalizeClientRoot(wowPath), 'WTF', 'Account');
  if (!isDir(accountRoot)) return [];
  try {
    return readdirSync(accountRoot)
      .map((account) => join(accountRoot, account, 'SavedVariables'))
      .filter(isDir);
  } catch (err) {
    console.error('[discovery] failed to read account folders', err);
    return [];
  }
};

export const SAVED_VARIABLES_FILE = 'FlockSync.lua';
export const HELPER_FILE = 'FlockSync_AppHelper.lua';

export const discoverSavedVariableFiles = (wowPath: string): string[] =>
  discoverSavedVariablesDirs(wowPath)
    .map((dir) => join(dir, SAVED_VARIABLES_FILE))
    .filter((f) => existsSync(f));

export const helperPathFor = (savedVarsFile: string): string => join(dirname(savedVarsFile), HELPER_FILE);

export const isFlockSyncFile = (file: string): boolean => basename(file).toLowerCase() === SAVED_VARIABLES_FILE.toLowerCase();
