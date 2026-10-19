import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import * as schema from "./schema.js";
import { migrateDatabase } from "./migrate.js";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const databasePath = isAbsolute(env.DATABASE_URL)
  ? env.DATABASE_URL
  : resolve(apiRoot, env.DATABASE_URL);

const initializeSqlite = (): Database.Database => {
  try {
    mkdirSync(dirname(databasePath), { recursive: true });
    const connection = new Database(databasePath);
    connection.pragma("journal_mode = WAL;");
    connection.pragma("foreign_keys = ON;");
    connection.pragma("busy_timeout = 5000;");
    try {
      migrateDatabase(connection);
    } catch (error) {
      connection.close();
      throw error;
    }
    return connection;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "sqlite_initialization_failed",
      databasePath,
      message: error instanceof Error ? error.message : "Unknown initialization error"
    }));
    throw new Error(`Failed to initialize SQLite database at ${databasePath}`, {
      cause: error
    });
  }
};

const sqlite = initializeSqlite();

export const db = drizzle(sqlite, { schema });
