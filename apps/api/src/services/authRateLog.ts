import type { FastifyRequest } from "fastify";

export const createAuthRateLogger = (route: "login" | "register") => {
  let lastLoggedAt = Number.NEGATIVE_INFINITY;
  return (request: FastifyRequest): void => {
    const now = Date.now();
    if (now - lastLoggedAt < 60_000) return;
    lastLoggedAt = now;
    request.log.warn({ event: "auth_rate_limit_exceeded", route }, "Authentication rate limit exceeded");
  };
};
