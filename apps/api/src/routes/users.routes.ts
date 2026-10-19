import type { FastifyPluginAsync } from "fastify";
import {
  CreateUserAdminSchema,
  UpdateUserRoleRequestSchema,
  UpdateUsernameRequestSchema
} from "@flocksync/shared-types";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUserRole,
  updateUsername
} from "../services/users.service.js";

export const usersRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = [app.authenticate, app.requireAdmin];

  app.get("/users", { preHandler: adminOnly }, async () => listUsers());

  app.patch<{ Params: { id: string } }>("/users/:id/username", {
    preHandler: app.authenticate
  }, async (request, reply) => {
    const body = UpdateUsernameRequestSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Username must be between 2 and 32 characters with no extra fields" });
    }
    const result = updateUsername(request.params.id, body.data.username, request.user.id);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ userId: result.user.id, by: request.user.id }, "Username changed");
    return result.user;
  });

  app.post("/users", { preHandler: adminOnly }, async (request, reply) => {
    const body = CreateUserAdminSchema.safeParse(request.body);
    if (!body.success) {
      const issue = body.error.issues[0];
      const field = issue?.path.join(".") ?? "request";
      return reply.code(400).send({ error: `Invalid ${field}: ${issue?.message ?? "invalid value"}` });
    }
    const result = await createUser(body.data);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ userId: result.user.id, role: result.user.role, by: request.user.id }, "Admin created user");
    return reply.code(201).send(result.user);
  });

  app.patch<{ Params: { id: string } }>("/users/:id/role", { preHandler: adminOnly }, async (request, reply) => {
    const body = UpdateUserRoleRequestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Body must be { role: 'MEMBER' | 'OFFICER' | 'ADMIN' }" });
    const result = updateUserRole(request.params.id, body.data.role, request.user.id);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ userId: result.user.id, role: result.user.role, by: request.user.id }, "Admin changed user role");
    return result.user;
  });

  app.delete<{ Params: { id: string } }>("/users/:id", { preHandler: adminOnly }, async (request, reply) => {
    const result = deleteUser(request.params.id, request.user.id);
    if (!result.ok) return reply.code(result.status).send({ error: result.error });
    request.log.info({ userId: request.params.id, by: request.user.id }, "Admin deleted user");
    return reply.code(204).send();
  });
};
