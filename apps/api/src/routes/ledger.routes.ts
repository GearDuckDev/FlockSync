import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listAttendance, listLoot } from "../services/ledger.service.js";

const LedgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(2000)
});

export const ledgerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ledger/loot", { preHandler: app.authenticate }, async (request, reply) => {
    const query = LedgerQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid query" });
    return listLoot(query.data.limit);
  });

  app.get("/ledger/attendance", { preHandler: app.authenticate }, async (request, reply) => {
    const query = LedgerQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid query" });
    return listAttendance(query.data.limit);
  });
};
