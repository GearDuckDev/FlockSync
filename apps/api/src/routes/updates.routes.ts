import type { FastifyPluginAsync } from "fastify";
import {
  compareReleaseVersions, selectLatestRelease, ServerUpdateStatusSchema, UpdateCheckQuerySchema
} from "@flocksync/shared-types";
import { currentServerVersion } from "../config/version.js";
import { releaseCatalog } from "../services/releases.service.js";

export const updatesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/updates/server/version", {
    preHandler: [app.authenticate]
  }, async () => ServerUpdateStatusSchema.pick({ currentVersion: true }).parse({
    currentVersion: currentServerVersion
  }));

  app.get("/updates/server", {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const query = UpdateCheckQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid update channel query" });
    try {
      const latest = selectLatestRelease(await releaseCatalog.list(), "server", query.data.channel);
      return ServerUpdateStatusSchema.parse({
        currentVersion: currentServerVersion,
        channel: query.data.channel,
        latest,
        updateAvailable: latest !== null && compareReleaseVersions(latest.version, currentServerVersion) > 0
      });
    } catch (error) {
      request.log.warn({ err: error }, "Server update check failed");
      return reply.code(503).send({
        error: error instanceof Error ? error.message : "Unable to check server updates; try again later."
      });
    }
  });
};
