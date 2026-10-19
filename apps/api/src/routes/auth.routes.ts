import { compare } from "bcryptjs";
import { sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import {
  AuthUserSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  RegisterRequestSchema,
  type LoginResponse
} from "@flocksync/shared-types";
import { parseAuthUser } from "../plugins/auth.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { createUser } from "../services/users.service.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  const issueSession = (user: { id: string; email: string; username: string; role: string }): LoginResponse => {
    const authUser = AuthUserSchema.parse({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    });
    return LoginResponseSchema.parse({ token: app.jwt.sign(authUser), user: authUser });
  };

  app.post("/login", async (request, reply) => {
    const loginRequest = LoginRequestSchema.safeParse(request.body);
    if (!loginRequest.success) {
      return reply.code(400).send({ error: "Invalid login request" });
    }

    const user = await db.select().from(users)
      .where(sql`lower(${users.email}) = ${loginRequest.data.email.trim().toLowerCase()}`)
      .get();

    if (!user || !(await compare(loginRequest.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    return reply.code(200).send(issueSession(user));
  });

  app.post("/register", async (request, reply) => {
    const body = RegisterRequestSchema.safeParse(request.body);
    if (!body.success) {
      const issue = body.error.issues[0];
      const field = issue?.path.join(".") ?? "request";
      return reply.code(400).send({ error: `Invalid ${field}: ${issue?.message ?? "invalid value"}` });
    }

    // Self-service accounts are always MEMBER; admins promote them later.
    const result = await createUser({ ...body.data, role: "MEMBER" });
    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }

    request.log.info({ userId: result.user.id }, "New member registered");
    return reply.code(201).send(issueSession(result.user));
  });

  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const authUser = parseAuthUser(request.user);
    if (!authUser) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return authUser;
  });
};
