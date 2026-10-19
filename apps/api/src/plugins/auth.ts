import fastifyJwt from "@fastify/jwt";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import type { AuthUser } from "@flocksync/shared-types";
import { AuthUserSchema } from "@flocksync/shared-types";
import { z } from "zod";
import { env } from "../config/env.js";
import { findUserById } from "../services/users.service.js";

const AuthTokenPayloadSchema = AuthUserSchema.extend({
  iat: z.number().int().optional()
});

export const parseAuthUser = (payload: unknown): AuthUser | undefined => {
  const tokenPayload = AuthTokenPayloadSchema.safeParse(payload);
  if (!tokenPayload.success) {
    return undefined;
  }

  return AuthUserSchema.parse({
    id: tokenPayload.data.id,
    email: tokenPayload.data.email,
    username: tokenPayload.data.username,
    role: tokenPayload.data.role
  });
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOfficer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const registerAuthPlugin = async (app: FastifyInstance): Promise<void> => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const tokenUser = parseAuthUser(request.user);
    // Re-read the account so deletions and role changes apply to already-issued tokens.
    const current = tokenUser ? findUserById(tokenUser.id) : undefined;
    if (!current) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    request.user = AuthUserSchema.parse({
      id: current.id,
      email: current.email,
      username: current.username,
      role: current.role
    });
  });

  app.decorate("requireOfficer", async (request, reply) => {
    const user = parseAuthUser(request.user);
    if (!user || (user.role !== "OFFICER" && user.role !== "ADMIN")) {
      await reply.code(403).send({ error: "Forbidden" });
    }
  });

  app.decorate("requireAdmin", async (request, reply) => {
    const user = parseAuthUser(request.user);
    if (!user || user.role !== "ADMIN") {
      await reply.code(403).send({ error: "Forbidden" });
    }
  });
};
