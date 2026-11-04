import cors from "@fastify/cors";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { seedInitialAdmin } from "./db/seed.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { raidsRoutes } from "./routes/raids.routes.js";
import { ledgerRoutes } from "./routes/ledger.routes.js";
import { lootSessionsRoutes } from "./routes/lootSessions.routes.js";
import { aliasesRoutes } from "./routes/aliases.routes.js";
import { tasksRoutes } from "./routes/tasks.routes.js";
import { syncRoutes } from "./routes/sync.routes.js";
import { usersRoutes } from "./routes/users.routes.js";
import { updatesRoutes } from "./routes/updates.routes.js";
import { themesRoutes } from "./routes/themes.routes.js";
import { databaseAdminRoutes } from "./routes/databaseAdmin.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

export const buildServer = async () => {
  const app = Fastify({
    logger: true,
    bodyLimit: 1024 * 1024,
    requestTimeout: 300_000,
    connectionTimeout: 300_000,
    keepAliveTimeout: 5_000,
    trustProxy: env.TRUSTED_PROXY_IP ?? false
  });
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      retryAfter: context.after
    })
  });
  await registerAuthPlugin(app);
  app.addContentTypeParser("application/octet-stream", {
    parseAs: "buffer"
  }, (_request, body, done) => done(null, body));

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(syncRoutes, { prefix: "/api" });
  await app.register(raidsRoutes, { prefix: "/api" });
  await app.register(ledgerRoutes, { prefix: "/api" });
  await app.register(lootSessionsRoutes, { prefix: "/api" });
  await app.register(aliasesRoutes, { prefix: "/api" });
  await app.register(tasksRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(updatesRoutes, { prefix: "/api" });
  await app.register(themesRoutes, { prefix: "/api" });
  await app.register(databaseAdminRoutes, { prefix: "/api/admin" });
  return app;
};

const startServer = async (): Promise<void> => {
  const app = await buildServer();
  try {
    await seedInitialAdmin();
    await app.listen({ port: env.PORT, host: env.HOST });
    const shutdown = (): void => {
      void app.close().catch((error: unknown) => {
        app.log.error(error, "API shutdown failed");
        process.exitCode = 1;
      });
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (error) {
    app.log.error({ event: "api_startup_failed", err: error }, "Failed to start API server");
    await app.close();
    throw error;
  }
};

void startServer().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});
