import type { FastifyPluginAsync } from "fastify";
import {
  OfficerSyncPayloadSchema,
  RosterQuerySchema,
  RosterStatusUpdateSchema,
  ServerReturnPayloadSchema
} from "@flocksync/shared-types";
import { listRoster, setCharacterActive } from "../services/roster.service.js";
import { processOfficerSync } from "../services/sync.service.js";
import { purgeCharacter } from "../services/purge.service.js";
import { releaseCatalog } from "../services/releases.service.js";

export const syncRoutes: FastifyPluginAsync = async (app) => {
  app.post("/sync", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    const payload = OfficerSyncPayloadSchema.safeParse(request.body);
    if (!payload.success) {
      return reply.code(400).send({ error: "Invalid officer sync payload" });
    }

    const result = processOfficerSync(payload.data, request.user.id);
    const addonReleases = releaseCatalog.cachedAddonReleases((error) => {
      app.log.warn({ err: error }, "Addon release metadata unavailable; sync remains successful");
    });
    return ServerReturnPayloadSchema.parse({
      ...result, ...(addonReleases === undefined ? {} : { addonReleases })
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
    if (!purgeCharacter(request.params.guid)) {
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
