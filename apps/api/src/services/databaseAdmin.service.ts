import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { db, databasePath, sqliteConnection } from "../db/index.js";
import {
  attendance, characters, deletedCharacters, lootHistory, officerTasks,
  playerAliases, raidTeams, themeDefaults, userThemes, guildIdentity
} from "../db/schema.js";
import { migrateDatabase } from "../db/migrate.js";
import {
  listBackupDirectories, listBackupEntries, readDatabaseAdminState,
  resolveBackupDirectory, resolveBackupFile, writeDatabaseAdminState
} from "./databaseAdminState.js";

let operationActive = false;
const runExclusive = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (operationActive) throw new Error("Another database backup or restore is already running");
  operationActive = true;
  try {
    return await operation();
  } finally {
    operationActive = false;
  }
};

const timestamp = (): string => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const backupName = (reason: "manual" | "final" | "pre-restore"): string =>
  `flocksync-${reason === "manual" ? "" : `${reason}-`}${timestamp()}-${randomUUID().slice(0, 8)}.db`;

const checkIntegrity = (path: string): void => {
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

const createBackupUnlocked = async (reason: "manual" | "final" | "pre-restore") => {
  const state = await readDatabaseAdminState();
  const directory = await resolveBackupDirectory(state.backupDirectory, true);
  const filename = backupName(reason);
  const destination = join(directory, filename);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await sqliteConnection.backup(temporary);
    checkIntegrity(temporary);
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

export const createDatabaseBackup = (reason: "manual" | "final" = "manual") =>
  runExclusive(() => createBackupUnlocked(reason));

export const getBackupCatalog = async (directory?: string) => {
  const state = await readDatabaseAdminState();
  const selectedDirectory = directory ?? state.backupDirectory;
  return {
    backupRoot: "/backups",
    selectedDirectory: state.backupDirectory,
    directories: await listBackupDirectories(selectedDirectory),
    backups: await listBackupEntries(selectedDirectory)
  };
};

export const getBackupFile = (relativeDirectory: string, filename: string) =>
  resolveBackupFile(relativeDirectory, filename);

const replaceDatabaseContents = async (sourcePath: string): Promise<void> => {
  const staging = `${databasePath}.restore-${randomUUID()}.db`;
  await mkdir(join(databasePath, ".."), { recursive: true });
  try {
    await copyFile(sourcePath, staging);
    const stagedDb = new Database(staging);
    try {
      migrateDatabase(stagedDb);
    } finally {
      stagedDb.close();
    }
    checkIntegrity(staging);

    sqliteConnection.prepare("ATTACH DATABASE ? AS restore_source").run(staging);
    try {
      const currentTables = sqliteConnection.prepare(
        "SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { name: string }[];
      const sourceTables = sqliteConnection.prepare(
        "SELECT name FROM restore_source.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      ).all() as { name: string }[];
      const names = currentTables.map((table) => table.name);
      if (JSON.stringify(names) !== JSON.stringify(sourceTables.map((table) => table.name))) {
        throw new Error("Selected backup has an incompatible database schema");
      }
      for (const name of names) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Backup contains an invalid table name");
        const columns = (database: "main" | "restore_source") =>
          sqliteConnection.prepare(`PRAGMA ${database}.table_info("${name}")`).all() as { name: string }[];
        if (JSON.stringify(columns("main").map((column) => column.name))
          !== JSON.stringify(columns("restore_source").map((column) => column.name))) {
          throw new Error(`Selected backup schema differs at table ${name}`);
        }
      }
      // Accounts must exist before restoring character/theme foreign keys.
      const restoreOrder = [...names].sort((a, b) =>
        Number(b === "users") - Number(a === "users") || a.localeCompare(b));
      sqliteConnection.transaction(() => {
        sqliteConnection.pragma("defer_foreign_keys = ON");
        for (const name of [...restoreOrder].reverse()) sqliteConnection.exec(`DELETE FROM main."${name}"`);
        for (const name of restoreOrder) {
          sqliteConnection.exec(`INSERT INTO main."${name}" SELECT * FROM restore_source."${name}"`);
        }
      })();
      checkIntegrity(databasePath);
    } finally {
      sqliteConnection.prepare("DETACH DATABASE restore_source").run();
    }
  } finally {
    try {
      await unlink(staging);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
};

export const restoreDatabaseFromFile = (sourcePath: string) => runExclusive(async () => {
  const safetyBackup = await createBackupUnlocked("pre-restore");
  checkIntegrity(sourcePath);
  await replaceDatabaseContents(sourcePath);
  const state = await readDatabaseAdminState();
  const databaseResetAt = Math.max(Math.floor(Date.now() / 1000), state.databaseResetAt + 1);
  await writeDatabaseAdminState({ ...state, databaseResetAt });
  return { backup: safetyBackup, databaseResetAt };
});

export const restoreLatestDatabaseBackup = (relativeDirectory: string, filename: string) =>
  runExclusive(async () => {
    const sourcePath = await resolveBackupFile(relativeDirectory, filename);
    const safetyBackup = await createBackupUnlocked("pre-restore");
    checkIntegrity(sourcePath);
    await replaceDatabaseContents(sourcePath);
    const state = await readDatabaseAdminState();
    const databaseResetAt = Math.max(Math.floor(Date.now() / 1000), state.databaseResetAt + 1);
    await writeDatabaseAdminState({ ...state, databaseResetAt });
    return { backup: safetyBackup, databaseResetAt };
  });

export const setDefaultBackupDirectory = async (relativeDirectory: string): Promise<void> => {
  await resolveBackupDirectory(relativeDirectory);
  const state = await readDatabaseAdminState();
  await writeDatabaseAdminState({ ...state, backupDirectory: relativeDirectory });
};

export const createBackupDirectory = async (relativeDirectory: string): Promise<void> => {
  await resolveBackupDirectory(relativeDirectory, true);
};

export const wipeDatabase = () => runExclusive(async () => {
  const backup = await createBackupUnlocked("final");
  const state = await readDatabaseAdminState();
  const databaseResetAt = Math.max(Math.floor(Date.now() / 1000), state.databaseResetAt + 1);
  const previous = { ...state };
  await writeDatabaseAdminState({ ...state, databaseResetAt });
  try {
    db.transaction((transaction) => {
      transaction.delete(attendance).run();
      transaction.delete(lootHistory).run();
      transaction.delete(officerTasks).run();
      transaction.delete(raidTeams).run();
      transaction.delete(playerAliases).run();
      transaction.delete(deletedCharacters).run();
      transaction.delete(characters).run();
      transaction.delete(userThemes).run();
      transaction.delete(themeDefaults).run();
      transaction.delete(guildIdentity).run();
    });
  } catch (error) {
    await writeDatabaseAdminState(previous);
    throw error;
  }
  return { backup, databaseResetAt };
});
