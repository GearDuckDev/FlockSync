import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./config/env.js";
import { seedInitialAdmin } from "./db/seed.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { raidsRoutes } from "./routes/raids.routes.js";
import { ledgerRoutes } from "./routes/ledger.routes.js";
import { aliasesRoutes } from "./routes/aliases.routes.js";
import { tasksRoutes } from "./routes/tasks.routes.js";
import { syncRoutes } from "./routes/sync.routes.js";
import { usersRoutes } from "./routes/users.routes.js";

export const buildServer = async () => {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });
  await registerAuthPlugin(app);

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(syncRoutes, { prefix: "/api" });
  await app.register(raidsRoutes, { prefix: "/api" });
  await app.register(ledgerRoutes, { prefix: "/api" });
  await app.register(aliasesRoutes, { prefix: "/api" });
  await app.register(tasksRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
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
    app.log.error(error, "Failed to start API server");
    await app.close();
    throw error;
  }
};

void startServer().catch((error: unknown) => {
  console.error("API startup failed", error);
  process.exitCode = 1;
});
