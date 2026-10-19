import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./src/config/env.js";

const apiRoot = fileURLToPath(new URL(".", import.meta.url));
const databasePath = resolve(apiRoot, env.DATABASE_URL);

try {
  mkdirSync(dirname(databasePath), { recursive: true });
} catch (error) {
  throw new Error(`Unable to create SQLite database directory: ${dirname(databasePath)}`, {
    cause: error
  });
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: databasePath }
});
