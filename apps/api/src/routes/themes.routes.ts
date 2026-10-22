import type { FastifyPluginAsync } from "fastify";
import { ThemeSchema } from "@flocksync/shared-types";
import { getThemes, saveDefaultTheme, saveUserTheme } from "../services/themes.service.js";
import { validThemeImage } from "../services/themeImages.js";

export const themesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/themes", { preHandler: app.authenticate }, async (request) => getThemes(request.user.id));

  app.put("/themes/default", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const parsed = ThemeSchema.safeParse(request.body);
    if (!parsed.success || !validThemeImage(parsed.data)) {
      return reply.code(400).send({ error: "Invalid theme. Use six-digit hex colors, a PNG/JPEG image and opacity from 0 to 40%." });
    }
    saveDefaultTheme(parsed.data);
    return getThemes(request.user.id);
  });

  app.put("/themes/me", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = ThemeSchema.nullable().safeParse(request.body);
    if (!parsed.success || (parsed.data !== null && !validThemeImage(parsed.data))) {
      return reply.code(400).send({ error: "Invalid theme. Use six-digit hex colors, a PNG/JPEG image and opacity from 0 to 40%." });
    }
    saveUserTheme(request.user.id, parsed.data);
    return getThemes(request.user.id);
  });
};
