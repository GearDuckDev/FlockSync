import type { FastifyPluginAsync } from "fastify";
import { SetCharacterOwnerSchema, SetGroupOwnerSchema } from "@flocksync/shared-types";
import { setGroupOwner } from "../services/groupOwnership.service.js";
import {
  getCharacterOwnershipCatalog, listOwnCharacters, setCharacterOwner
} from "../services/characterOwnership.service.js";

export const characterOwnershipRoutes: FastifyPluginAsync = async (app) => {
  const officerOnly = [app.authenticate, app.requireOfficer];
  app.get("/character-ownership/mine", { preHandler: app.authenticate },
    async (request) => listOwnCharacters(request.user.id));
  app.get("/character-ownership", { preHandler: officerOnly }, async () => getCharacterOwnershipCatalog());
  app.put("/character-ownership/group", { preHandler: officerOnly }, async (request, reply) => {
    const input = SetGroupOwnerSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "Invalid group ownership change" });
    const result = setGroupOwner(input.data, request.user.id);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ groupKey: input.data.groupKey, by: request.user.id }, "Verified group ownership changed");
    return getCharacterOwnershipCatalog();
  });
  app.put<{ Params: { guid: string } }>("/character-ownership/:guid", {
    preHandler: officerOnly
  }, async (request, reply) => {
    const input = SetCharacterOwnerSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "Invalid ownership change or unexpected fields" });
    const result = setCharacterOwner(request.params.guid, input.data, request.user.id);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({
      characterGuid: request.params.guid, userId: input.data.userId, by: request.user.id
    }, "Verified character ownership changed");
    return result.ownership;
  });
};
