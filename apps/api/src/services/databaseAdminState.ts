import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { env } from "../config/env.js";
import { databasePath } from "../db/index.js";

const StateSchema = z.object({
  backupDirectory: z.string().default(""),
  databaseResetAt: z.number().int().nonnegative().default(0)
}).strict();
type State = z.infer<typeof StateSchema>;

const statePath = join(dirname(databasePath), "admin-database-state.json");
const backupRoot = resolve(env.BACKUP_DIRECTORY);

export const readDatabaseAdminState = async (): Promise<State> => {
  try {
    return StateSchema.parse(JSON.parse(await readFile(statePath, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { backupDirectory: "", databaseResetAt: 0 };
    }
    throw new Error("Cannot read the persistent database admin settings", { cause: error });
  }
};

export const writeDatabaseAdminState = async (state: State): Promise<void> => {
  const parsed = StateSchema.parse(state);
  const temporaryState = `${statePath}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(temporaryState, JSON.stringify(parsed), { encoding: "utf8", flag: "wx" });
    await rename(temporaryState, statePath);
  } catch (error) {
    try {
      await unlink(temporaryState);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        throw cleanupError;
      }
    }
    throw new Error("Cannot save the persistent database admin settings", { cause: error });
  }
};

const relativeSegments = (value: string): string[] => {
  if (value === "") return [];
  if (value.includes("\\") || value.startsWith("/") || value.includes("\0")) {
    throw new Error("Backup folders must be selected under the mounted backup root");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/.test(segment)
    || segment === "." || segment === "..")) {
    throw new Error("Backup folder path is invalid");
  }
  return segments;
};

const assertNotSymlink = async (path: string): Promise<void> => {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("Backup folders must be real directories, not links");
  }
};

export const resolveBackupDirectory = async (relativeDirectory: string, create = false): Promise<string> => {
  const segments = relativeSegments(relativeDirectory);
  await assertNotSymlink(backupRoot);
  let current = backupRoot;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      await assertNotSymlink(current);
    } catch (error) {
      if (!create || !(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      await mkdir(current);
      await assertNotSymlink(current);
    }
  }
  const resolved = resolve(current);
  const withinRoot = relative(backupRoot, resolved);
  if (withinRoot.startsWith(`..${sep}`) || withinRoot === "..") {
    throw new Error("Backup folder escapes the mounted backup root");
  }
  return resolved;
};

export const listBackupDirectories = async (relativeDirectory: string): Promise<string[]> => {
  const folder = await resolveBackupDirectory(relativeDirectory);
  const entries = await readdir(folder, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name)
    .sort((a, b) => a.localeCompare(b));
};

export const listBackupEntries = async (relativeDirectory: string) => {
  const folder = await resolveBackupDirectory(relativeDirectory);
  const entries = await readdir(folder, { withFileTypes: true });
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()
      || !/^flocksync-[A-Za-z0-9._-]+\.db$/i.test(entry.name)) continue;
    const info = await stat(join(folder, entry.name));
    backups.push({
      filename: entry.name, relativeDirectory, size: info.size,
      createdAt: Math.floor(info.mtimeMs / 1000)
    });
  }
  return backups.sort((a, b) => b.createdAt - a.createdAt || b.filename.localeCompare(a.filename));
};

export const resolveBackupFile = async (relativeDirectory: string, filename: string): Promise<string> => {
  if (filename !== filename.split(/[\\/]/).at(-1)
    || !/^flocksync-[A-Za-z0-9._-]+\.db$/i.test(filename)) {
    throw new Error("Backup filename is invalid");
  }
  const folder = await resolveBackupDirectory(relativeDirectory);
  const file = join(folder, filename);
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Backup file is invalid");
  return file;
};
