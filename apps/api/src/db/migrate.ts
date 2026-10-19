import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ColumnListSchema = z.array(z.object({ name: z.string() }));

// Adopt databases previously managed with db:push, without losing existing rows.
const legacyColumns = {
  characters: {
    main_character_name: "text",
    availability_json: "text NOT NULL DEFAULT 'null'",
    availability_updated_at: "integer NOT NULL DEFAULT 0",
    lockouts_json: "text NOT NULL DEFAULT 'null'",
    lockouts_updated_at: "integer NOT NULL DEFAULT 0",
    professions_json: "text NOT NULL DEFAULT 'null'",
    professions_updated_at: "integer NOT NULL DEFAULT 0",
    gear_goals_json: "text NOT NULL DEFAULT 'null'",
    gear_goals_updated_at: "integer NOT NULL DEFAULT 0",
    attunements_json: "text NOT NULL DEFAULT 'null'",
    attunements_updated_at: "integer NOT NULL DEFAULT 0"
  },
  raid_teams: { team_type: "text NOT NULL DEFAULT 'RAID'" }
};

export const migrateDatabase = (connection: Database.Database): void => {
  const folder = fileURLToPath(new URL("../../drizzle", import.meta.url));
  try {
    connection.transaction(() => {
      for (const [table, definitions] of Object.entries(legacyColumns)) {
        const columns = ColumnListSchema.parse(connection.pragma(`table_info("${table}")`));
        if (columns.length === 0) continue;
        const existing = new Set(columns.map((column) => column.name));
        for (const [name, definition] of Object.entries(definitions)) {
          if (!existing.has(name)) {
            // Identifiers and definitions come only from the fixed list above.
            connection.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
          }
        }
      }
    })();
    migrate(drizzle(connection), { migrationsFolder: folder });
    console.info(JSON.stringify({ level: "info", event: "sqlite_migrations_applied" }));
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "sqlite_migration_failed",
      message: error instanceof Error ? error.message : String(error)
    }));
    throw error;
  }
};
