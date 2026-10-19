import type { FastifyPluginAsync } from "fastify";
import { RaidTeamInputSchema } from "@flocksync/shared-types";
import {
  createRaidTeam,
  deleteRaidTeam,
  listRaidTeams,
  updateRaidTeam
} from "../services/raids.service.js";

export const raidsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/raids", { preHandler: app.authenticate }, async () => listRaidTeams());

  app.post("/raids", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    const body = RaidTeamInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid raid team" });
    }
    return reply.code(201).send(createRaidTeam(body.data));
  });

  app.put<{ Params: { id: string } }>("/raids/:id", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    const body = RaidTeamInputSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid raid team" });
    }
    const updated = updateRaidTeam(request.params.id, body.data);
    if (!updated) {
      return reply.code(404).send({ error: "Raid team not found" });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/raids/:id", {
    preHandler: [app.authenticate, app.requireOfficer]
  }, async (request, reply) => {
    if (!deleteRaidTeam(request.params.id)) {
      return reply.code(404).send({ error: "Raid team not found" });
    }
    return reply.code(204).send();
  });
};
