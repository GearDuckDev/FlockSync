import type { FastifyPluginAsync } from "fastify";
import { OfficerTaskInputSchema } from "@flocksync/shared-types";
import { createTask, deleteTask, listTasks, updateTask } from "../services/tasks.service.js";

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  const officerOnly = [app.authenticate, app.requireOfficer];

  app.get("/tasks", { preHandler: officerOnly }, async () => listTasks());

  app.post("/tasks", { preHandler: officerOnly }, async (request, reply) => {
    const body = OfficerTaskInputSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid task" });
    return reply.code(201).send(createTask(body.data));
  });

  app.put<{ Params: { id: string } }>("/tasks/:id", { preHandler: officerOnly }, async (request, reply) => {
    const body = OfficerTaskInputSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid task" });
    const updated = updateTask(request.params.id, body.data);
    if (!updated) return reply.code(404).send({ error: "Task not found" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/tasks/:id", { preHandler: officerOnly }, async (request, reply) => {
    if (!deleteTask(request.params.id)) return reply.code(404).send({ error: "Task not found" });
    return reply.code(204).send();
  });
};
