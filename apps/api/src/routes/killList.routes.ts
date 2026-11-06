import type { FastifyPluginAsync } from "fastify";
import { KillEditRequestSchema, KillRemoveRequestSchema } from "@flocksync/shared-types";
import { changeSharedKill, listSharedKills } from "../services/killList.service.js";
import { listKillObservations } from "../services/killObservations.service.js";

export const killListRoutes: FastifyPluginAsync = async (app) => {
  app.get("/kill-list", { preHandler: app.authenticate }, async () => listSharedKills());
  app.get("/kill-list/observations", { preHandler: app.authenticate }, async () => listKillObservations());
  app.patch("/kill-list", { preHandler: app.authenticate }, async (request, reply) => {
    const input = KillEditRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "Invalid kill-list note edit" });
    const result = changeSharedKill(request.user.id, input.data, input.data.note);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ by: request.user.id, target: input.data.name }, "Shared kill note changed");
    return result.entry;
  });
  app.delete("/kill-list", { preHandler: app.authenticate }, async (request, reply) => {
    const input = KillRemoveRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: "Invalid kill-list removal" });
    const result = changeSharedKill(request.user.id, input.data);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ by: request.user.id, target: input.data.name }, "Shared kill target removed");
    return result.entry;
  });
};
