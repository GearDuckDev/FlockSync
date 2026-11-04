import { randomUUID } from "node:crypto";
import { chmod, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { sqliteConnection } from "../db/index.js";
import { recordBackupFailure, recordVerifiedBackup } from "./backupHealth.js";
import { listBackupEntries, readDatabaseAdminState, resolveBackupDirectory } from "./databaseAdminState.js";

const timestamp = (): string => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const backupName = (reason: "manual" | "final" | "pre-restore"): string =>
  `flocksync-${reason === "manual" ? "" : `${reason}-`}${timestamp()}-${randomUUID().slice(0, 8)}.db`;

export const checkIntegrity = (path: string): void => {
  const source = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const result = source.pragma("quick_check") as unknown;
    if (!Array.isArray(result) || result.length !== 1
      || typeof result[0] !== "object" || result[0] === null
      || !("quick_check" in result[0]) || result[0].quick_check !== "ok") {
      throw new Error("SQLite backup integrity check failed");
    }
    const violations = source.pragma("foreign_key_check") as unknown[];
    if (violations.length > 0) throw new Error("SQLite backup contains foreign-key violations");
  } finally {
    source.close();
  }
};

const createBackupSnapshot = async (reason: "manual" | "final" | "pre-restore") => {
  const state = await readDatabaseAdminState();
  const directory = await resolveBackupDirectory(state.backupDirectory, true);
  const filename = backupName(reason);
  const destination = join(directory, filename);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await sqliteConnection.backup(temporary);
    checkIntegrity(temporary);
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
  } catch (error) {
    try {
      await unlink(temporary);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        throw cleanupError;
      }
    }
    throw new Error("Database backup failed; existing backups were left unchanged", { cause: error });
  }
  const [backup] = await listBackupEntries(state.backupDirectory)
    .then((entries) => entries.filter((entry) => entry.filename === filename));
  if (!backup) throw new Error("Backup was written but could not be verified in the backup directory");
  return backup;
};

// Callers hold the database-admin operation lock, including pre-restore/wipe backups.
export const createBackupUnlocked = async (reason: "manual" | "final" | "pre-restore") => {
  try {
    const backup = await createBackupSnapshot(reason);
    await recordVerifiedBackup(backup);
    console.info(JSON.stringify({ event: "backup_verified", source: "api" }));
    return backup;
  } catch (error) {
    console.error(JSON.stringify({ event: "backup_failed", source: "api" }));
    try { await recordBackupFailure(); } catch (recordError) {
      console.error(JSON.stringify({
        event: "backup_evidence_write_failed",
        message: recordError instanceof Error ? recordError.message : "Unknown evidence error"
      }));
    }
    throw error;
  }
};
