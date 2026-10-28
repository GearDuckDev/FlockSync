import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  BackupCatalogSchema, BackupDirectoryRequestSchema, DatabaseAdminResultSchema,
  RestoreBackupRequestSchema
} from "@flocksync/shared-types";
import { databasePath } from "../db/index.js";
import {
  createDatabaseBackup, getBackupCatalog, getBackupFile, restoreDatabaseFromFile,
  restoreLatestDatabaseBackup, setDefaultBackupDirectory, createBackupDirectory, wipeDatabase
} from "../services/databaseAdmin.service.js";
import { readDatabaseAdminState } from "../services/databaseAdminState.js";

const adminOnly = (app: FastifyInstance) => [app.authenticate, app.requireAdmin];
const uploadLimit = 128 * 1024 * 1024;
const parseDirectory = (value: unknown) => BackupDirectoryRequestSchema.safeParse(value);

const backupCatalogError = (error: unknown): string => {
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code : undefined;
  if (code === "ENOENT" || code === "ENOTDIR") {
    return "The selected backup folder no longer exists. Choose a valid folder using Backup folder.";
  }
  if (code === "EACCES" || code === "EPERM") {
    return "The API cannot access the backup folder. Check the backup storage mount and folder permissions.";
  }
  return "Cannot list backups in the selected server folder. Check the API logs and backup mount.";
};

export const databaseAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/database", { preHandler: adminOnly(app) }, async (request, reply) => {
    try {
      const directory = typeof request.query === "object" && request.query !== null
        && "directory" in request.query && typeof request.query.directory === "string"
        ? request.query.directory : undefined;
      return BackupCatalogSchema.parse(await getBackupCatalog(directory));
    } catch (error) {
      request.log.error({ err: error }, "Failed to list database backups");
      return reply.code(400).send({ error: backupCatalogError(error) });
    }
  });

  app.put("/database/location", { preHandler: adminOnly(app) }, async (request, reply) => {
    const body = parseDirectory(request.body);
    if (!body.success) return reply.code(400).send({ error: "Select a valid folder under the mounted backup directory." });
    try {
      await setDefaultBackupDirectory(body.data.relativeDirectory);
      return BackupCatalogSchema.parse(await getBackupCatalog());
    } catch (error) {
      request.log.error({ err: error }, "Failed to update backup folder");
      return reply.code(400).send({ error: "The selected folder is unavailable under the mounted backup directory." });
    }
  });

  app.post("/database/directories", { preHandler: adminOnly(app) }, async (request, reply) => {
    const body = parseDirectory(request.body);
    if (!body.success || body.data.relativeDirectory.length === 0) {
      return reply.code(400).send({ error: "Enter a folder path under the mounted backup directory." });
    }
    try {
      await createBackupDirectory(body.data.relativeDirectory);
      return BackupCatalogSchema.parse(await getBackupCatalog(body.data.relativeDirectory));
    } catch (error) {
      request.log.error({ err: error }, "Failed to create backup folder");
      return reply.code(400).send({ error: "Could not create that folder under the mounted backup directory." });
    }
  });

  app.post("/database/backup", { preHandler: adminOnly(app) }, async (request, reply) => {
    try {
      const backup = await createDatabaseBackup();
      const state = await readDatabaseAdminState();
      request.log.info({ filename: backup.filename, by: request.user.id }, "Admin created database backup");
      return DatabaseAdminResultSchema.parse({ backup, databaseResetAt: state.databaseResetAt });
    } catch (error) {
      request.log.error({ err: error, by: request.user.id }, "Database backup failed");
      return reply.code(500).send({ error: "Database backup failed. Check that the configured backup volume is mounted and writable." });
    }
  });

  app.get<{ Params: { filename: string }; Querystring: { directory?: string } }>(
    "/database/backups/:filename/download", { preHandler: adminOnly(app) }, async (request, reply) => {
      try {
        const file = await getBackupFile(request.query.directory ?? "", request.params.filename);
        return reply.type("application/vnd.sqlite3")
          .header("content-disposition", `attachment; filename="${request.params.filename}"`)
          .send(createReadStream(file));
      } catch (error) {
        request.log.error({ err: error }, "Failed to download database backup");
        return reply.code(404).send({ error: "The requested backup is not available." });
      }
    }
  );

  app.post("/database/restore", { preHandler: adminOnly(app) }, async (request, reply) => {
    const parsed = RestoreBackupRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Choose a valid backup to restore." });
    try {
      const catalog = await getBackupCatalog(parsed.data.relativeDirectory);
      const chosen = parsed.data.filename
        ? catalog.backups.find((backup) => backup.filename === parsed.data.filename)
        : catalog.backups[0];
      if (!chosen) return reply.code(404).send({ error: "No backup is available in the selected folder." });
      const result = await restoreLatestDatabaseBackup(chosen.relativeDirectory, chosen.filename);
      request.log.warn({ filename: chosen.filename, by: request.user.id }, "Admin restored database backup");
      return DatabaseAdminResultSchema.parse(result);
    } catch (error) {
      request.log.error({ err: error, by: request.user.id }, "Database restore failed");
      return reply.code(500).send({ error: "Database restore failed. The current database was preserved; verify the selected backup." });
    }
  });

  app.post<{ Body: Buffer }>("/database/restore-upload", {
    onRequest: adminOnly(app), bodyLimit: uploadLimit
  }, async (request: FastifyRequest<{ Body: Buffer }>, reply) => {
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      return reply.code(400).send({ error: "Choose a non-empty SQLite backup file." });
    }
    const temporary = join(dirname(databasePath), `.restore-upload-${randomUUID()}.db`);
    try {
      await writeFile(temporary, request.body, { flag: "wx" });
      const result = await restoreDatabaseFromFile(temporary);
      request.log.warn({ size: request.body.length, by: request.user.id }, "Admin restored uploaded database");
      return DatabaseAdminResultSchema.parse(result);
    } catch (error) {
      request.log.error({ err: error, by: request.user.id }, "Uploaded database restore failed");
      return reply.code(400).send({ error: "Restore failed. Choose a valid FlockSync SQLite backup no larger than 128 MB." });
    } finally {
      try {
        await unlink(temporary);
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
          request.log.error({ err: error }, "Failed to remove temporary restore upload");
        }
      }
    }
  });

  app.post("/database/wipe", { preHandler: adminOnly(app) }, async (request, reply) => {
    try {
      const result = await wipeDatabase();
      request.log.warn({ backup: result.backup.filename, by: request.user.id }, "Admin wiped guild database");
      return DatabaseAdminResultSchema.parse(result);
    } catch (error) {
      request.log.error({ err: error, by: request.user.id }, "Database wipe failed");
      return reply.code(500).send({ error: "Database wipe failed. The pre-wipe backup was retained if it completed." });
    }
  });
};
