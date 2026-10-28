import { z } from "zod";

export const GuildIdentitySchema = z.object({
  name: z.string().trim().min(1).max(128),
  realm: z.string().trim().min(1).max(128)
}).strict();

export const GuildStateSchema = z.object({
  guild: GuildIdentitySchema.nullable()
}).strict();

export type GuildIdentity = z.infer<typeof GuildIdentitySchema>;
