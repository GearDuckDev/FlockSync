import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalizeClientRoot } from './discovery';
import { readZipEntries } from './zipReader';

export const HELPER_ADDON = 'FlockSync_AppHelper';
/** Staging and backups live beside Interface (same volume, outside AddOns so WoW never loads them). */
export const UPDATE_WORK_DIR = 'FlockSync-Updates';

export type InstalledAddon =
  | { state: 'missing' }
  | { state: 'linked'; path: string }
  | { state: 'installed'; path: string; version: string | null };

export const addonsDirFor = (wowPath: string): string =>
  join(normalizeClientRoot(wowPath), 'Interface', 'AddOns');

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const parseTocVersion = (toc: string): string | null =>
  /^##\s*Version:\s*(\S+)\s*$/m.exec(toc)?.[1] ?? null;

export const inspectInstalledAddon = async (wowPath: string, name: string): Promise<InstalledAddon> => {
  const path = join(addonsDirFor(wowPath), name);
  try {
    const info = await lstat(path);
    // Node reports Windows junctions as symbolic links; developer links must never be replaced.
    if (info.isSymbolicLink()) return { state: 'linked', path };
    if (!info.isDirectory()) return { state: 'missing' };
  } catch (error) {
    if (isMissing(error)) return { state: 'missing' };
    throw error;
  }
  try {
    return { state: 'installed', path, version: parseTocVersion(await readFile(join(path, `${name}.toc`), 'utf8')) };
  } catch (error) {
    if (isMissing(error)) return { state: 'installed', path, version: null };
    throw error;
  }
};

/** Returns the path segments below the addon folder, or null for directory entries. Throws on unsafe paths. */
const safeSegments = (entryPath: string, name: string): string[] | null => {
  const segments = entryPath.replace(/\\/g, '/').split('/');
  if (segments[0] !== name) throw new Error(`Unexpected archive entry ${entryPath}.`);
  const rest = segments.slice(1);
  if (rest.length === 0 || rest[rest.length - 1] === '') {
    rest.pop();
    if (rest.some((part) => part === '')) throw new Error(`Unsafe archive path ${entryPath}.`);
    return null;
  }
  for (const part of rest) {
    if (part === '' || part === '.' || part === '..' || /[<>:"|?*\u0000-\u001f]/.test(part)) {
      throw new Error(`Unsafe archive path ${entryPath}.`);
    }
  }
  return rest;
};

const extractAddon = async (zip: Buffer, name: string, staging: string): Promise<void> => {
  const root = resolve(staging, name);
  let files = 0;
  for (const entry of readZipEntries(zip)) {
    const top = entry.path.replace(/\\/g, '/').split('/')[0];
    if (top !== name) continue;
    const segments = safeSegments(entry.path, name);
    if (!segments) continue;
    const destination = resolve(root, ...segments);
    if (!destination.startsWith(root + sep)) throw new Error(`Unsafe archive path ${entry.path}.`);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, entry.data, { flag: 'wx' });
    files++;
  }
  if (files === 0) throw new Error(`The update archive does not contain ${name}.`);
};

/**
 * Replaces an installed, non-linked addon folder with the archive copy.
 * The previous folder is kept in FlockSync-Updates\backup and restored if the swap fails.
 */
export const installAddonFromZip = async (
  wowPath: string, zip: Buffer, name: string, expectedVersion: string,
): Promise<void> => {
  const workDir = join(normalizeClientRoot(wowPath), UPDATE_WORK_DIR);
  const staging = join(workDir, `staging-${randomUUID()}`);
  const backupRoot = join(workDir, 'backup');
  const backup = join(backupRoot, name);
  await mkdir(staging, { recursive: true });
  try {
    await extractAddon(zip, name, staging);
    const staged = join(staging, name);
    const stagedVersion = parseTocVersion(await readFile(join(staged, `${name}.toc`), 'utf8'));
    if (stagedVersion !== expectedVersion) {
      throw new Error(`Archive ${name} version ${stagedVersion ?? 'unknown'} does not match release ${expectedVersion}.`);
    }
    const installed = await inspectInstalledAddon(wowPath, name);
    if (installed.state !== 'installed') throw new Error(`${name} is no longer a regular installed folder.`);
    await rm(backup, { recursive: true, force: true });
    await mkdir(backupRoot, { recursive: true });
    await rename(installed.path, backup);
    try {
      await rename(staged, installed.path);
    } catch (error) {
      await rename(backup, installed.path);
      throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
};
