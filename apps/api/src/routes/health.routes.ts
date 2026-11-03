import { sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { BackupHealthSchema } from "@flocksync/shared-types";
import { db } from "../db/index.js";
import { readBackupHealth } from "../services/backupHealth.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return { status: "ok" };
  });
  app.get("/ready", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      db.get(sql`SELECT name FROM sqlite_schema LIMIT 1`);
      return { status: "ok" };
    } catch (error) {
      app.log.error({ event: "readiness_failed", err: error }, "SQLite readiness check failed");
      return reply.code(503).send({ status: "unavailable" });
    }
  });
  app.get("/api/admin/health", {
    preHandler: [app.authenticate, app.requireAdmin],
    config: { rateLimit: { max: 6, timeWindow: 60_000 } }
  }, async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    try {
      const backup = await readBackupHealth();
      if (backup.status !== "healthy") {
        app.log.warn({ event: "backup_health_degraded", status: backup.status }, "Backup requires operator attention");
      }
      return BackupHealthSchema.parse(backup);
    } catch (error) {
      app.log.error({ event: "backup_health_unavailable", err: error }, "Cannot verify backup health");
      return reply.code(503).send(BackupHealthSchema.parse({
        status: "unavailable", lastVerifiedAt: null, lastAttemptAt: null,
        staleAfterSeconds: 36 * 60 * 60
      }));
    }
  });
};
