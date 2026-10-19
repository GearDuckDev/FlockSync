import type { FastifyPluginAsync } from "fastify";
import { PlayerAliasInputSchema } from "@flocksync/shared-types";
import { clearAlias, listAliases, setAlias } from "../services/aliases.service.js";

export const aliasesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/aliases", { preHandler: app.authenticate }, async () => listAliases());

  app.put<{ Params: { key: string } }>("/aliases/:key", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    const body = PlayerAliasInputSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid alias" });
    return setAlias(request.params.key, body.data.alias);
  });

  app.delete<{ Params: { key: string } }>("/aliases/:key", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    clearAlias(request.params.key);
    return reply.code(204).send();
  });
};
