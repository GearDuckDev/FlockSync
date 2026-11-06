import type { FastifyPluginAsync } from "fastify";
import {
  OfficerSyncPayloadSchema,
  GuildStateSchema,
  RosterQuerySchema,
  RosterStatusUpdateSchema,
  ServerReturnPayloadSchema
} from "@flocksync/shared-types";
import { listRoster, setCharacterActive } from "../services/roster.service.js";
import { processOfficerSync } from "../services/sync.service.js";
import { purgeCharacter } from "../services/purge.service.js";
import { releaseCatalog } from "../services/releases.service.js";
import { db } from "../db/index.js";
import { guildIdentity } from "../db/schema.js";
import { KillSyncConflict } from "../services/killList.service.js";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.get("/guild", { preHandler: app.authenticate }, async () => {
    const guild = db.select().from(guildIdentity).get();
    return GuildStateSchema.parse({
      guild: guild ? { name: guild.name, realm: guild.realm } : null
    });
  });

  app.post("/sync", {
    onRequest: [app.authenticate, app.requireOfficer],
    bodyLimit: 10 * 1024 * 1024
  }, async (request, reply) => {
    const payload = OfficerSyncPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ error: "Invalid officer sync payload" });
    }
    if (payload.data.collectorGuild
      && payload.data.collectorGuild.realm !== payload.data.officerCharacter.realm) {
      return reply.code(400).send({ error: "Collector guild realm must match the synced character" });
    }
    if (payload.data.sharedKillList?.length && (!payload.data.collectorGuild
      || payload.data.sharedKillList.some((entry) => entry.realm !== payload.data.collectorGuild?.realm
        || entry.updatedAt > Math.floor(Date.now() / 1000) + 30))) {
      return reply.code(400).send({ error: "Shared kills require collector guild identity, matching realm and valid clock" });
    }
    if (payload.data.sharedKillObservations?.length && (!payload.data.collectorGuild
      || payload.data.sharedKillObservations.some((entry) => entry.realm !== payload.data.collectorGuild?.realm
        || entry.timestamp > Math.floor(Date.now() / 1000) + 30))) {
      return reply.code(400).send({ error: "Observations require matching collector guild/realm and valid clock" });
    }

    let result: Awaited<ReturnType<typeof processOfficerSync>>;
    try {
      result = await processOfficerSync(payload.data, request.user.id);
    } catch (error) {
      if (!(error instanceof KillSyncConflict)) throw error;
      request.log.warn({ by: request.user.id, error: error.message }, "Kill-list upload conflict");
      return reply.code(409).send({ error: error.message });
    }
    const addonReleases = releaseCatalog.cachedAddonReleases((error) => {
      app.log.warn({ err: error }, "Addon release metadata unavailable; sync remains successful");
    });
    const helperReleases = payload.data.includeHelperReleases
      ? releaseCatalog.cachedHelperReleases((error) => {
        app.log.warn({ err: error }, "AppHelper release metadata unavailable; sync remains successful");
      }) : undefined;
    return ServerReturnPayloadSchema.parse({
      ...result, ...(addonReleases === undefined ? {} : { addonReleases }),
      ...(payload.data.collectorGuild === undefined ? {} : {
        authorizedCollectorGuild: payload.data.collectorGuild
      }),
      ...(helperReleases === undefined ? {} : { helperReleases })
    });
  });

  app.get("/roster", { preHandler: app.authenticate }, async (request, reply) => {
    const query = RosterQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid roster query" });
    }
    return listRoster(query.data.includeInactive === "true");
  });

  app.delete<{ Params: { guid: string } }>("/roster/:guid", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    if (!purgeCharacter(request.params.guid, request.user.id)) {
      return reply.code(404).send({ error: "Character not found" });
    }
    return reply.code(204).send();
  });

  app.patch<{ Params: { guid: string } }>("/roster/:guid/status", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    const body = RosterStatusUpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Body must be { isActive: boolean }" });
    }
    const updated = setCharacterActive(request.params.guid, body.data.isActive);
    if (!updated) {
      return reply.code(404).send({ error: "Character not found" });
    }
    return updated;
  });
};
