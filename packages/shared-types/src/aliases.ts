import { z } from "zod";

export const PlayerAliasSchema = z.object({
  key: z.string().min(1).max(200),
  alias: z.string().trim().min(1).max(40)
}).strict();

export type PlayerAlias = z.infer<typeof PlayerAliasSchema>;

export const PlayerAliasInputSchema = z.object({
  alias: PlayerAliasSchema.shape.alias
}).strict();

export type PlayerAliasInput = z.infer<typeof PlayerAliasInputSchema>;
