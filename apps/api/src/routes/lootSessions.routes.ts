import type { FastifyPluginAsync } from "fastify";
import {
  LootSessionDraftInputSchema, LootSessionDraftUpdateSchema,
  LootSessionIdParamsSchema, LootSessionListQuerySchema
} from "@flocksync/shared-types";
import {
  createLootSession, getLootSession, getLootSessionHistory,
  listLootSessions, updateLootSession
} from "../services/lootSessions.service.js";

export const lootSessionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", app.requireOfficer);

  app.get("/loot/sessions", async (request, reply) => {
    const query = LootSessionListQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid loot session pagination" });
    return listLootSessions(query.data);
  });

  app.post("/loot/sessions", async (request, reply) => {
    const body = LootSessionDraftInputSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid loot session draft" });
    const session = createLootSession(body.data, request.user);
    request.log.info({ event: "loot_session_created", sessionId: session.id, by: request.user.id });
    return reply.code(201).send(session);
  });

  app.get("/loot/sessions/:id", async (request, reply) => {
    const params = LootSessionIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid loot session ID" });
    const session = getLootSession(params.data.id);
    if (!session) return reply.code(404).send({ error: "Loot session not found" });
    return session;
  });

  app.put("/loot/sessions/:id", async (request, reply) => {
    const params = LootSessionIdParamsSchema.safeParse(request.params);
    const body = LootSessionDraftUpdateSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Invalid loot session update" });
    }
    const result = updateLootSession(params.data.id, body.data, request.user);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({
      event: "loot_session_updated", sessionId: result.session.id,
      revision: result.session.revision, by: request.user.id
    });
    return result.session;
  });

  app.get("/loot/sessions/:id/history", async (request, reply) => {
    const params = LootSessionIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid loot session ID" });
    if (!getLootSession(params.data.id)) {
      return reply.code(404).send({ error: "Loot session not found" });
    }
    return getLootSessionHistory(params.data.id);
  });
};
